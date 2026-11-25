import { useEffect, useRef } from 'react';
import { CharacterPlaceholder, DossierLabel } from '../components/CharacterCard';
import { Icon } from '../components/Icon';
import type { Character } from '../data/characters';

export function CharacterDetail({ character, hidden, onOpenActivity }: {
  character: Character;
  hidden: boolean;
  onOpenActivity?: () => void;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  const activityButton = useRef<HTMLButtonElement>(null);
  const activityWasOpen = useRef(false);
  const about = character.about ?? [];
  const hasAbout = about.length > 0;
  const activity = character.observation
    ? {
        icon: 'observation' as const,
        title: 'Совпадение',
        description: 'Развивай наблюдательность, концентрацию и скорость зрительного поиска, находя одинаковые символы.',
      }
    : {
        icon: 'strategy' as const,
        title: 'Стратегия',
        description: 'Развивай тактическое мышление, анализируй позиции и находи лучшие шахматные ходы.',
      };

  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, [character.id]);

  useEffect(() => {
    if (!hidden && activityWasOpen.current) activityButton.current?.focus({ preventScroll: true });
    activityWasOpen.current = hidden;
  }, [hidden]);

  return (
    <section className={hasAbout ? 'subscreen detail detail--with-about' : 'subscreen detail'}
      data-theme={character.theme} aria-labelledby="detail-title" hidden={hidden}>
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
      {onOpenActivity && (
        <button type="button" className="detail__strategy glass" ref={activityButton}
          onClick={onOpenActivity} aria-labelledby="activity-card-title" aria-describedby="activity-card-description">
          <span className="detail__strategy-icon" aria-hidden="true"><Icon name={activity.icon} /></span>
          <span className="detail__strategy-copy">
            <strong id="activity-card-title">{activity.title}</strong>
            <span id="activity-card-description">{activity.description}</span>
          </span>
          <Icon name="right" />
        </button>
      )}
      <section className="detail__materials glass" aria-labelledby="materials-heading">
        <h2 id="materials-heading">Материалы</h2>
        <p>Здесь появятся материалы о персонаже.</p>
      </section>
    </section>
  );
}
