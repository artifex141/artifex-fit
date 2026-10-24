import { expect, test, vi } from 'vitest';
import { createCloud } from './cloud';

function setup(data = '{"version":1,"exportedAt":"2026-10-24T10:00:00Z","workouts":[1]}') {
  const mem = new Map<string, string>();
  const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  let id = 'dev-new-0001';
  const state = { data, imported: '' as string };
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return Response.json({ ok: true, savedAt: 1000 });
    if (url.includes('deviceId=dev-old-0001')) return Response.json({ savedAt: 900, data: '{"version":1,"workouts":[7]}' });
    return Response.json({ error: 'Копии для этого ID нет' }, { status: 404 });
  });
  const cloud = createCloud({
    api: 'https://api.test',
    storage,
    fetch: fetch as unknown as typeof globalThis.fetch,
    deviceId: () => id,
    setDeviceId: (v) => void (id = v),
    exportAll: async () => state.data,
    importAll: async (json) => void (state.imported = json),
  });
  return { cloud, fetch, state, getId: () => id };
}

test('копия уходит на сервер, а без изменений повторно не отправляется', async () => {
  const { cloud, fetch, state } = setup();
  expect(await cloud.sync()).toEqual({ ok: true, savedAt: 1000 });
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://api.test/api/backup');
  expect(JSON.parse(String(init.body))).toEqual({ deviceId: 'dev-new-0001', data: state.data });
  expect(cloud.lastSaved()).toBe(1000);

  state.data = state.data.replace('10:00:00', '11:00:00'); // изменилось только время экспорта
  expect(await cloud.sync()).toEqual({ skipped: true });
  state.data = state.data.replace('[1]', '[1,2]');
  expect(await cloud.sync()).toEqual({ ok: true, savedAt: 1000 });
  expect(fetch).toHaveBeenCalledTimes(2);
});

test('восстановление по старому ID: данные заменяются, ID становится старым', async () => {
  const { cloud, state, getId } = setup();
  expect(await cloud.restore('dev-old-0001')).toEqual({ ok: true, savedAt: 900 });
  expect(state.imported).toBe('{"version":1,"workouts":[7]}');
  expect(getId()).toBe('dev-old-0001');
});

test('нет копии — ошибка, данные и ID не трогаются', async () => {
  const { cloud, state, getId } = setup();
  expect(await cloud.restore('dev-none-001')).toEqual({ error: 'Копии для этого ID нет' });
  expect(state.imported).toBe('');
  expect(getId()).toBe('dev-new-0001');
});
