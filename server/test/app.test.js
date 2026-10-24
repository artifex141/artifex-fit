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

test('замеры из «Команд»: без origin, вес и жир нормализуются, повтор за ту же минуту заменяется', async () => {
  const dev = '0b5c1f0e-1111-4222-8333-444455556666';
  const send = (body) => fetch(base + '/api/body', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const ok = await send({ deviceId: dev, type: 'weight', value: '80,2', unit: 'kg', date: '2026-10-20T08:00:00+03:00' });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true, saved: 1 });
  assert.equal((await send({ deviceId: dev, type: 'weight', value: 176.4, unit: 'lb', date: '2026-10-21T08:00:00+03:00' })).status, 200);
  assert.equal((await send({ deviceId: dev, type: 'bodyFat', value: 0.152, date: '2026-10-21T08:00:30+03:00' })).status, 200);
  assert.equal((await send({ deviceId: dev, type: 'bodyFat', value: 15.4, date: '2026-10-21T08:00:10+03:00' })).status, 200);
  const badValue = await send({ deviceId: dev, type: 'weight', value: 'много' });
  assert.equal(badValue.status, 400);
  assert.match((await badValue.json()).error, /value/);
  const badType = await send({ deviceId: dev, type: 'рост', value: 180 });
  assert.equal(badType.status, 400);
  assert.match((await badType.json()).error, /рост/);

  const r = await fetch(`${base}/api/body?deviceId=${dev}`, { headers: { origin: ORIGIN } });
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
  const data = await r.json();
  assert.deepEqual(data.weight.map((x) => x.value), [80.2, 80.01]);
  assert.deepEqual(data.bodyFat.map((x) => x.value), [15.4]);
});

test('пакет замеров одним запросом', async () => {
  const dev = '0b5c1f0e-1111-4222-8333-444455557777';
  const r = await post('/api/body', {
    deviceId: dev,
    samples: [
      { type: 'weight', value: 81, date: '2026-10-01T08:00:00Z' },
      { type: 'leanMass', value: 72, date: '2026-10-01T08:00:00Z' },
    ],
  });
  assert.equal(r.status, 200);
  const data = await (await fetch(`${base}/api/body?deviceId=${dev}`)).json();
  assert.equal(data.weight.length, 1);
  assert.equal(data.leanMass[0].value, 72);
});

test('тип из «Команд» в любом написании: Body Fat, BMI, Lean Body Mass, Вес', async () => {
  const dev = '0b5c1f0e-1111-4222-8333-444455558888';
  for (const [type, value] of [['Body Fat', 15], ['BMI', 24.1], ['Lean Body Mass', 68], ['Вес', 80], ['body_fat_percentage', 16], ['Процент жира', 17]]) {
    const r = await post('/api/body', { deviceId: dev, type, value, date: new Date(Date.UTC(2026, 9, 1, 8, Math.floor(value))).toISOString() });
    assert.equal(r.status, 200, type);
  }
  const data = await (await fetch(`${base}/api/body?deviceId=${dev}`)).json();
  assert.equal(data.bodyFat.length, 3);
  assert.equal(data.bmi.length, 1);
  assert.equal(data.leanMass.length, 1);
  assert.equal(data.weight.length, 1);
});

test('значение вместе с единицей текстом: «80,2 кг», «176.4 lb», «15,2 %»', async () => {
  const dev = '0b5c1f0e-1111-4222-8333-444455559999';
  await post('/api/body', { deviceId: dev, type: 'weight', value: '176.4 lb', date: '2026-10-02T08:00:00Z' });
  await post('/api/body', { deviceId: dev, type: 'weight', value: '80,2 кг', date: '2026-10-03T08:00:00Z' });
  await post('/api/body', { deviceId: dev, type: 'bodyFat', value: '15,2 %', date: '2026-10-03T08:00:00Z' });
  const data = await (await fetch(`${base}/api/body?deviceId=${dev}`)).json();
  assert.deepEqual(data.weight.map((x) => x.value), [80.01, 80.2]);
  assert.deepEqual(data.bodyFat.map((x) => x.value), [15.2]);
});

test('замер простым GET со значениями в адресе (для «Команд»)', async () => {
  const dev = '0b5c1f0e-1111-4222-8333-44445555aaaa';
  // «+» в часовом поясе после неэкранированной подстановки превращается в пробел — сервер это чинит
  const url = `${base}/api/body/add?deviceId=${dev}&type=Weight&value=176.4&unit=lbs&date=2026-10-20T08:00:00 03:00`;
  const r = await fetch(url);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, saved: 1 });
  const data = await (await fetch(`${base}/api/body?deviceId=${dev}`)).json();
  assert.equal(data.weight[0].value, 80.01);
  assert.equal(new Date(data.weight[0].date).toISOString(), '2026-10-20T05:00:00.000Z');
  const bad = await fetch(`${base}/api/body/add?deviceId=${dev}&type=рост&value=1`);
  assert.equal(bad.status, 400);
});

