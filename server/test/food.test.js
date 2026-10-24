import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createFood, normalizeMeal } from '../src/food.js';

const DEV = '0b5c1f0e-1111-4222-8333-444455556666';
const IMG = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg').toString('base64');

/** Подменный fetch: OpenAI отвечает заданным JSON, OFF — заданным продуктом. */
function fakeFetch({ meal, refusal, status = 200, off } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).startsWith('https://api.openai.com')) {
      if (status !== 200) return new Response('{"error":{"message":"boom"}}', { status });
      const content = refusal ? [{ type: 'refusal', refusal: 'Не могу' }] : [{ type: 'output_text', text: JSON.stringify(meal) }];
      return Response.json({ output: [{ type: 'message', content }], usage: { input_tokens: 1200, output_tokens: 150 } });
    }
    if (String(url).includes('openfoodfacts')) {
      if (!off) return Response.json({ status: 0 }, { status: 404 });
      return Response.json(off);
    }
    throw new Error('unexpected ' + url);
  };
  return { fn, calls };
}

const food = (f, extra = {}) =>
  createFood({ fetch: f.fn, apiKey: 'sk-test', model: 'gpt-6.1-sol', now: () => Date.UTC(2026, 9, 23, 12), cacheFile: path.join(mkdtempSync(path.join(tmpdir(), 'food-')), 'off.json'), log: () => {}, ...extra });

const MEAL = {
  dish: 'Курица с рисом',
  items: [
    { name: 'Куриная грудка', grams: 150, kcal100: 165, p100: 31, f100: 3.6, c100: 0, confidence: 0.8 },
    { name: 'Рис отварной', grams: 200, kcal100: 130, p100: 2.7, f100: 0.3, c100: 28, confidence: 0.7 },
  ],
};

test('фото: запрос в OpenAI с картинкой и схемой, ответ нормализован', async () => {
  const f = fakeFetch({ meal: MEAL });
  const r = await food(f).photo({ deviceId: DEV, image: IMG, hint: 'соус отдельно' });
  assert.equal(r.status, 200);
  assert.equal(r.body.dish, 'Курица с рисом');
  assert.deepEqual(r.body.items[0], { name: 'Куриная грудка', grams: 150, per100: { kcal: 165, p: 31, f: 3.6, c: 0 }, confidence: 0.8 });
  const req = JSON.parse(f.calls[0].init.body);
  assert.equal(req.model, 'gpt-6.1-sol');
  assert.equal(req.text.format.type, 'json_schema');
  assert.equal(req.text.format.strict, true);
  const user = req.input.find((m) => m.role === 'user').content;
  assert.deepEqual(user.find((c) => c.type === 'input_image'), { type: 'input_image', image_url: IMG, detail: 'auto' });
  assert.match(user.find((c) => c.type === 'input_text').text, /соус отдельно/);
  assert.equal(f.calls[0].init.headers.Authorization, 'Bearer sk-test');
});

test('мусор от модели обрезается и исправляется', () => {
  const r = normalizeMeal({
    dish: 'x',
    items: [
      { name: 'Масло', grams: -3, kcal100: 5000, p100: 0, f100: 200, c100: 0, confidence: 2 },
      { name: '', grams: 100, kcal100: 100, p100: 1, f100: 1, c100: 1, confidence: 0.5 },
      { name: 'Шоколад', grams: 50, kcal100: 100, p100: 7, f100: 35, c100: 50, confidence: 0.6 }, // 4·7+9·35+4·50 = 543 > 130 → ккал из БЖУ
      ...Array.from({ length: 20 }, (_, i) => ({ name: `п${i}`, grams: 10, kcal100: 50, p100: 1, f100: 1, c100: 10, confidence: 0.5 })),
    ],
  });
  assert.equal(r.items.length, 15);
  assert.deepEqual(r.items[0], { name: 'Масло', grams: 1, per100: { kcal: 900, p: 0, f: 100, c: 0 }, confidence: 1 });
  assert.equal(r.items[1].name, 'Шоколад');
  assert.equal(r.items[1].per100.kcal, 543);
});

test('фото: отказ модели — 422, нет ключа — 503, сбой OpenAI — 502', async () => {
  assert.equal((await food(fakeFetch({ refusal: true })).photo({ deviceId: DEV, image: IMG })).status, 422);
  assert.equal((await food(fakeFetch({ meal: MEAL }), { apiKey: '' }).photo({ deviceId: DEV, image: IMG })).status, 503);
  const bad = await food(fakeFetch({ status: 500 })).photo({ deviceId: DEV, image: IMG });
  assert.equal(bad.status, 502);
  assert.match(bad.body.error, /распознать/);
});

