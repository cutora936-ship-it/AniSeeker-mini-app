import type { Condition, DraftChoice, DraftNode, Skill, Story } from '../../communication/types';

export const chapters = [
  'Неожиданное сообщение', 'Первое впечатление', 'Общие интересы', 'Неловкая пауза', 'Неудачная шутка',
  'Недопонимание', 'Разные взгляды', 'Личные границы', 'Сложный разговор', 'Финал истории',
];

export function choice(
  text: string, reply: string, changes?: Condition,
  note?: [Skill, string, 'revise'?], warning?: string,
): DraftChoice {
  return { text, reply, changes, warning, note: note && { skill: note[0], text: note[1], revise: note[2] === 'revise' } };
}

export function beat(message: string | readonly string[], ...choices: DraftChoice[]): DraftNode {
  return { messages: typeof message === 'string' ? [message] : message, choices };
}

export function remember(node: DraftNode, ...lines: NonNullable<DraftNode['remember']>): DraftNode {
  return { ...node, remember: lines };
}

export const conclusions: Story['conclusions'] = [
  { when: { intent: 'end' }, ending: 'parting' },
  { when: { conflict: 'open', plan: 'none' }, ending: 'parting' },
  { when: { conflict: 'open' }, ending: 'acquaintance' },
  { when: { intent: 'casual' }, ending: 'acquaintance' },
  { when: { conflict: 'resolved' }, ending: 'repair' },
  { when: { intent: 'friends', plan: 'shared' }, ending: 'friendship' },
  { when: { intent: 'understand' }, ending: 'understanding' },
  { when: {}, ending: 'acquaintance' },
];

export function assemble(
  id: string, person: Story['person'], data: readonly (readonly DraftNode[])[], endings: Story['endings'],
  extra: readonly { chapter: number; id: string; continueAt: string; node: DraftNode }[],
): Story {
  const beats = data.flatMap((nodes, chapter) =>
    nodes.map((node, index) => ({ node, chapter, id: `${chapter + 1}.${index + 1}` })),
  );
  const nodes = Object.fromEntries([
    ...beats.map(({ node, chapter, id: nodeId }, index) => [nodeId, {
      ...node, id: nodeId, chapter,
      choices: node.choices.map((choice) => ({ ...choice, next: beats[index + 1]?.id ?? 'ending' })),
    }] as const),
    ...extra.map(({ node, chapter, id: nodeId, continueAt }) => [nodeId, {
      ...node, id: nodeId, chapter, choices: node.choices.map((choice) => ({ ...choice, next: continueAt })),
    }] as const),
  ]);
  return { id, person, chapters, start: beats[0].id, nodes, endings, conclusions };
}

export function compose(
  id: string, person: Story['person'], titles: readonly string[],
  data: Parameters<typeof assemble>[2], endings: Story['endings'], extra: Parameters<typeof assemble>[4],
): Story {
  return { ...assemble(id, person, data, endings, extra), chapters: titles };
}
