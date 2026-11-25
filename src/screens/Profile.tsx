import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Icon } from '../components/Icon';
import type { TelegramUser } from '../platform/telegram';
import { ProfileAvatar } from '../profile/ProfileAvatar';
import { ProfileEditor, type AvatarChange, type ProfileEditorState } from '../profile/ProfileEditor';
import { readAvatar, readProfile, saveProfile } from '../profile/storage';
import './Profile.css';

export function Profile({ user, editor, onEditorChange }: {
  user?: TelegramUser;
  editor: ProfileEditorState;
  onEditorChange: (editor: ProfileEditorState) => void;
}) {
  const [preferences, setPreferences] = useState(readProfile);
  const [loaded, setLoaded] = useState<{ id: string; image: Blob | null } | null>(null);
  const editorTrigger = useRef<HTMLButtonElement>(null);
  const avatarId = preferences.avatarId;
  const image = loaded?.id === avatarId ? loaded.image : null;
  const name = preferences.nickname || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Гость';

  useEffect(() => {
    if (!avatarId || loaded?.id === avatarId) return;
    let active = true;
    readAvatar(avatarId).then(
      (blob) => { if (active) setLoaded({ id: avatarId, image: blob }); },
      () => { if (active) setLoaded({ id: avatarId, image: null }); },
    );
    return () => { active = false; };
  }, [avatarId, loaded?.id]);

  useEffect(() => {
    if (editor === 'closed') editorTrigger.current?.focus({ preventScroll: true });
  }, [editor]);

  function openEditor(event: MouseEvent<HTMLButtonElement>) {
    editorTrigger.current = event.currentTarget;
    onEditorChange('editing');
  }

  async function save(nickname: string, avatar: AvatarChange) {
    onEditorChange('saving');
    try {
      const next = await saveProfile(nickname, avatar);
      if (avatar && next.avatarId) setLoaded({ id: next.avatarId, image: avatar });
      else if (avatar === null) setLoaded(null);
      setPreferences(next);
      onEditorChange('closed');
    } catch (error) {
      onEditorChange('editing');
      throw error;
    }
  }

  return (
    <section className="subscreen" aria-labelledby="profile-title">
      <h1 id="profile-title">Профиль</h1>
      <div className="profile profile--editable surface">
        <div className="profile__avatar">
          <ProfileAvatar image={image} />
          <button type="button" className="profile__camera icon-button surface" aria-label="Редактировать аватарку"
            onClick={openEditor}><Icon name="camera" /></button>
        </div>
        <div className="profile__identity">
          <h2>{name}</h2>
          <p>{user ? (user.username ? `@${user.username}` : 'Telegram') : 'Браузерный режим'}</p>
        </div>
        <button type="button" className="profile__edit profile-action surface"
          onClick={openEditor}><Icon name="edit" />Редактировать профиль</button>
      </div>
      {editor !== 'closed' && (
        <ProfileEditor name={name} image={image} hasAvatar={Boolean(avatarId)} saving={editor === 'saving'}
          onCancel={() => onEditorChange('closed')} onSave={save} />
      )}
    </section>
  );
}
