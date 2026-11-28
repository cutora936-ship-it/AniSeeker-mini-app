import type { UserStorage } from '../account/storage';
import { Icon } from '../components/Icon';
import { characters, type Activity, type Character } from '../data/characters';
import { activityCards } from './activities';
import { latestTraining } from './storage';
import './ContinueTraining.css';

export function ContinueTraining({ storage, onResume }: {
  storage: UserStorage;
  onResume: (character: Character, activity: Activity) => void;
}) {
  const saved = latestTraining(storage);
  const card = activityCards.find(({ id }) => id === saved?.activity);
  const character = card && characters.find((entry) => entry[card.flag]);
  if (!saved || !card || !character) return null;
  const { progress } = saved;
  return (
    <section className="continue-training" aria-labelledby="continue-training-title">
      <h2 id="continue-training-title">Продолжить тренировку</h2>
      <div className="continue-training__card surface" data-theme={character.theme}>
        <div className="continue-training__identity">
          <span className="detail__strategy-icon"><Icon name={card.icon} /></span>
          <div>
            <h3>{card.title}</h3>
            <p>{character.name}{progress.difficulty && <> · {progress.difficulty}</>}</p>
          </div>
        </div>
        <div className="continue-training__progress">
          <p>{progress.label}</p>
          <progress aria-label="Прогресс тренировки" value={progress.value} max={progress.total} />
        </div>
        <button type="button" className="profile-action profile-action--primary" onClick={() => onResume(character, card.id)}>
          Продолжить <Icon name="right" />
        </button>
      </div>
    </section>
  );
}
