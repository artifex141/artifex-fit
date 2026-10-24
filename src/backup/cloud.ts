// Облачная копия на fit.artifex.mobi: данные телефона (тренировки, питание, профиль) уходят на сервер,
// чтобы их можно было вернуть, если iPhone очистит хранилище сайта или приложение переустановят.
import { exportAll, importAll } from '../db/repo';
import { push } from '../push/push';

interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const HASH = 'artifex.backupHash';
const AT = 'artifex.backupAt';
const OFFLINE = 'Нет связи с сервером';

/** FNV-1a: отличить «данные изменились» от «нет»; время экспорта не учитываем. */
function hash(json: string): string {
  const s = json.replace(/"exportedAt":"[^"]*",?/, '');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36) + s.length;
}

export function createCloud(deps: {
  api: string;
  storage: KV;
  fetch: typeof globalThis.fetch;
  deviceId: () => string;
  setDeviceId: (id: string) => void;
  exportAll: () => Promise<string>;
  importAll: (json: string) => Promise<void>;
}) {
  const { api, storage, deviceId } = deps;
  return {
    lastSaved: () => Number(storage.getItem(AT)) || null,

    /** Отправить копию, если данные изменились с прошлой отправки (force — всё равно). */
    async sync(force = false): Promise<{ ok: true; savedAt: number } | { skipped: true } | { error: string }> {
      const data = await deps.exportAll();
      const h = hash(data);
      if (!force && storage.getItem(HASH) === h) return { skipped: true };
      try {
        const r = await deps.fetch(`${api}/api/backup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceId: deviceId(), data }) });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) return { error: body.error ?? `Сервер ответил ${r.status}` };
        storage.setItem(HASH, h);
        storage.setItem(AT, String(body.savedAt));
        return { ok: true, savedAt: body.savedAt };
      } catch {
        return { error: OFFLINE };
      }
    },

    /** Вернуть данные из копии устройства id и сделать этот ID текущим (замеры Zepp и «Команды» снова совпадут). */
    async restore(id: string): Promise<{ ok: true; savedAt: number } | { error: string }> {
      let b: { savedAt?: number; data?: string; error?: string };
      try {
        const r = await deps.fetch(`${api}/api/backup?deviceId=${encodeURIComponent(id)}`);
        b = await r.json().catch(() => ({}));
        if (!r.ok || typeof b.data !== 'string') return { error: b.error ?? `Сервер ответил ${r.status}` };
      } catch {
        return { error: OFFLINE };
      }
      await deps.importAll(b.data);
      deps.setDeviceId(id);
      storage.setItem(HASH, hash(b.data));
      storage.setItem(AT, String(b.savedAt));
      return { ok: true, savedAt: b.savedAt! };
    },
  };
}

const safeStorage: KV = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* приватный режим */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* приватный режим */
    }
  },
};

export const cloud = createCloud({
  api: import.meta.env.VITE_PUSH_API ?? 'https://fit.artifex.mobi',
  storage: safeStorage,
  fetch: (...a) => fetch(...a),
  deviceId: () => push.deviceId(),
  setDeviceId: (id) => push.setDeviceId(id),
  exportAll,
  importAll,
});
