import { useEffect, useState } from 'react';
import type { ExerciseImage as Img } from '../../program/types';
import { ChevronIcon, Overlay } from '../kit';

const url = (src: string) => `${import.meta.env.BASE_URL}${src}`;
const LABELS = ['Старт', 'Подъём', 'Опускание'];

/** Один кадр: для карточки пользователя (3 кадра в одной картинке) — нужная треть, для фото из базы — свой файл. */
function Frame({ image, i, className }: { image: Img; i: number; className: string }) {
  return image.frames === 3 ? (
    <div className={`${className} pic`} style={{ backgroundImage: `url(${url(image.src)})`, backgroundPosition: `${i * 50}% 50%` }} />
  ) : (
    <img className={`${className} photo`} src={url(i === 1 ? image.src1 : image.src0)} alt="" loading="lazy" />
  );
}

/** Просмотр кадра на весь экран: листание стрелками и свайпом. */
function Viewer({ image, name, start, onClose }: { image: Img; name: string; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const [touchX, setTouchX] = useState<number | null>(null);
  const go = (d: number) => setI((v) => (v + d + 3) % 3);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => (e.key === 'Escape' ? onClose() : e.key === 'ArrowRight' ? go(1) : e.key === 'ArrowLeft' ? go(-1) : null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <Overlay>
      <div
        className="viewer"
        onClick={onClose}
        onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX === null) return;
          const dx = e.changedTouches[0].clientX - touchX;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          setTouchX(null);
        }}
      >
        <div className="viewer-top" onClick={(e) => e.stopPropagation()}>
          <span className="viewer-title">{name}</span>
          <button className="glass-btn" style={{ width: 40, height: 40 }} aria-label="Закрыть" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="viewer-frame" onClick={(e) => e.stopPropagation()}>
          <Frame image={image} i={i} className="viewer-img" />
          <span className="frame-n big">{i + 1}</span>
          <span className="frame-label big">{LABELS[i]}</span>
        </div>
        <div className="viewer-nav" onClick={(e) => e.stopPropagation()}>
          <button className="glass-btn" style={{ width: 48, height: 48 }} aria-label="Предыдущий кадр" onClick={() => go(-1)}>
            <ChevronIcon dir="left" />
          </button>
          <span className="viewer-dots">
            {[0, 1, 2].map((k) => (
              <span key={k} className={k === i ? 'on' : ''} />
            ))}
          </span>
          <button className="glass-btn" style={{ width: 48, height: 48 }} aria-label="Следующий кадр" onClick={() => go(1)}>
            <ChevronIcon dir="right" />
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/** Три кадра, как на макете. Тап по кадру открывает его на весь экран. Для фото из базы (2 кадра) третий — снова исходное положение. */
export function ExerciseImage({ image, name }: { image: Img; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <div className="ex-img" role="list" aria-label={name}>
        {LABELS.map((label, i) => (
          <button key={label} className="frame" aria-label={`${label}: открыть`} onClick={() => setOpen(i)}>
            <Frame image={image} i={i} className="frame-media" />
            <span className="frame-n">{i + 1}</span>
            <span className="frame-label">{label}</span>
          </button>
        ))}
      </div>
      {open !== null && <Viewer image={image} name={name} start={open} onClose={() => setOpen(null)} />}
    </>
  );
}
