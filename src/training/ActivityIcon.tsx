import bodyLanguage from '../assets/training/body-language.webp?no-inline';
import communication from '../assets/training/communication.webp?no-inline';
import mastermind from '../assets/training/mastermind.webp?no-inline';
import match from '../assets/training/match.webp?no-inline';
import strategy from '../assets/training/strategy.webp?no-inline';
import stroop from '../assets/training/stroop.webp?no-inline';
import type { Activity } from '../data/characters';
import './ActivityIcon.css';

const icons: Record<Activity, string> = {
  'body-language': bodyLanguage,
  communication,
  mastermind,
  match,
  strategy,
  stroop,
};

export function ActivityIcon({ activity }: { activity: Activity }) {
  return (
    <img className="activity-icon" src={icons[activity]} alt="" width={192} height={192}
      loading="lazy" decoding="async" />
  );
}
