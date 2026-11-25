export const roundsPerGame = 10;
export const symbolNames = [
  'Звезда', 'Ключ', 'Молния', 'Глаз', 'Корона', 'Планета', 'Часы', 'Книга',
  'Кристалл', 'Луна', 'Компас', 'Перо', 'Лист', 'Гриб', 'Колокол', 'Чашка',
  'Капля', 'Облако', 'Зонт', 'Волна', 'Флажок', 'Песочные часы', 'Лампа', 'Гора',
] as const;

export interface SymbolPlacement {
  id: number;
  x: number;
  y: number;
  angle: number;
  scale: number;
}

export interface MatchRound {
  common: number;
  cards: readonly [readonly SymbolPlacement[], readonly SymbolPlacement[]];
}

// The seven outer targets are equally spaced. With a radius of at least 32%
// and targets of 22% of the diameter, both the ring and center stay clear.
function place(ids: number[], random: () => number) {
  const offset = random() * Math.PI * 2;
  return shuffle(ids, random).map((id, index) => {
    const theta = offset + (index - 1) * Math.PI * 2 / 7;
    const radius = index === 0 ? 0 : 32 + random() * 2.5;
    return {
      id,
      x: 50 + Math.cos(theta) * radius,
      y: 50 + Math.sin(theta) * radius,
      angle: -42 + random() * 84,
      scale: .71 + random() * .24,
    };
  });
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let index = items.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

export function makeRound(random: () => number = Math.random): MatchRound {
  const [common, ...others] = shuffle(symbolNames.map((_, id) => id), random);
  return {
    common,
    cards: [place([common, ...others.slice(0, 7)], random), place([common, ...others.slice(7, 14)], random)],
  };
}
