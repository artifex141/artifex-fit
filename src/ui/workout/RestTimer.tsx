import { useCallback, useEffect, useRef, useState } from 'react';
import { useNow } from '../useNow';
import { playBeep, unlockSound } from './sound';
import { pauseRest, restLeft, resumeRest, type RestState } from './timer';

const KEY = 'artifex.rest';

function load(): RestState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RestState) : null;
  } catch {
    return null;
  }
}

function persist(s: RestState | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* хранилище недоступно — таймер работает до перезагрузки */
  }
}

/** Отдых между подходами: старт по ✓, пауза, сигнал в конце. Отображается в строке подхода. */
export function useRestTimer() {
  const [state, setState] = useState<RestState | null>(load);
  const now = useNow(250);
  const left = state ? restLeft(state, now) : 0;

  const set = useCallback((s: RestState | null) => {
    persist(s);
    setState(s);
  }, []);

  /** Вызывать синхронно в обработчике нажатия: так iOS разрешит звук. */
  const start = useCallback(
    (setKey: string, duration: number) => {
      unlockSound();
      set({ startedAt: Date.now(), duration, setKey });
    },
    [set],
  );
  const stop = useCallback(() => set(null), [set]);
  const toggle = useCallback(() => {
    if (!state) return;
    set(state.pausedLeft === undefined ? pauseRest(state, Date.now()) : resumeRest(state, Date.now()));
  }, [state, set]);

  // Сигнал при переходе через ноль, затем таймер исчезает из строки.
  const prev = useRef(left);
  useEffect(() => {
    if (state && prev.current > 0 && left === 0) {
      playBeep();
      set(null);
    }
    prev.current = left;
  }, [left, state, set]);

  return { state, left, start, stop, toggle };
}
