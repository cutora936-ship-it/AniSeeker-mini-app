import { memo } from 'react';
import type { Character } from '../data/characters';
import { CharacterPortrait } from './CharacterPortrait';
import { Icon } from './Icon';

export function CharacterPlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'placeholder placeholder--compact' : 'placeholder'} aria-hidden="true">
      <div className="placeholder__frame">
        <Icon name="image" />
      </div>
    </div>
  );
}

export function DossierLabel({ character }: { character: Character }) {
  return (
    <p className="dossier-label">
      <span>Досье №{character.dossier}</span>
      <span aria-hidden="true">·</span>
      <span>{character.work}</span>
    </p>
  );
}

export function FavoriteButton({ saved, name, onClick }: {
  saved: boolean;
  name: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="icon-button surface favorite-button" aria-pressed={saved}
      aria-label={`Избранное: ${name}`} onClick={onClick}>
      <Icon name="bookmark" />
    </button>
  );
}

export const CharacterCard = memo(function CharacterCard({ character, saved, priority, onFavorite, onOpen }: {
  character: Character;
  saved: boolean;
  priority: boolean;
  onFavorite: (id: string) => void;
  onOpen: (character: Character) => void;
}) {
  const { portrait } = character;

  return (
    <article className={portrait ? 'character-card character-card--with-portrait' : 'character-card'}
      data-theme={character.theme} aria-labelledby={`name-${character.id}`}>
      {portrait ? (
        <CharacterPortrait className="character-card__portrait" portrait={portrait} variant="feed" priority={priority} />
      ) : (
        <CharacterPlaceholder />
      )}
      <div className="character-card__content">
        <div className="character-card__info">
          <div>
            <DossierLabel character={character} />
            <h2 id={`name-${character.id}`}>{character.name}</h2>
            <p className="character-card__description">{character.description}</p>
          </div>
          <FavoriteButton name={character.name} saved={saved} onClick={() => onFavorite(character.id)} />
        </div>
        <button type="button" className="study-button surface" onClick={() => onOpen(character)}>
          Изучить персонажа
          <Icon name="right" />
        </button>
      </div>
    </article>
  );
});
