import { useCallback, useEffect, useRef, useState } from 'react';
import { useNow } from '../useNow';
import { formatClock, remainingSec } from './timer';

interface RestState {
  startedAt: number;
  duration: number;
}

const KEY = 'artifex.rest';

function load(): RestState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RestState) : null;
  } catch {
    return null;
  }
}

function save(s: RestState | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* хранилище недоступно — таймер работает до перезагрузки */
  }
}

let audio: AudioContext | null = null;

/** Короткий сигнал. AudioContext создаётся по жесту пользователя (в start), иначе iOS его не запустит. */
function beep() {
  if (!audio || document.visibilityState !== 'visible') return;
  const t = audio.currentTime;
  for (const [i, f] of [880, 1320].entries()) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.25, t + i * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.18 + 0.16);
    osc.connect(gain).connect(audio.destination);
    osc.start(t + i * 0.18);
    osc.stop(t + i * 0.18 + 0.17);
  }
  navigator.vibrate?.(300);
}

export function useRestTimer() {
  const [state, setState] = useState<RestState | null>(load);
  const start = useCallback((duration: number) => {
    try {
      audio ??= new AudioContext();
      void audio.resume();
    } catch {
      audio = null;
    }
    const s = { startedAt: Date.now(), duration };
    save(s);
    setState(s);
  }, []);
  const stop = useCallback(() => {
    save(null);
    setState(null);
  }, []);
  const add = useCallback((sec: number) => {
    setState((s) => {
      if (!s) return s;
      const next = { ...s, duration: s.duration + sec };
      save(next);
      return next;
    });
  }, []);
  return { state, start, stop, add };
}

export function RestTimer({ state, onStop, onAdd }: { state: RestState | null; onStop: () => void; onAdd: (s: number) => void }) {
  const now = useNow(250);
  const left = state ? remainingSec(state.startedAt, state.duration, now) : 0;
  const prevLeft = useRef(left);

  useEffect(() => {
    if (prevLeft.current > 0 && left === 0 && state) beep();
    prevLeft.current = left;
  }, [left, state]);

  // Через 5 с после окончания панель скрывается сама.
  useEffect(() => {
    if (state && left === 0 && now - (state.startedAt + state.duration * 1000) > 5000) onStop();
  }, [state, left, now, onStop]);

  if (!state) return null;
  const R = 26;
  const C = 2 * Math.PI * R;
  const frac = state.duration ? left / state.duration : 0;

  return (
    <div className={left === 0 ? 'rest done' : 'rest'}>
      <svg viewBox="0 0 64 64" className="rest-ring">
        <circle cx="32" cy="32" r={R} stroke="var(--line)" strokeWidth="6" fill="none" />
        <circle
          cx="32" cy="32" r={R} stroke="var(--accent)" strokeWidth="6" fill="none" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 32 32)"
        />
      </svg>
      <div className="rest-text">
        <div className="rest-label">{left === 0 ? 'Отдых окончен' : 'Отдых'}</div>
        <div className="rest-clock">{formatClock(left)}</div>
      </div>
      <div className="spacer" />
      {left > 0 && (
        <button className="btn" onClick={() => onAdd(30)}>
          +30 с
        </button>
      )}
      <button className="btn" onClick={onStop}>
        {left === 0 ? 'OK' : 'Стоп'}
      </button>
    </div>
  );
}
