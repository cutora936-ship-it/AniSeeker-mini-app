import { useRef } from 'react';
import type { Character } from '../data/characters';
import { Icon } from './Icon';

export function CharacterPlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'placeholder placeholder--compact' : 'placeholder'} aria-hidden="true">
      <div className="placeholder__field">
        <div className="placeholder__frame">
          <Icon name="image" />
        </div>
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
  const bookmark = useRef<Animation | null>(null);

  return (
    <button type="button" className="icon-button glass favorite-button" aria-pressed={saved}
      aria-label={`Избранное: ${name}`} onClick={(event) => {
        onClick();
        bookmark.current?.cancel();
        if (saved || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        bookmark.current = event.currentTarget.querySelector('svg')?.animate?.(
          [{ scale: '1' }, { scale: '1.14', offset: .47 }, { scale: '1' }],
          { duration: 205, easing: 'cubic-bezier(.2,.72,.25,1)' },
        ) ?? null;
      }}>
      <Icon name="bookmark" />
    </button>
  );
}

export function CharacterCard({ character, saved, onFavorite, onOpen }: {
  character: Character;
  saved: boolean;
  onFavorite: () => void;
  onOpen: () => void;
}) {
  const { portrait } = character;

  return (
    <article className={portrait ? 'character-card character-card--with-portrait' : 'character-card'}
      data-theme={character.theme} aria-labelledby={`name-${character.id}`}>
      {portrait ? (
        <img className="character-card__portrait" src={portrait} alt="" fetchPriority="high" />
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
          <FavoriteButton name={character.name} saved={saved} onClick={onFavorite} />
        </div>
        <button type="button" className="study-button glass" onClick={onOpen}>
          Изучить персонажа
          <Icon name="right" />
        </button>
      </div>
    </article>
  );
}
