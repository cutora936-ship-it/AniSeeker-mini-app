import type { ReactNode } from 'react';

const designs: readonly { color: string; image: ReactNode }[] = [
  { color: '#ffce63', image: <path d="m12 2 2.9 6.4 7 .8-5.2 4.8 1.4 7-6.1-3.5L5.9 21l1.4-7L2 9.2l7.1-.8Z" /> },
  { color: '#f4ad81', image: <path d="M2.8 9A5.5 5.5 0 0 1 13.5 7h8.3v3h-3v3h-3v-3h-2.3A5.5 5.5 0 0 1 2.8 9Zm3.8 0a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 0 0-3.2 0Z" fillRule="evenodd" /> },
  { color: '#ff934d', image: <path d="m13 2-9 12h6L9 22l11-13h-7l2-7Z" /> },
  { color: '#8de5ed', image: <><path d="M1 12s4-6 11-6 11 6 11 6-4 6-11 6S1 12 1 12Zm7 0a4 4 0 1 0 8 0 4 4 0 0 0-8 0Z" fillRule="evenodd" /><circle cx="12" cy="12" r="1.6" /></> },
  { color: '#fabc70', image: <path d="m2 6 5 4 5-7 5 7 5-4-2 12H4Zm3 14h14v2H5Z" /> },
  { color: '#c2a3ff', image: <><circle cx="12" cy="12" r="6" /><ellipse cx="12" cy="12" rx="11" ry="3.3" transform="rotate(-29 12 12)" fill="none" stroke="currentColor" strokeWidth="1.7" /></> },
  { color: '#fda4b8', image: <path d="M7 2h10v2H7Zm5 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm-1 3v7l4 2 1-2-3-1V8Z" fillRule="evenodd" /> },
  { color: '#9ec5ff', image: <path d="M2 4q5-1 9 2v15q-4-3-9-2Zm20 0q-5-1-9 2v15q4-3 9-2Z" /> },
  { color: '#46e4d8', image: <><path d="m7 3 10 0 5 6-10 13L2 9Z" /><path d="M2 9h20M7 3l2 6 3 13 3-13 2-6" fill="none" stroke="#183c43" strokeWidth="1.3" /></> },
  { color: '#f6d9ff', image: <path d="M18 2a10 10 0 1 0 4 16A9 9 0 0 1 18 2Z" /> },
  { color: '#fb8c9f', image: <><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="m17 6-3 8-7 4 3-8Z" /></> },
  { color: '#eeccff', image: <path d="M3 20 14 9l-2-2L2 20Zm3-4C6 7 11 2 21 2c0 9-5 15-13 15l7-8-1-1Z" /> },
  { color: '#87e899', image: <path d="M22 3C9 1 2 7 5 16l10-8 1 1-11 10-3 3h3l3-4c8 2 14-4 14-15Z" /> },
  { color: '#ff7787', image: <path d="M2 13a10 10 0 0 1 20 0ZM9 15h6l1 5q-4 4-8 0Z" /> },
  { color: '#ffe29d', image: <path d="M5 16V9a7 7 0 0 1 14 0v7l3 3H2Zm4 5h6a3 3 0 0 1-6 0Z" /> },
  { color: '#9ddaf5', image: <path d="M2 6h15v1h2a4 4 0 1 1-.4 8H16a7 7 0 0 1-6 4H8a6 6 0 0 1-6-6Zm15 3v4h2a2 2 0 0 0 0-4ZM3 21h16v2H3Z" fillRule="evenodd" /> },
  { color: '#7bc1ff', image: <path d="M12 2s8 9 8 13a8 8 0 0 1-16 0c0-4 8-13 8-13Zm-4 12c-1 3 1 5 3 5v-1c-1-1-2-2-2-4Z" fillRule="evenodd" /> },
  { color: '#e1e1ff', image: <path d="M6 18a4.5 4.5 0 0 1-1-9 6.5 6.5 0 0 1 12-2 5.5 5.5 0 1 1 .8 11Z" /> },
  { color: '#ef91eb', image: <path d="M2 11a10 10 0 0 1 20 0ZM11 13h2v6a2 2 0 0 0 4 0h2a4 4 0 0 1-8 0Z" /> },
  { color: '#82e1de', image: <path d="M2 17c4 1 4-4 8-4s4 3 7 3l5-2v4l-5 2c-3 0-4-3-7-3s-4 4-8 3Zm0-8c4 1 4-4 8-4s4 3 7 3l5-2v4l-5 2c-3 0-4-3-7-3s-4 4-8 3Z" /> },
  { color: '#fe936f', image: <path d="M4 2h2v3h14l-3 4 3 4H6v9H4Z" /> },
  { color: '#d2e891', image: <path d="M5 2h14v2h-1v2c0 3-2 5-4 6 2 1 4 3 4 6v2h1v2H5v-2h1v-2c0-3 2-5 4-6-2-1-4-3-4-6V4H5Zm3 2v2c0 2 2 4 4 5 2-1 4-3 4-5V4Zm4 10c-2 1-4 2-4 5h8c0-3-2-4-4-5Z" fillRule="evenodd" /> },
  { color: '#fff095', image: <path d="M12 2a7 7 0 0 1 4 13v3H8v-3A7 7 0 0 1 12 2ZM9 20h6l-1 2h-4Z" /> },
  { color: '#b7c8fe', image: <path d="m1 20 8-14 3 5 3-7 8 16ZM9 9l-3 5h5Zm6-2-2 6h6Z" fillRule="evenodd" /> },
];

export function Symbol({ id }: { id: number }) {
  const design = designs[id];
  return <svg viewBox="0 0 24 24" fill="currentColor" style={{ color: design.color }} aria-hidden="true">{design.image}</svg>;
}
