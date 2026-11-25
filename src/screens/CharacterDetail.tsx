import { useEffect, useRef } from 'react';
import { CharacterPlaceholder, DossierLabel } from '../components/CharacterCard';
import type { Character } from '../data/characters';

export function CharacterDetail({ character }: { character: Character }) {
  const title = useRef<HTMLHeadingElement>(null);
  const about = character.about ?? [];
  const hasAbout = about.length > 0;

  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, [character.id]);

  return (
    <section className={hasAbout ? 'subscreen detail detail--with-about' : 'subscreen detail'}
      aria-labelledby="detail-title">
      <DossierLabel character={character} />
      <h1 id="detail-title" ref={title} tabIndex={-1}>{character.name}</h1>
      {character.portrait ? (
        <img className="detail__image detail__portrait" src={character.portrait} alt={character.name} />
      ) : (
        <div className="detail__image" role="img" aria-label="Место для изображения персонажа">
          <CharacterPlaceholder />
        </div>
      )}
      {hasAbout && (
        <section className="detail__about glass" aria-labelledby="about-heading">
          <h2 id="about-heading">О персонаже</h2>
          {about.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </section>
      )}
      <section className="detail__materials glass" aria-labelledby="materials-heading">
        <h2 id="materials-heading">Материалы</h2>
        <p>Здесь появятся материалы о персонаже.</p>
      </section>
    </section>
  );
}
