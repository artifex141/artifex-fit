import { expect, test } from 'vitest';
import { createPush, urlBase64ToUint8Array } from './push';

function memStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

function fakeFetch() {
  const calls: { url: string; body: unknown }[] = [];
  const fn = async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(null, { status: 204 });
  };
  return { calls, fn: fn as typeof fetch };
}

test('ключ VAPID из base64url в байты', () => {
  expect([...urlBase64ToUint8Array('AQID_-8')]).toEqual([1, 2, 3, 255, 239]);
});

test('выключенный push ничего не отправляет', async () => {
  const f = fakeFetch();
  const p = createPush({ api: 'https://fit.example', storage: memStorage(), fetch: f.fn });
  expect(p.isOn()).toBe(false);
  await p.scheduleRest(1000, 'Отдых окончен', 'Подход 1');
  await p.cancelRest();
  expect(f.calls).toHaveLength(0);
});

test('включённый push: план и отмена отдыха с id устройства', async () => {
  const f = fakeFetch();
  const p = createPush({ api: 'https://fit.example', storage: memStorage({ 'artifex.push': 'on', 'artifex.deviceId': 'dev-1' }), fetch: f.fn });
  await p.scheduleRest(123456, 'Отдых окончен', 'Подход 2 · Жим');
  await p.cancelRest();
  expect(f.calls).toEqual([
    { url: 'https://fit.example/api/rest', body: { deviceId: 'dev-1', at: 123456, title: 'Отдых окончен', body: 'Подход 2 · Жим' } },
    { url: 'https://fit.example/api/rest/cancel', body: { deviceId: 'dev-1' } },
  ]);
});

test('id устройства создаётся один раз и запоминается', () => {
  const s = memStorage();
  const p = createPush({ api: 'x', storage: s, fetch: fakeFetch().fn });
  const id = p.deviceId();
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  expect(p.deviceId()).toBe(id);
});

test('сеть недоступна — тренировка не ломается', async () => {
  const p = createPush({
    api: 'x',
    storage: memStorage({ 'artifex.push': 'on', 'artifex.deviceId': 'd' }),
    fetch: (async () => {
      throw new TypeError('offline');
    }) as typeof fetch,
  });
  await expect(p.scheduleRest(1, 't', 'b')).resolves.toBeUndefined();
});
