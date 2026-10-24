// Push-уведомление о конце отдыха через сервер fit.artifex.mobi (server/).
// Работает только в приложении, установленном на экран «Домой» (iOS 16.4+), после разрешения уведомлений.

interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export type EnableResult = 'on' | 'denied' | 'unsupported' | 'error';

const ON = 'artifex.push';
const DEVICE = 'artifex.deviceId';

export function urlBase64ToUint8Array(s: string): Uint8Array {
  const b64 = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function createPush({ api, storage, fetch: f }: { api: string; storage: KV; fetch: typeof fetch }) {
  const deviceId = () => {
    let id = storage.getItem(DEVICE);
    if (!id) {
      id = crypto.randomUUID();
      storage.setItem(DEVICE, id);
    }
    return id;
  };
  const isOn = () => storage.getItem(ON) === 'on';

  /** Запрос «в фоне»: ошибки сети не должны мешать тренировке. */
  const post = async (path: string, body: object) => {
    try {
      await f(`${api}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true });
    } catch {
      /* без сети уведомления не будет — звук в приложении всё равно сработает */
    }
  };

  return {
    deviceId,
    /** Вернуть прежний ID (после очистки хранилища): замеры Zepp и копии на сервере привязаны к нему. */
    setDeviceId(id: string) {
      storage.setItem(DEVICE, id.trim());
      storage.removeItem(ON); // подписка на уведомления была у старого хранилища — включить заново
    },
    isOn,
    async scheduleRest(at: number, title: string, body: string) {
      if (isOn()) await post('/api/rest', { deviceId: deviceId(), at, title, body });
    },
    async cancelRest() {
      if (isOn()) await post('/api/rest/cancel', { deviceId: deviceId() });
    },
    /** Разрешение, подписка в service worker и регистрация на сервере. Вызывать по нажатию кнопки. */
    async enable(): Promise<EnableResult> {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
      if ((await Notification.requestPermission()) !== 'granted') return 'denied';
      try {
        const reg = await navigator.serviceWorker.ready;
        const { publicKey } = await (await f(`${api}/api/vapid`)).json();
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
        const r = await f(`${api}/api/subscribe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceId: deviceId(), subscription: sub.toJSON() }) });
        if (!r.ok) return 'error';
        storage.setItem(ON, 'on');
        return 'on';
      } catch {
        return 'error';
      }
    },
    disable() {
      storage.removeItem(ON);
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

export const push = createPush({
  api: import.meta.env.VITE_PUSH_API ?? 'https://fit.artifex.mobi',
  storage: safeStorage,
  fetch: (...a) => fetch(...a),
});
