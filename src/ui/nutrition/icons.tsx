// Иконки экрана «Питание» (24×24), нарисованы по макету.
import type { ReactNode } from 'react';

const Svg = ({ children, fill }: { children: ReactNode; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const FlameIcon = () => (
  <Svg fill>
    <path d="M12 1.8c.8 3.6 5.4 5.8 5.4 11.4a5.4 5.4 0 0 1-10.8 0c0-2.7 1.3-4.4 2.7-5.6.2 2 1 3.2 2.3 3.6-.6-3.3-.3-6.6.4-9.4z" />
    <path d="M12 21c-1.7 0-2.8-1.2-2.8-2.8 0-1.5.9-2.4 1.8-3.2.1 1 .6 1.6 1.2 1.8-.2-1.3 0-2.6.5-3.6 1 1.6 2.1 2.8 2.1 5 0 1.6-1.1 2.8-2.8 2.8z" fill="#2a2104" />
  </Svg>
);

export const ProteinIcon = () => (
  <Svg>
    <path d="M4.6 12.4C3.4 9.3 6 6.2 9.3 6.8c1.6-1.7 5-1.9 6.6.3 3 .3 4.4 3.6 3 6.2-.7 3.4-4.2 5.4-7.6 4.3-3.1 1-5.9-1.3-6.7-5.2z" />
    <path d="M8.4 11.6c1.6-1.2 3.6-1 5 .6 1 1 2.6 1 3.6-.1M8.6 14.8c1.4.4 2.6.1 3.6-.8" />
  </Svg>
);

export const DropIcon = () => (
  <Svg>
    <path d="M12 3c3 4 6.2 7.6 6.2 11.2a6.2 6.2 0 0 1-12.4 0C5.8 10.6 9 7 12 3z" />
  </Svg>
);

export const WheatIcon = () => (
  <Svg fill>
    <path d="M11.3 8h1.4v13.5h-1.4z" />
    <path d="M12 8.6C10 7.6 9.4 5.6 10 3.4c2 1 2.6 3 2 5.2zM12 8.6c2-1 2.6-3 2-5.2-2 1-2.6 3-2 5.2z" />
    <path d="M12 13.2c-2.6 0-4.3-1.5-4.8-3.7 2.6 0 4.3 1.5 4.8 3.7zM12 13.2c2.6 0 4.3-1.5 4.8-3.7-2.6 0-4.3 1.5-4.8 3.7z" />
    <path d="M12 17.8c-2.6 0-4.3-1.5-4.8-3.7 2.6 0 4.3 1.5 4.8 3.7zM12 17.8c2.6 0 4.3-1.5 4.8-3.7-2.6 0-4.3 1.5-4.8 3.7z" />
  </Svg>
);

export const SunIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" strokeWidth="2" />
  </Svg>
);

export const MoonIcon = () => (
  <Svg fill>
    <path d="M19.5 15.2A8.2 8.2 0 1 1 9.3 3.6a7 7 0 0 0 10.2 11.6z" />
  </Svg>
);

export const CupIcon = () => (
  <Svg fill>
    <path d="M3.8 6.5h13.4v5.8a6 6 0 0 1-6 6H9.8a6 6 0 0 1-6-6V6.5z" />
    <path d="M17 8.4h1.4a2.9 2.9 0 0 1 0 5.8H16.6" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M3 20.4h15.2" fill="none" stroke="currentColor" strokeWidth="2" />
  </Svg>
);

export const CalendarIcon = () => (
  <Svg>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 9.6h17M8 3v4M16 3v4" />
    <path d="M8 13h.01M12 13h.01M16 13h.01M8 16.6h.01M12 16.6h.01" strokeWidth="2.4" />
  </Svg>
);

export const DotsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);

export const PlusIcon = () => (
  <Svg>
    <path d="M12 5v14M5 12h14" strokeWidth="2.2" />
  </Svg>
);

export const MinusIcon = () => (
  <Svg>
    <path d="M5 12h14" strokeWidth="2.2" />
  </Svg>
);

export const SearchIcon = () => (
  <Svg>
    <circle cx="11" cy="11" r="6.5" strokeWidth="2" />
    <path d="M16 16l4.2 4.2" strokeWidth="2" />
  </Svg>
);

export const ScanIcon = () => (
  <Svg>
    <path d="M3.5 8V5.5a2 2 0 0 1 2-2H8M16 3.5h2.5a2 2 0 0 1 2 2V8M20.5 16v2.5a2 2 0 0 1-2 2H16M8 20.5H5.5a2 2 0 0 1-2-2V16" />
    <path d="M7.5 8v8M10 8v8M12.8 8v8M15 8v8M17 8v8" strokeWidth="1.5" />
  </Svg>
);

export const HistoryIcon = () => (
  <Svg>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" strokeWidth="2" />
    <path d="M20.2 3.8v3.6h-3.6" strokeWidth="2" />
    <path d="M12 7.8V12l2.8 2" strokeWidth="2" />
  </Svg>
);

export const PlateIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4.6" />
  </Svg>
);
