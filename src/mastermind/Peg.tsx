import type { ReactNode } from 'react';

export const palette: readonly { name: string; fill: string; shape: ReactNode }[] = [
  { name: 'Розовый круг', fill: '#fb8fb2', shape: <circle cx="12" cy="12" r="5" /> },
  { name: 'Голубой треугольник', fill: '#85c7ff', shape: <path d="m12 6 6 11H6Z" /> },
  { name: 'Жёлтый квадрат', fill: '#ffda7d', shape: <rect x="7" y="7" width="10" height="10" rx="1.2" /> },
  { name: 'Зелёный ромб', fill: '#83e1a9', shape: <path d="m12 5 7 7-7 7-7-7Z" /> },
  { name: 'Фиолетовый крест', fill: '#c6a6ff', shape: <path d="M12 6v12M6 12h12" /> },
  { name: 'Оранжевая звезда', fill: '#ffac7d', shape: <path d="m12 5 2.1 4.5 4.9.6-3.6 3.5.9 4.9-4.3-2.4L7.7 18.5l.9-4.9L5 10.1l4.9-.6Z" /> },
  { name: 'Бирюзовая волна', fill: '#76e0d8', shape: <path d="M5 13c2.5-6 5.5-6 7 0s4.5 6 7 0" /> },
  { name: 'Белое кольцо', fill: '#f1f1f1', shape: <><circle cx="12" cy="12" r="5.7" /><circle cx="12" cy="12" r="1.15" /></> },
];

export function Peg({ color, label = false }: { color: number; label?: boolean }) {
  const peg = palette[color];
  return (
    <svg className="mastermind-peg" viewBox="0 0 24 24" role={label ? 'img' : undefined}
      aria-label={label ? peg.name : undefined} aria-hidden={label ? undefined : true} focusable="false">
      <rect width="24" height="24" rx="7" fill={peg.fill} />
      <g fill="none" stroke="#19151f" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {peg.shape}
      </g>
    </svg>
  );
}
