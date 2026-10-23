import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { createApp } from '../src/app.js';
import { createStore } from '../src/store.js';

const ORIGIN = 'https://artifex141.github.io';
const SUB = { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'k', auth: 'a' } };

let server;
let base;
let sent;
let sendResult;
let store;
let timers;

beforeEach(async () => {
  sent = [];
  sendResult = 201;
  timers = [];
  store = createStore(null);
  const clock = {
    now: () => Date.now(),
    setTimer: (fn, ms) => timers.push({ fn, ms }) - 1,
    clearTimer: (h) => (timers[h] = null),
  };
  const send = async (subscription, payload) => {
    sent.push({ subscription, payload: JSON.parse(payload) });
    return sendResult;
  };
  server = http.createServer(createApp({ store, clock, send, publicKey: 'PUB', origins: [ORIGIN] }).handler);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => server.close());

const post = (p, body, origin = ORIGIN) =>
  fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) });

test('health и публичный ключ', async () => {
  assert.deepEqual(await (await fetch(base + '/api/health')).json(), { ok: true });
  const r = await fetch(base + '/api/vapid', { headers: { origin: ORIGIN } });
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
  assert.deepEqual(await r.json(), { publicKey: 'PUB' });
});

test('CORS: предварительный запрос с разрешённого сайта', async () => {
  const r = await fetch(base + '/api/rest', { method: 'OPTIONS', headers: { origin: ORIGIN, 'access-control-request-method': 'POST' } });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
});

test('чужой сайт получает 403', async () => {
  const r = await post('/api/subscribe', { deviceId: 'd1', subscription: SUB }, 'https://evil.example');
  assert.equal(r.status, 403);
});

test('подписка, отдых, отправка в назначенное время', async () => {
  assert.equal((await post('/api/subscribe', { deviceId: 'd1', subscription: SUB })).status, 204);
  const at = Date.now() + 120_000;
  assert.equal((await post('/api/rest', { deviceId: 'd1', at, title: 'Отдых окончен', body: 'Подход 2' })).status, 204);
  const t = timers.find(Boolean);
  assert.ok(t.ms > 119_000 && t.ms <= 120_000);
  t.fn();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].subscription, SUB);
  assert.equal(sent[0].payload.title, 'Отдых окончен');
  assert.equal(sent[0].payload.body, 'Подход 2');
});

test('неизвестное устройство — 404, неверное тело — 400', async () => {
  assert.equal((await post('/api/rest', { deviceId: 'nobody', at: Date.now() + 1000, title: 't', body: '' })).status, 404);
  assert.equal((await post('/api/subscribe', { deviceId: 'd1' })).status, 400);
  assert.equal((await post('/api/rest', { deviceId: 'd1', at: 'скоро' })).status, 400);
});

test('отмена отдыха', async () => {
  await post('/api/subscribe', { deviceId: 'd1', subscription: SUB });
  await post('/api/rest', { deviceId: 'd1', at: Date.now() + 60_000, title: 't', body: '' });
  assert.equal((await post('/api/rest/cancel', { deviceId: 'd1' })).status, 204);
  assert.equal(timers.filter(Boolean).length, 0);
});

test('подписка удалена у Apple (410) — сервер её забывает', async () => {
  await post('/api/subscribe', { deviceId: 'd1', subscription: SUB });
  await post('/api/rest', { deviceId: 'd1', at: Date.now(), title: 't', body: '' });
  sendResult = 410;
  timers.find(Boolean).fn();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(store.getDevice('d1'), undefined);
});

test('хранилище переживает перезапуск', () => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'afp-')), 'data.json');
  const a = createStore(file);
  a.setDevice('d1', SUB);
  a.setJobs([{ deviceId: 'd1', at: 5, payload: { title: 't', body: '' } }]);
  const b = createStore(file);
  assert.deepEqual(b.getDevice('d1'), SUB);
  assert.equal(b.jobs().length, 1);
});
