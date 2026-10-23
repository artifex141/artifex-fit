/** Сколько секунд отдыха осталось; считается от времени старта, поэтому переживает блокировку экрана. */
export function remainingSec(startedAt: number, durationSec: number, now: number): number {
  return Math.max(0, Math.ceil(durationSec - (now - startedAt) / 1000));
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatClock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Время тренировки: всегда ЧЧ:ММ:СС. */
export function formatHMS(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Отдых после подхода setKey («упражнение:номер»); pausedLeft — остаток, если на паузе. */
export interface RestState {
  startedAt: number;
  duration: number;
  setKey: string;
  label?: string; // текст push-уведомления о конце отдыха
  pausedLeft?: number;
}

export function restLeft(r: RestState, now: number): number {
  return r.pausedLeft ?? remainingSec(r.startedAt, r.duration, now);
}

export function pauseRest(r: RestState, now: number): RestState {
  return { ...r, pausedLeft: restLeft(r, now) };
}

export function resumeRest(r: RestState, now: number): RestState {
  return { startedAt: now, duration: r.pausedLeft ?? restLeft(r, now), setKey: r.setKey, label: r.label };
}
