import { useRef, useState } from 'react';

// Шесть ракурсов из четырёх кадров: стороны «за спиной» — зеркальные копии.
const VIEWS = [
  { src: 'front', flip: false },
  { src: 'three-quarter', flip: false },
  { src: 'side', flip: false },
  { src: 'back', flip: false },
  { src: 'side', flip: true },
  { src: 'three-quarter', flip: true },
];
const STEP_PX = 36; // столько пикселей свайпа — один ракурс

const url = (name: string) => `${import.meta.env.BASE_URL}character/${name}.webp`;

/** Персонаж на светящейся платформе; поворот на 360° свайпом влево-вправо. */
export function CharacterView() {
  const [view, setView] = useState(0);
  const drag = useRef<{ x: number; from: number } | null>(null);

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, from: view };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const steps = Math.round((e.clientX - drag.current.x) / STEP_PX);
    setView((((drag.current.from - steps) % VIEWS.length) + VIEWS.length) % VIEWS.length);
  };
  const onUp = () => {
    drag.current = null;
  };

  return (
    <div className="pf-character" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-label="Персонаж, поверни свайпом">
      {VIEWS.map((v, i) => (
        <img
          key={i}
          src={url(v.src)}
          alt=""
          draggable={false}
          className={i === view ? 'on' : ''}
          style={v.flip ? { transform: 'translateX(-50%) scaleX(-1)' } : undefined}
        />
      ))}
      <svg className="pf-platform" viewBox="0 0 520 90" aria-hidden="true">
        <defs>
          <filter id="pfglow" x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <radialGradient id="pffloor" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#f5c518" stopOpacity="0.16" />
            <stop offset="1" stopColor="#f5c518" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="260" cy="45" rx="250" ry="38" fill="url(#pffloor)" />
        <ellipse cx="260" cy="45" rx="238" ry="30" fill="none" stroke="#f5c518" strokeOpacity="0.7" strokeWidth="6" filter="url(#pfglow)" />
        <ellipse cx="260" cy="45" rx="238" ry="30" fill="none" stroke="#ffd84a" strokeWidth="2.6" />
        <path d="M60 22 q-30 10 -14 30" fill="none" stroke="#f5c518" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M50 46 l-4 7 l8 -1" fill="none" stroke="#f5c518" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M460 22 q30 10 14 30" fill="none" stroke="#f5c518" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M470 46 l4 7 l-8 -1" fill="none" stroke="#f5c518" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="pf-360">
        <span>←</span> 360° <span>→</span>
      </div>
    </div>
  );
}
