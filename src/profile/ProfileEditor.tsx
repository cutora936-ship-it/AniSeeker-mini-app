import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { AvatarError, avatarFileTypes } from './avatar';
import { ProfileAvatar } from './ProfileAvatar';
import { nicknameLength, validateNickname } from './storage';

export type AvatarChange = Blob | null | undefined;
export type ProfileEditorState = 'closed' | 'editing' | 'saving';

export function ProfileEditor({ name, image, hasAvatar, saving, onCancel, onSave }: {
  name: string;
  image: Blob | null;
  hasAvatar: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: (nickname: string, avatar: AvatarChange) => Promise<void>;
}) {
  const [nickname, setNickname] = useState(name);
  const [avatarChange, setAvatarChange] = useState<AvatarChange>();
  const [processing, setProcessing] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const fields = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const pending = useRef(false);
  const length = nicknameLength(nickname);
  const nicknameError = (attempted || length > 24) ? validateNickname(nickname) : '';
  const preview = avatarChange === undefined ? image : avatarChange;
  const canRemove = avatarChange === undefined ? hasAvatar : Boolean(avatarChange);

  useEffect(() => {
    mounted.current = true;
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    title.current?.focus({ preventScroll: true });

    const viewport = window.visualViewport;
    let frame = 0;
    function fitViewport() {
      if (!element) return;
      element.style.setProperty('--profile-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      element.style.setProperty('--profile-viewport-top', `${viewport?.offsetTop ?? 0}px`);
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const field = input.current;
        const area = fields.current;
        if (!field || !area || document.activeElement !== field) return;
        const visible = area.getBoundingClientRect();
        const target = field.getBoundingClientRect();
        if (target.bottom > visible.bottom - 4) area.scrollTop += target.bottom - visible.bottom + 4;
        else if (target.top < visible.top + 4) area.scrollTop += target.top - visible.top - 4;
      });
    }

    fitViewport();
    viewport?.addEventListener('resize', fitViewport);
    viewport?.addEventListener('scroll', fitViewport);
    window.addEventListener('resize', fitViewport);
    return () => {
      mounted.current = false;
      window.cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', fitViewport);
      viewport?.removeEventListener('scroll', fitViewport);
      window.removeEventListener('resize', fitViewport);
      element.close();
    };
  }, []);

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || processing || pending.current) return;
    setProcessing(true);
    setPhotoError('');
    setSaveError('');
    try {
      const { prepareAvatar } = await import('./prepareAvatar');
      if (!mounted.current) return;
      const photo = await prepareAvatar(file);
      if (mounted.current) setAvatarChange(photo);
    } catch (error) {
      if (mounted.current) {
        setPhotoError(error instanceof AvatarError ? error.message : 'Не удалось открыть фото. Попробуй выбрать другое.');
      }
    } finally {
      if (mounted.current) setProcessing(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (processing || pending.current) return;
    setAttempted(true);
    setSaveError('');

    if (validateNickname(nickname)) {
      input.current?.focus();
      return;
    }

    pending.current = true;
    try {
      await onSave(nickname, avatarChange);
    } catch {
      if (mounted.current) setSaveError('Не удалось сохранить профиль. Попробуй ещё раз.');
    } finally {
      pending.current = false;
    }
  }

  return (
    <dialog ref={dialog} className="profile-editor surface" aria-labelledby="profile-editor-title"
      onCancel={(event) => { event.preventDefault(); if (!pending.current) onCancel(); }}>
      <form className="profile-editor__form" onSubmit={submit} noValidate>
        <div className="profile-editor__header">
          <h2 id="profile-editor-title" ref={title} tabIndex={-1}>Редактировать профиль</h2>
          <button type="button" className="profile-editor__close icon-button surface" aria-label="Закрыть редактор"
            disabled={saving} onClick={onCancel}><Icon name="close" /></button>
        </div>
        <div className="profile-editor__fields" ref={fields}>
          <div className="profile-editor__field">
            <label htmlFor="profile-nickname">Никнейм</label>
            <input id="profile-nickname" ref={input} value={nickname} autoComplete="nickname" enterKeyHint="done"
              aria-describedby="profile-nickname-hint" aria-invalid={Boolean(nicknameError)} disabled={saving} required
              onChange={(event) => { setNickname(event.target.value); setSaveError(''); }} />
            <p id="profile-nickname-hint" className={nicknameError ? 'profile-form-error' : 'profile-nickname-hint'}>
              {nicknameError || 'От 2 до 24 символов'}
            </p>
          </div>
          <div className="profile-editor__photo">
            <ProfileAvatar image={preview} />
            <div className="profile-editor__photo-controls">
              <input type="file" aria-label="Файл аватарки" accept={avatarFileTypes} ref={fileInput} hidden
                onChange={choosePhoto} />
              <button type="button" className="profile-photo-action surface" disabled={saving || processing}
                onClick={() => fileInput.current?.click()}>
                <Icon name="camera" />{canRemove ? 'Заменить фото' : 'Выбрать фото'}
              </button>
              {canRemove && (
                <button type="button" className="profile-photo-remove" disabled={saving || processing}
                  onClick={() => { setAvatarChange(null); setPhotoError(''); setSaveError(''); }}>
                  Удалить фото
                </button>
              )}
            </div>
          </div>
          {processing && <p className="profile-nickname-hint" role="status">Подготовка фото…</p>}
          {photoError && <p className="profile-form-error" role="alert">{photoError}</p>}
        </div>
        <div className="profile-editor__actions">
          {saveError && <p className="profile-form-error" role="alert">{saveError}</p>}
          <button type="button" className="profile-action surface" disabled={saving} onClick={onCancel}>Отмена</button>
          <button type="submit" className="profile-action profile-action--primary" disabled={saving || processing}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
