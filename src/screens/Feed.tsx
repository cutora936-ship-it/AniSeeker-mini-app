import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { CharacterCard } from '../components/CharacterCard';
import { Icon } from '../components/Icon';
import type { Character } from '../data/characters';

export function Feed({ characters, activeIndex, setActiveIndex, favoriteIds, onFavorite, onOpen }: {
  characters: readonly Character[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  favoriteIds: readonly string[];
  onFavorite: (id: string) => void;
  onOpen: (character: Character) => void;
}) {
  const feed = useRef<HTMLDivElement>(null);

  const entryIndex = useRef(activeIndex);

  useLayoutEffect(() => {
    const viewport = feed.current;
    if (!viewport) return;
    const slide = viewport.children.item(entryIndex.current);
    if (slide instanceof HTMLElement) {
      viewport.scrollTo({ top: slide.offsetTop, behavior: 'instant' });
    }
  }, []);

  function scrollToIndex(index: number) {
    const viewport = feed.current;
    const slide = viewport?.children.item(index);
    if (!viewport || !(slide instanceof HTMLElement)) return;
    viewport.scrollTo({ top: slide.offsetTop, behavior: 'auto' });
  }

  function updateIndex() {
    const viewport = feed.current;
    if (!viewport || viewport.clientHeight === 0) return;
    const index = Math.min(characters.length - 1, Math.round(viewport.scrollTop / viewport.clientHeight));
    if (index < 0 || index === activeIndex) return;

    if (viewport.children.item(activeIndex)?.contains(document.activeElement)) {
      viewport.focus({ preventScroll: true });
    }

    setActiveIndex(index);
  }

  function onFeedKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys: Record<string, number> = {
      ArrowUp: activeIndex - 1,
      PageUp: activeIndex - 1,
      ArrowDown: activeIndex + 1,
      PageDown: activeIndex + 1,
      Home: 0,
      End: characters.length - 1,
    };
    const index = keys[event.key];
    if (typeof index !== 'number') return;
    event.preventDefault();
    scrollToIndex(index);
  }

  const atEnd = activeIndex === characters.length - 1;

  return (
    <div className="feed-screen">
      <div className="feed" ref={feed} onScroll={updateIndex} onKeyDown={onFeedKeyDown}
        tabIndex={0} role="region" aria-label="Лента персонажей">
        {characters.map((character, index) => (
          <div className="feed__slide" key={character.id} inert={index !== activeIndex}
            aria-hidden={index !== activeIndex || undefined}>
            <CharacterCard character={character} saved={favoriteIds.includes(character.id)}
              onFavorite={() => onFavorite(character.id)} onOpen={() => onOpen(character)} />
          </div>
        ))}
      </div>
      {characters.length > 1 && (
        <button type="button" className={atEnd ? 'swipe-hint swipe-hint--previous' : 'swipe-hint'}
          onClick={() => scrollToIndex(activeIndex + (atEnd ? -1 : 1))}>
          <Icon name="swipe" />
          <span><strong>{atEnd ? 'Свайп вниз' : 'Свайп вверх'}</strong>
            {atEnd ? ' — предыдущий персонаж' : ' — следующий персонаж'}</span>
        </button>
      )}
    </div>
  );
}
