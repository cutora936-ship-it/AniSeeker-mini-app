import ayanokojiThumb from '../assets/kiyotaka-ayanokoji-144.webp';
import ayanokojiMedium from '../assets/kiyotaka-ayanokoji-768.webp';
import ayanokojiLarge from '../assets/kiyotaka-ayanokoji-1254.webp';
import lightYagamiThumb from '../assets/light-yagami-144.webp';
import lightYagamiMedium from '../assets/light-yagami-768.webp';
import lightYagamiLarge from '../assets/light-yagami-1254.webp';

export interface Portrait {
  thumbnail: string;
  medium: string;
  large: string;
}

export type Activity = 'strategy' | 'match' | 'mastermind';

export interface Character {
  id: string;
  dossier: string;
  name: string;
  work: string;
  description: string;
  about?: readonly string[];
  portrait?: Portrait;
  theme?: 'crimson';
  strategy?: boolean;
  observation?: boolean;
  mastermind?: boolean;
}

export const characters: readonly Character[] = [
  {
    id: 'light-yagami',
    dossier: '001',
    name: 'Лайт Ягами',
    work: 'Death Note',
    description: 'Стратегическое и аналитическое мышление.',
    portrait: { thumbnail: lightYagamiThumb, medium: lightYagamiMedium, large: lightYagamiLarge },
    strategy: true,
    mastermind: true,
    about: [
      'Лайт Ягами — главный герой аниме «Тетрадь смерти». Одарённый школьник, обладающий выдающимся интеллектом, аналитическими способностями и стратегическим мышлением.',
      'Его отличает умение анализировать сложные ситуации, выстраивать многоходовые планы и предугадывать действия окружающих. Однако чрезмерная самоуверенность, гордыня и стремление к власти постепенно становятся его главными слабостями.',
      'В этом разделе ты познакомишься с особенностями его мышления, изучишь полезные интеллектуальные техники и научишься применять их на практике.',
    ],
  },
  {
    id: 'kiyotaka-ayanokoji',
    dossier: '002',
    name: 'Киётака Аянокоджи',
    work: 'Класс превосходства',
    description: 'Наблюдательность и анализ поведения людей.',
    portrait: { thumbnail: ayanokojiThumb, medium: ayanokojiMedium, large: ayanokojiLarge },
    theme: 'crimson',
    observation: true,
    about: [
      'Киётака Аянокоджи — главный герой аниме «Класс превосходства». В школе он держится в стороне и скрывает свои способности. Его сильные стороны — наблюдательность, самообладание и умение анализировать поступки людей.',
      'В сложных ситуациях Аянокоджи внимательно следит за тем, что люди говорят и делают. Он сопоставляет детали, замечает противоречия и учитывает, как события могут повлиять на решения окружающих.',
      'Это досье посвящено наблюдательности и анализу поведения. Здесь можно разобраться, как замечать важные детали, отличать факты от догадок и рассматривать несколько объяснений одного поступка.',
    ],
  },
  {
    id: 'mika',
    dossier: '003',
    name: 'Мика',
    work: 'Тестовая карточка',
    description: 'Любопытство и открытость к новому.',
  },
  {
    id: 'sora',
    dossier: '004',
    name: 'Сора',
    work: 'Тестовая карточка',
    description: 'Спокойствие и внимание к окружающим.',
  },
];

export function searchCharacters(collection: readonly Character[], query: string) {
  const words = query.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е').split(/\s+/);

  return collection.filter(({ name }) => {
    const normalizedName = name.toLocaleLowerCase('ru').replaceAll('ё', 'е');
    return words.every((word) => normalizedName.includes(word));
  });
}
