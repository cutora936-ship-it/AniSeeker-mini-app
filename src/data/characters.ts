export interface Character {
  id: string;
  dossier: string;
  name: string;
  work: string;
  description: string;
  about?: readonly string[];
}

export const characters: readonly Character[] = [
  {
    id: 'light-yagami',
    dossier: '001',
    name: 'Лайт Ягами',
    work: 'Death Note',
    description: 'Стратегическое и аналитическое мышление.',
    about: [
      'Лайт Ягами — главный герой аниме «Тетрадь смерти». Одарённый школьник, обладающий выдающимся интеллектом, аналитическими способностями и стратегическим мышлением.',
      'Его отличает умение анализировать сложные ситуации, выстраивать многоходовые планы и предугадывать действия окружающих. Однако чрезмерная самоуверенность, гордыня и стремление к власти постепенно становятся его главными слабостями.',
      'В этом разделе ты познакомишься с особенностями его мышления, изучишь полезные интеллектуальные техники и научишься применять их на практике.',
    ],
  },
  {
    id: 'ren',
    dossier: '002',
    name: 'Рэн',
    work: 'Тестовая карточка',
    description: 'Замечает детали и умеет слушать.',
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
