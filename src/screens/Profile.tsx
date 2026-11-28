import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Icon } from '../components/Icon';
import { useAccount } from '../account/current';
import { telegramScope } from '../account/storage';
import { getTelegram } from '../platform/telegram';
import { ProfileAvatar } from '../profile/ProfileAvatar';
import { ProfileEditor, type AvatarChange, type ProfileEditorState } from '../profile/ProfileEditor';
import { readAvatar, readProfile, saveProfile } from '../profile/storage';
import type { Activity, Character } from '../data/characters';
import { ContinueTraining } from '../training/ContinueTraining';
import './Profile.css';

export function Profile({ editor, onEditorChange, onResume }: {
  onResume: (character: Character, activity: Activity) => void;
  editor: ProfileEditorState;
  onEditorChange: (editor: ProfileEditorState) => void;
}) {
  const { scope, storage } = useAccount();
  const [preferences, setPreferences] = useState(() => readProfile(storage));
  const user = scope === 'guest' ? undefined : getTelegram()?.initDataUnsafe.user;
  const username = telegramScope(user?.id) === scope ? user?.username : undefined;
  const [loaded, setLoaded] = useState<{ id: string; image: Blob | null } | null>(null);
  const editorTrigger = useRef<HTMLButtonElement>(null);
  const avatarId = preferences.avatarId;
  const image = loaded?.id === avatarId ? loaded.image : null;
  const name = preferences.nickname || 'Гость';

  useEffect(() => {
    if (!avatarId || loaded?.id === avatarId) return;
    let active = true;
    readAvatar(scope, avatarId).then(
      (blob) => { if (active) setLoaded({ id: avatarId, image: blob }); },
      () => { if (active) setLoaded({ id: avatarId, image: null }); },
    );
    return () => { active = false; };
  }, [scope, avatarId, loaded?.id]);

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
      const next = await saveProfile(scope, storage, nickname, avatar);
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
          <p>{scope === 'guest' ? 'Браузерный режим' : username ? `@${username}` : 'Telegram'}</p>
        </div>
        <button type="button" className="profile__edit profile-action surface"
          onClick={openEditor}><Icon name="edit" />Редактировать профиль</button>
      </div>
      <ContinueTraining storage={storage} onResume={onResume} />
      {editor !== 'closed' && (
        <ProfileEditor name={name} image={image} hasAvatar={Boolean(avatarId)} saving={editor === 'saving'}
          onCancel={() => onEditorChange('closed')} onSave={save} />
      )}
    </section>
  );
}
