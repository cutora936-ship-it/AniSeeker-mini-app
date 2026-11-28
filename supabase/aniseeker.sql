begin;

create table if not exists public.aniseeker_profiles (
  telegram_id bigint primary key check (telegram_id > 0),
  registered_at timestamptz not null default now(),
  nickname text not null default 'Гость' check (char_length(nickname) between 2 and 24),
  avatar_id text check (avatar_id ~ '^[a-f0-9]{32}$'),
  version integer not null default 0,
  mutation text
);

create table if not exists public.aniseeker_avatars (
  telegram_id bigint not null references public.aniseeker_profiles on delete cascade,
  avatar_id text not null check (avatar_id ~ '^[a-f0-9]{32}$'),
  uploaded_at timestamptz not null default now(),
  retired_at timestamptz,
  primary key (telegram_id, avatar_id)
);

create table if not exists public.aniseeker_game_data (
  telegram_id bigint not null references public.aniseeker_profiles on delete cascade,
  category text not null,
  key text not null,
  value text not null check (octet_length(value) <= 196608),
  version integer not null check (version > 0),
  mutation text not null,
  primary key (telegram_id, category, key)
) partition by list (category);

create table if not exists public.aniseeker_favorites partition of public.aniseeker_game_data for values in ('favorites');
create table if not exists public.aniseeker_records partition of public.aniseeker_game_data for values in ('records');
create table if not exists public.aniseeker_training partition of public.aniseeker_game_data for values in ('training');
create table if not exists public.aniseeker_story partition of public.aniseeker_game_data for values in ('story');
create table if not exists public.aniseeker_settings partition of public.aniseeker_game_data for values in ('settings');

do $$
declare
  name text;
begin
  foreach name in array array['profiles','avatars','game_data','favorites','records','training','story','settings'] loop
    execute format('alter table public.%I enable row level security', 'aniseeker_' || name);
    execute format('revoke all on public.%I from public, anon, authenticated', 'aniseeker_' || name);
    execute format('grant select, insert, update on public.%I to service_role', 'aniseeker_' || name);
  end loop;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aniseeker-avatars', 'aniseeker-avatars', false, 1048576, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Restrictive policy also protects this bucket if the project has broad Storage policies.
drop policy if exists aniseeker_private_avatars on storage.objects;
create policy aniseeker_private_avatars on storage.objects
  as restrictive for all to anon, authenticated
  using (bucket_id <> 'aniseeker-avatars') with check (bucket_id <> 'aniseeker-avatars');

create or replace function public.aniseeker_read_account(p_user bigint)
returns jsonb language sql set search_path = '' as $$
  select jsonb_build_object('registeredAt', p.registered_at, 'entries',
    coalesce((select jsonb_agg(item) from (
      select key, value, version, mutation
      from public.aniseeker_game_data where telegram_id = p_user
      union all
      select 'profile:v1', jsonb_build_object('nickname', p.nickname, 'avatarId', p.avatar_id)::text,
        p.version, p.mutation where p.version > 0
    ) as item), '[]'::jsonb))
  from public.aniseeker_profiles p where p.telegram_id = p_user
$$;

create or replace function public.aniseeker_save_account(p_user bigint, p_changes jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  profile public.aniseeker_profiles%rowtype;
  game public.aniseeker_game_data%rowtype;
  change jsonb;
  output jsonb := '[]'::jsonb;
  name text;
  category_name text;
  operation text;
  proposed_version integer;
  proposed_value text;
  next_avatar text;
  retired text;
begin
  -- One lock per account prevents conflicting writes across requests and devices.
  select * into strict profile from public.aniseeker_profiles where telegram_id = p_user for update;
  for change in select * from jsonb_array_elements(p_changes) loop
    name := change->>'key';
    category_name := change->>'group';
    operation := change->>'mutation';
    proposed_version := (change->>'version')::integer;
    proposed_value := change->>'value';
    retired := null;

    if name = 'profile:v1' then
      if profile.version = proposed_version and profile.mutation is distinct from operation then
        next_avatar := proposed_value::jsonb->>'avatarId';
        if next_avatar is not null and not exists (
          select 1 from public.aniseeker_avatars a
          where a.telegram_id = p_user and a.avatar_id = next_avatar and a.retired_at is null
        ) then
          raise exception 'Avatar is unavailable' using errcode = '22023';
        end if;
        if profile.avatar_id is distinct from next_avatar and profile.avatar_id is not null then
          retired := profile.avatar_id;
          update public.aniseeker_avatars set retired_at = now()
            where telegram_id = p_user and avatar_id = retired;
        end if;
        update public.aniseeker_profiles set nickname = proposed_value::jsonb->>'nickname',
          avatar_id = next_avatar, version = version + 1, mutation = operation
          where telegram_id = p_user returning * into profile;
      end if;
      output := output || jsonb_build_array(jsonb_build_object('key', name, 'value',
        jsonb_build_object('nickname', profile.nickname, 'avatarId', profile.avatar_id)::text,
        'version', profile.version, 'mutation', profile.mutation, 'retired', retired));
    else
      insert into public.aniseeker_game_data as g (telegram_id, category, key, value, version, mutation)
      select p_user, category_name, name, proposed_value, 1, operation
      where proposed_version = 0 or exists (
        select 1 from public.aniseeker_game_data existing
        where existing.telegram_id = p_user and existing.category = category_name and existing.key = name
      )
      on conflict (telegram_id, category, key) do update set value = excluded.value,
        version = g.version + 1, mutation = excluded.mutation
      where g.version = proposed_version and g.mutation is distinct from operation;

      select * into strict game from public.aniseeker_game_data
        where telegram_id = p_user and category = category_name and key = name;
      output := output || jsonb_build_array(jsonb_build_object('key', name, 'value', game.value,
        'version', game.version, 'mutation', game.mutation));
    end if;
  end loop;
  return output;
end;
$$;

revoke all on function public.aniseeker_read_account(bigint) from public, anon, authenticated;
revoke all on function public.aniseeker_save_account(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.aniseeker_read_account(bigint) to service_role;
grant execute on function public.aniseeker_save_account(bigint, jsonb) to service_role;

commit;
