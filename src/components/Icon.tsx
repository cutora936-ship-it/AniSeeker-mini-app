import type { ReactNode } from 'react';

const paths = {
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  home: <><path d="m3 10 8-7a1.5 1.5 0 0 1 2 0l8 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><path d="M9 21v-6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6" /></>,
  bookmark: <path d="M6 3h12a1.5 1.5 0 0 1 1.5 1.5V21l-7.5-5.2L4.5 21V4.5A1.5 1.5 0 0 1 6 3Z" />,
  user: <><circle cx="12" cy="6.6" r="4" /><path d="M3.5 19.1c0-3 2.4-5.1 5.4-5.1h6.2c3 0 5.4 2.1 5.4 5.1 0 1.1-.9 1.9-2 1.9h-13c-1.1 0-2-.8-2-1.9Z" /></>,
  camera: <><path d="M3 8a2 2 0 0 1 2-2h3l1.5-2h5L16 6h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><circle cx="12" cy="13" r="3.5" /></>,
  edit: <><path d="m14.5 5.5 4 4M5 19l4.5-1 10-10a2.8 2.8 0 0 0-4-4l-10 10Z" /><path d="M4 21h16" /></>,
  swipe: <><path d="m4 12 8-6 8 6" /><path d="m4 20 8-6 8 6" opacity=".55" /></>,
  right: <path d="M3.5 12h16m-6.5-6.5L19.5 12 13 18.5" />,
  back: <path d="M20.5 12h-16M11 5.5 4.5 12l6.5 6.5" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.4" /><circle cx="9" cy="9.5" r="1.3" /><path d="m4 16 4-3 3.3 2.1 4.2-4.2 4.8 4.8" /></>,
  strategy: <path d="M6 3v5h3V5h6v3h3V3h3v7l-4 3v5l2 2v1H5v-1l2-2v-5l-4-3V3zM7 18h10" />,
  observation: <><path d="M3 8V4a1 1 0 0 1 1-1h4m8 0h4a1 1 0 0 1 1 1v4m0 8v4a1 1 0 0 1-1 1h-4m-8 0H4a1 1 0 0 1-1-1v-4M5 12s2.4-4 7-4 7 4 7 4-2.4 4-7 4-7-4-7-4Z" /><circle cx="12" cy="12" r="1.65" /></>,
  hint: <><path d="M9 18v-2.3a5.5 5.5 0 1 1 6 0V18m-6 0h6m-5 3h4" /><path d="M12 2V1.5M3.5 5.5l1 1m15-1-1 1" /></>,
  restart: <><path d="M4 10a8 8 0 1 1 1.7 7.5M4 5v5h5" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}
