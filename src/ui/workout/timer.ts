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
