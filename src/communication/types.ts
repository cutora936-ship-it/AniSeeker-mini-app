export type Role = 'male' | 'female';
export type Ending = 'understanding' | 'friendship' | 'acquaintance' | 'repair' | 'parting';
export type Skill = 'clarity' | 'listening' | 'boundaries' | 'repair' | 'timing';

export interface Memory {
  topic: string;
  plan: string;
  pause: string;
  conflict: string;
  limit: string;
  intent: string;
}

export type Condition = Partial<Memory>;

export interface Choice {
  text: string;
  reply: string;
  note?: { skill: Skill; text: string; revise: boolean };
  warning?: string;
  changes?: Condition;
  branches?: readonly { when: Condition; next: string }[];
  next: string;
}

export interface Node {
  id: string;
  chapter: number;
  messages: readonly string[];
  remember?: readonly { when: Condition; text: string }[];
  choices: readonly Choice[];
}

export interface Story {
  id: string;
  person: { name: string; avatar: string; detail: string };
  chapters: readonly string[];
  start: string;
  nodes: Readonly<Record<string, Node>>;
  endings: Record<Ending, { title: string; text: string }>;
  conclusions: readonly { when: Condition; ending: Ending }[];
}

export type DraftChoice = Omit<Choice, 'next'>;
export type DraftNode = {
  messages: readonly string[];
  choices: readonly DraftChoice[];
  remember?: Node['remember'];
};
