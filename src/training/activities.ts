import type { IconName } from '../components/Icon';
import type { Activity } from '../data/characters';

export const activityCards: readonly {
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