test('фото: неверные данные — 400, лимит 60 в сутки на устройство — 429', async () => {
  const f = food(fakeFetch({ meal: MEAL }));
  assert.equal((await f.photo({ deviceId: 'x', image: IMG })).status, 400);
  assert.equal((await f.photo({ deviceId: DEV, image: 'not-an-image' })).status, 400);
  assert.equal((await f.photo({ deviceId: DEV, image: IMG, hint: 'я'.repeat(201) })).status, 400);
  for (let i = 0; i < 60; i++) assert.equal((await f.photo({ deviceId: DEV, image: IMG })).status, 200);
  const over = await f.photo({ deviceId: DEV, image: IMG });
  assert.equal(over.status, 429);
  assert.match(over.body.error, /60/);
});

test('штрихкод: разбор Open Food Facts, 404, повтор из кэша', async () => {
  const off = { status: 1, product: { product_name: 'Йогурт', brands: 'Danone', image_front_small_url: 'https://img/1.jpg', nutriments: { 'energy-kcal_100g': 60, proteins_100g: 5, fat_100g: 1.5, carbohydrates_100g: 7 } } };
  const f = fakeFetch({ off });
  const fd = food(f);
  const r = await fd.barcode('4600000000001');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { barcode: '4600000000001', name: 'Йогурт', brand: 'Danone', image: 'https://img/1.jpg', per100: { kcal: 60, p: 5, f: 1.5, c: 7 } });
  assert.match(f.calls[0].init.headers['User-Agent'], /ArtifexFit/);
  await fd.barcode('4600000000001');
  assert.equal(f.calls.length, 1);
  assert.equal((await food(fakeFetch({})).barcode('4600000000002')).status, 404);
  assert.equal((await fd.barcode('abc')).status, 400);
});

test('штрихкод: энергия только в кДж пересчитывается в ккал', async () => {
  const off = { status: 1, product: { product_name: 'Хлеб', nutriments: { energy_100g: 1046, proteins_100g: 8, fat_100g: 3, carbohydrates_100g: 48 } } };
  const r = await food(fakeFetch({ off })).barcode('4600000000009');
  assert.equal(r.body.per100.kcal, 250);
});

test('поиск: search-a-licious, продукты без КБЖУ отбрасываются, бренды склеиваются', async () => {
  const off = {
    hits: [
      { code: '1', product_name: 'Овсянка', brands: ['Увелка', 'Ярмарка'], nutriments: { 'energy-kcal_100g': 350, proteins_100g: 12, fat_100g: 6, carbohydrates_100g: 60 } },
      { code: '2', product_name: 'Без данных', nutriments: {} },
    ],
  };
  const f = fakeFetch({ off });
  const r = await food(f).search('овсянка');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.items, [{ barcode: '1', name: 'Овсянка', brand: 'Увелка, Ярмарка', image: undefined, per100: { kcal: 350, p: 12, f: 6, c: 60 } }]);
  assert.match(f.calls[0].url, /^https:\/\/search\.openfoodfacts\.org\/search\?q=%D0%BE%D0%B2/);
  assert.equal((await food(fakeFetch({ off })).search('о')).status, 400);
});

test('поиск: сбой Open Food Facts — 502 и не кэшируется', async () => {
  let fail = true;
  const fn = async () => (fail ? new Response('<html>busy</html>', { status: 503 }) : Response.json({ hits: [{ code: '1', product_name: 'Творог', nutriments: { 'energy-kcal_100g': 120, proteins_100g: 17, fat_100g: 5, carbohydrates_100g: 2 } }] }));
  const fd = food({ fn });
  const bad = await fd.search('творог');
  assert.equal(bad.status, 502);
  assert.match(bad.body.error, /Open Food Facts/);
  fail = false;
  assert.equal((await fd.search('творог')).body.items.length, 1);
});

test('штрихкод: сбой Open Food Facts — 502, «нет в базе» не запоминается', async () => {
  let fail = true;
  const off = { status: 1, product: { product_name: 'Кефир', nutriments: { 'energy-kcal_100g': 53, proteins_100g: 3, fat_100g: 2.5, carbohydrates_100g: 4 } } };
  const fd = food({ fn: async () => (fail ? new Response('<html>busy</html>', { status: 503 }) : Response.json(off)) });
  assert.equal((await fd.barcode('4600000000077')).status, 502);
  fail = false;
  assert.equal((await fd.barcode('4600000000077')).body.name, 'Кефир');
});
