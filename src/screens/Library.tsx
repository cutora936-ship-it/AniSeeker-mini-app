import type { ReactNode } from 'react';
import { CharacterPlaceholder, FavoriteButton } from '../components/CharacterCard';
import { Icon, type IconName } from '../components/Icon';
import type { Character } from '../data/characters';

export function EmptyState({ icon, title, children }: {
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon glass"><Icon name={icon} /></span>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}

export function CharacterList({ characters, favoriteIds, onFavorite, onOpen, animateRows }: {
  characters: readonly Character[];
  favoriteIds: readonly string[];
  onFavorite: (id: string) => void;
  onOpen: (character: Character) => void;
  animateRows?: boolean;
}) {
  return (
    <ul className={animateRows ? 'character-list character-list--reveal' : 'character-list'}>
      {characters.map((character) => (
        <li className="character-row glass" key={character.id}>
          <button type="button" className="character-row__open" onClick={() => onOpen(character)}>
            {character.portrait ? (
              <img className="character-row__portrait" src={character.portrait} alt="" loading="lazy" />
            ) : (
              <CharacterPlaceholder compact />
            )}
            <span className="character-row__labels">
              <strong>{character.name}</strong>
              <small>{character.work}</small>
            </span>
          </button>
          <FavoriteButton name={character.name} saved={favoriteIds.includes(character.id)}
            onClick={() => onFavorite(character.id)} />
        </li>
      ))}
    </ul>
  );
}
