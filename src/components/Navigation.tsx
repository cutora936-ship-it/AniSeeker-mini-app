import { memo } from 'react';
import { Icon, type IconName } from './Icon';

export type Tab = 'home' | 'favorites' | 'profile';

const tabs: readonly { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'favorites', label: 'Избранное', icon: 'bookmark' },
  { id: 'profile', label: 'Профиль', icon: 'user' },
];

export const Navigation = memo(function Navigation({ current, onChange }: { current: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="navigation glass" aria-label="Основная навигация" data-active={current}>
      <span className="navigation__track" aria-hidden="true"><span className="navigation__indicator" /></span>
      {tabs.map(({ id, label, icon }) => (
        <button key={id} type="button" className="navigation__item"
          aria-current={current === id ? 'page' : undefined} onClick={() => onChange(id)}>
          <Icon name={icon} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
});