test('«Команды» шлют значения в заголовках: Device, Value, Unit, Date (тип по умолчанию — вес)', async () => {
  const dev = '5cc149e1-f881-46b1-98fb-c7b86b53bbbb';
  const get = (headers) => fetch(`${base}/api/body`, { headers });
  const r = await get({ Device: dev, Value: '163.599996768273', Unit: 'lbs', Date: '2026-10-23T16:54:42-04:00' });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, saved: 1 });
  assert.equal((await get({ Device: dev, Type: 'Body Fat', Value: '0.202', Unit: '%', Date: '2026-10-23T16:54:42-04:00' })).status, 200);
  const data = await (await fetch(`${base}/api/body?deviceId=${dev}`)).json();
  assert.equal(data.weight[0].value, 74.21);
  assert.equal(new Date(data.weight[0].date).toISOString(), '2026-10-23T20:54:42.000Z');
  assert.equal(data.bodyFat[0].value, 20.2);
});

test('невозможные значения отклоняются: вес в поле жира или ИМТ', async () => {
  const dev = '5cc149e1-f881-46b1-98fb-c7b86b53cccc';
  const get = (headers) => fetch(`${base}/api/body`, { headers: { Device: dev, Date: '2026-10-23T16:54:42-04:00', ...headers } });
  const fat = await get({ Type: 'bodyFat', Value: '160.7', Unit: '%' });
  assert.equal(fat.status, 400);
  assert.match((await fat.json()).error, /процент жира/i);
  assert.equal((await get({ Type: 'bmi', Value: '160.7' })).status, 400);
  assert.equal((await get({ Type: 'bmi', Value: '22.9' })).status, 200);
  assert.equal((await get({ Type: 'bodyFat', Value: '0.202', Unit: '%' })).status, 200);
  assert.equal((await get({ Type: 'weight', Value: '1600', Unit: 'lbs' })).status, 400);
});

test('маршруты питания: фото до 4 МБ, штрихкод, поиск; CORS для сайта', async () => {
  const seen = [];
  const foodStub = {
    photo: async (b) => (seen.push(['photo', b.image.length]), { status: 200, body: { dish: '', items: [] } }),
    barcode: async (c) => (seen.push(['barcode', c]), { status: 404, body: { error: 'нет' } }),
    search: async (q) => (seen.push(['search', q]), { status: 200, body: { items: [] } }),
  };
  const st = createStore(null);
  st.setDevice('dev-00000001', SUB);
  const srv = http.createServer(createApp({ store: st, clock: { now: Date.now, setTimer: setTimeout, clearTimer: clearTimeout }, send: async () => 201, publicKey: 'P', origins: [ORIGIN], food: foodStub }).handler);
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const b = `http://127.0.0.1:${srv.address().port}`;
  const big = 'data:image/jpeg;base64,' + 'A'.repeat(1_500_000);
  const r = await fetch(`${b}/api/food/photo`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify({ deviceId: 'dev-00000001', image: big }) });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal((await fetch(`${b}/api/food/barcode/4600000000001?deviceId=dev-00000001`, { headers: { origin: ORIGIN } })).status, 404);
  assert.equal((await fetch(`${b}/api/food/search?deviceId=dev-00000001&q=${encodeURIComponent('овсянка')}`, { headers: { origin: ORIGIN } })).status, 200);
  assert.deepEqual(seen.map((x) => x[0]), ['photo', 'barcode', 'search']);
  assert.equal(seen[1][1], '4600000000001');
  assert.equal(seen[2][1], 'овсянка');

  // Чужие не тратят лимиты: без Origin, с неизвестным устройством — 403, до OpenAI/OFF не доходит.
  const photo = (deviceId, headers) => fetch(`${b}/api/food/photo`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ deviceId, image: 'data:image/jpeg;base64,AA==' }) });
  assert.equal((await photo('dev-00000001', {})).status, 403);
  const stranger = await photo('dev-99999999', { origin: ORIGIN });
  assert.equal(stranger.status, 403);
  assert.match((await stranger.json()).error, /Устройство/);
  assert.equal((await fetch(`${b}/api/food/search?q=abc`, { headers: { origin: ORIGIN } })).status, 403);
  assert.equal((await fetch(`${b}/api/food/barcode/4600000000001?deviceId=dev-99999999`, { headers: { origin: ORIGIN } })).status, 403);
  st.addBody('dev-77777777', { type: 'weight', date: Date.now(), value: 70 });
  assert.equal((await fetch(`${b}/api/food/search?deviceId=dev-77777777&q=abc`, { headers: { origin: ORIGIN } })).status, 200);
  assert.equal(seen.length, 4);
  srv.close();
});
