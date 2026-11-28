import { useEffect, useRef } from 'react';
import { CharacterPlaceholder, DossierLabel } from '../components/CharacterCard';
import { CharacterPortrait } from '../components/CharacterPortrait';
import { Icon, type IconName } from '../components/Icon';
import type { Activity, Character } from '../data/characters';

const activityCards: readonly {
  id: Activity;
  flag: 'strategy' | 'observation' | 'mastermind' | 'bodyLanguage' | 'communication' | 'stroop';
  icon: IconName;
  title: string;
  description: string;
}[] = [
  { id: 'strategy', flag: 'strategy', icon: 'strategy', title: 'Стратегия',
    description: 'Развивай тактическое мышление, анализируй позиции и находи лучшие шахматные ходы.' },
  { id: 'mastermind', flag: 'mastermind', icon: 'mastermind', title: 'Аналитическое мышление',
    description: 'Расшифровывай секретные комбинации, анализируй подсказки и исключай невозможные варианты.' },
  { id: 'match', flag: 'observation', icon: 'observation', title: 'Совпадение',
    description: 'Развивай наблюдательность, концентрацию и скорость зрительного поиска, находя одинаковые символы.' },
  { id: 'body-language', flag: 'bodyLanguage', icon: 'bodyLanguage', title: 'Язык тела',
    description: 'Изучай жесты, мимику и невербальные сигналы, чтобы лучше понимать человеческое поведение.' },
  { id: 'stroop', flag: 'stroop', icon: 'stroop', title: 'Конфликт восприятия',
    description: 'Развивай концентрацию, скорость реакции и способность контролировать автоматические ответы.' },
  { id: 'communication', flag: 'communication', icon: 'chat', title: 'Искусство общения',
    description: 'Развивай навыки общения, принимай решения и наблюдай, как твои ответы меняют ход истории.' },
];

export function CharacterDetail({ character, hidden, onOpenActivity }: {
  character: Character;
  hidden: boolean;
  onOpenActivity: (activity: Activity) => void;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  const activityButton = useRef<HTMLButtonElement>(null);
  const activityWasOpen = useRef(false);
  const about = character.about ?? [];
  const hasAbout = about.length > 0;

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
        <CharacterPortrait className="detail__image detail__portrait" portrait={character.portrait}
          variant="dossier" alt={character.name} priority />
      ) : (
        <div className="detail__image" role="img" aria-label="Место для изображения персонажа">
          <CharacterPlaceholder />
        </div>
      )}
      {hasAbout && (
        <section className="detail__about surface" aria-labelledby="about-heading">
          <h2 id="about-heading">О персонаже</h2>
          {about.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </section>
      )}
      {activityCards.filter(({ flag }) => character[flag]).map((activity) => (
        <button key={activity.id} type="button" className="detail__strategy surface"
          onClick={(event) => {
            activityButton.current = event.currentTarget;
            onOpenActivity(activity.id);
          }}
          aria-labelledby={`activity-${activity.id}-title`} aria-describedby={`activity-${activity.id}-description`}>
          <span className="detail__strategy-icon" aria-hidden="true"><Icon name={activity.icon} /></span>
          <span className="detail__strategy-copy">
            <strong id={`activity-${activity.id}-title`}>{activity.title}</strong>
            <span id={`activity-${activity.id}-description`}>{activity.description}</span>
          </span>
          <Icon name="right" />
        </button>
      ))}
      <section className="detail__materials surface" aria-labelledby="materials-heading">
        <h2 id="materials-heading">Материалы</h2>
        <p>Здесь появятся материалы о персонаже.</p>
      </section>
    </section>
  );
}
