import { Icon } from '../components/Icon';
import type { TelegramUser } from '../platform/telegram';

export function Profile({ user }: { user?: TelegramUser }) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ');

  return (
    <section className="subscreen" aria-labelledby="profile-title">
      <h1 id="profile-title">Профиль</h1>
      <div className="profile glass">
        <span className="empty-state__icon glass"><Icon name="user" /></span>
        <div>
          <h2>{name || 'Гость'}</h2>
          <p>{user ? (user.username ? `@${user.username}` : 'Telegram') : 'Браузерный режим'}</p>
        </div>
      </div>
    </section>
  );
}
