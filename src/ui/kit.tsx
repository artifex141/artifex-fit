// Общие элементы макета: номер в круге с жёлтой дугой подсветки, стеклянная круглая кнопка.
import { useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Номер в тёмном круге. active — жёлтая светящаяся дуга слева, как «1» и «2» на макете. */
export function NumRing({ n, active, size = 40 }: { n: ReactNode; active?: boolean; size?: number }) {
  const id = `ng${useId().replace(/:/g, '')}`;
  return (
    <span className={active ? 'num-ring on' : 'num-ring'} style={{ width: size, height: size, fontSize: size * 0.44 }}>
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#f5c518" stopOpacity="0" />
            <stop offset="0.35" stopColor="#f5c518" />
            <stop offset="0.75" stopColor="#ffd84a" />
            <stop offset="1" stopColor="#f5c518" stopOpacity="0" />
          </linearGradient>
          <filter id={`${id}f`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>
        <circle cx="20" cy="20" r="18.5" className="num-ring-track" />
        {active && <path d="M 9 34 A 18.5 18.5 0 0 1 26 2.5" className="num-ring-arc" stroke={`url(#${id})`} style={{ strokeWidth: 3.4 }} opacity="0.7" filter={`url(#${id}f)`} />}
        {active && <path d="M 9 34 A 18.5 18.5 0 0 1 26 2.5" className="num-ring-arc" stroke={`url(#${id})`} />}
      </svg>
      <span className="num-ring-n">{n}</span>
    </span>
  );
}

/**
 * Окно поверх всего приложения. Рендерится прямо в body: на iPhone прокручиваемый <main> создаёт свой слой,
 * и fixed-окна внутри него оказываются под нижним меню, какой бы z-index у них ни был.
 */
export function Overlay({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

export function GlassButton({ children, label, onClick, className = '', size = 40 }: { children: ReactNode; label: string; onClick?: () => void; className?: string; size?: number }) {
  return (
    <button className={`glass-btn ${className}`} style={{ width: size, height: size }} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

export const ChevronIcon = ({ dir }: { dir: 'up' | 'down' | 'right' | 'left' }) => {
  const d = { up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6', right: 'M9 6l6 6-6 6', left: 'M15 6l-6 6 6 6' }[dir];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
};

export const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
