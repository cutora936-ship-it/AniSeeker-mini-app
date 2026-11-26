import type { Choice, Condition, Ending, Memory, Role, Skill, Story } from './types';

export const skills: Record<Skill, string> = {
  clarity: 'Ясность общения',
  listening: 'Умение слушать',
  boundaries: 'Личные границы',
  repair: 'Разрешение недопонимания',
  timing: 'Уместность ответа',
};

export interface Decision {
  node: string;
  choice: number;
  at: number;
}

export interface Run {
  role: Role;
  started: number;
  decisions: Decision[];
  // The destination chapter stays closed until the player leaves the recap.
  openedChapter: number;
  finished: boolean;
}

export interface Message {
  by: 'partner' | 'player';
  text: string;
  at: number;
  chapter: number;
}

const initialMemory: Memory = { topic: '', plan: 'none', pause: '', conflict: '', limit: '', intent: '' };

function matches(memory: Memory, when: Condition) {
  return (Object.keys(when) as (keyof Memory)[]).every((key) => memory[key] === when[key]);
}

export function chooseEnding(story: Story, memory: Memory): Ending {
  return story.conclusions.find(({ when }) => matches(memory, when))?.ending ?? 'acquaintance';
}

export function newRun(role: Role, at = Date.now()): Run {
  return { role, started: at, decisions: [], openedChapter: 0, finished: false };
}

export function replay(story: Story, run: Run) {
  let nodeId = story.start;
  let memory = { ...initialMemory };
  const history: Message[] = [];
  const chosen: { node: string; chapter: number; choice: Choice }[] = [];
  let guide = 0;
  let time = run.started;

  function enter(id: string, at: number) {
    const node = story.nodes[id];
    if (!node || node.chapter > run.openedChapter) return;
    const callbacks = node.remember?.filter(({ when }) => matches(memory, when)).map(({ text }) => text) ?? [];
    for (const text of [...callbacks, ...node.messages]) {
      history.push({ by: 'partner', text, at, chapter: node.chapter });
    }
  }

  enter(nodeId, time);
  for (const decision of run.decisions) {
    const node = story.nodes[nodeId];
    if (decision.node !== nodeId || !node || node.chapter > run.openedChapter) break;
    const choice = node.choices[decision.choice];
    if (!choice) break;
    time = decision.at;
    history.push({ by: 'player', text: choice.text, at: time, chapter: node.chapter });
    guide = history.length;
    history.push({ by: 'partner', text: choice.reply, at: time, chapter: node.chapter });
    chosen.push({ node: nodeId, chapter: node.chapter, choice });
    memory = { ...memory, ...choice.changes };
    nodeId = choice.branches?.find(({ when }) => matches(memory, when))?.next ?? choice.next;
    enter(nodeId, time);
  }

  const next = story.nodes[nodeId];
  // When resuming a chapter from the recap, only play that chapter's introduction.
  if (next && next.chapter === run.openedChapter && chosen.length && chosen.at(-1)!.chapter < next.chapter) {
    guide = history.findIndex((message) => message.chapter === next.chapter);
  }
  const gate = next?.chapter !== run.openedChapter;
  return {
    next, history, chosen, memory, guide, gate,
    ending: nodeId === 'ending' ? chooseEnding(story, memory) : undefined,
  };
}

export function takeChoice(story: Story, run: Run, choice: number, at = Date.now()): Run {
  const state = replay(story, run);
  if (run.finished || state.gate || !state.next?.choices[choice]) return run;
  return { ...run, decisions: [...run.decisions, { node: state.next.id, choice, at }] };
}
