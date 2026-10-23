// Планировщик уведомлений: по одному таймеру на устройство.

const STALE_MS = 60_000; // после перезапуска просроченные меньше чем на минуту ещё отправляем

/**
 * @typedef {{ title: string, body: string }} Payload
 * @typedef {{ deviceId: string, at: number, payload: Payload }} Job
 * @param {{
 *   now: () => number,
 *   setTimer: (fn: () => void, ms: number) => unknown,
 *   clearTimer: (h: unknown) => void,
 *   onFire: (deviceId: string, payload: Payload) => void,
 *   onChange?: (jobs: Job[]) => void,
 * }} deps
 */
export function createScheduler({ now, setTimer, clearTimer, onFire, onChange = () => {} }) {
  /** @type {Map<string, Job & { handle: unknown }>} */
  const jobs = new Map();
  const list = () => [...jobs.values()].map(({ deviceId, at, payload }) => ({ deviceId, at, payload }));

  function drop(deviceId) {
    const j = jobs.get(deviceId);
    if (!j) return false;
    clearTimer(j.handle);
    jobs.delete(deviceId);
    return true;
  }

  function arm(deviceId, at, payload) {
    const handle = setTimer(() => {
      jobs.delete(deviceId);
      onChange(list());
      onFire(deviceId, payload);
    }, Math.max(0, at - now()));
    jobs.set(deviceId, { deviceId, at, payload, handle });
  }

  return {
    list,
    /** Новый отдых заменяет прежний у того же устройства. */
    schedule(deviceId, at, payload) {
      drop(deviceId);
      arm(deviceId, at, payload);
      onChange(list());
    },
    cancel(deviceId) {
      if (drop(deviceId)) onChange(list());
    },
    /** Восстановить таймеры после перезапуска. */
    restore(saved) {
      const t = now();
      for (const j of saved) if (j.at >= t - STALE_MS) arm(j.deviceId, j.at, j.payload);
      onChange(list());
    },
  };
}
