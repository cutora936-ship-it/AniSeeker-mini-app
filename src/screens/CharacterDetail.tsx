import { useEffect, useRef } from 'react';
import { CharacterPlaceholder, DossierLabel } from '../components/CharacterCard';
import type { Character } from '../data/characters';

export function CharacterDetail({ character }: { character: Character }) {
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, [character.id]);

  return (
    <section className="subscreen detail" aria-labelledby="detail-title">
      <DossierLabel character={character} />
      <h1 id="detail-title" ref={title} tabIndex={-1}>{character.name}</h1>
      <div className="detail__image" role="img" aria-label="Место для изображения персонажа">
        <CharacterPlaceholder />
      </div>
      <section className="detail__materials glass" aria-labelledby="materials-heading">
        <h2 id="materials-heading">Материалы</h2>
        <p>Здесь появятся материалы о персонаже.</p>
      </section>
    </section>
  );
}
