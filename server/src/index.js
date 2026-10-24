// Точка запуска: ключи VAPID и настройки — из переменных окружения (.env на сервере, не в репозитории).
import http from 'node:http';
import webpush from 'web-push';
import { createApp } from './app.js';
import { createFood } from './food.js';
import { createStore } from './store.js';

const env = (k, d) => {
  const v = process.env[k] ?? d;
  if (v === undefined) throw new Error(`Нет переменной ${k}`);
  return v;
};

const publicKey = env('VAPID_PUBLIC_KEY');
webpush.setVapidDetails(env('VAPID_SUBJECT', 'https://artifex141.github.io/artifex-fit/'), publicKey, env('VAPID_PRIVATE_KEY'));

const log = (...a) => console.log(new Date().toISOString(), ...a);

const { handler } = createApp({
  store: createStore(env('DATA_FILE', '/data/push.json')),
  clock: { now: () => Date.now(), setTimer: setTimeout, clearTimer: clearTimeout },
  send: async (sub, payload) => (await webpush.sendNotification(sub, payload, { TTL: 300, urgency: 'high' })).statusCode,
  publicKey,
  origins: env('ALLOWED_ORIGINS', 'https://artifex141.github.io').split(',').map((s) => s.trim()),
  food: createFood({
    fetch,
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: env('OPENAI_MODEL', 'gpt-6.1-sol'),
    cacheFile: env('FOOD_CACHE_FILE', '/data/food-cache.json'),
    log,
  }),
  log,
});

const port = Number(env('PORT', '8097'));
http.createServer(handler).listen(port, '0.0.0.0', () => log(`artifex-fit-push on :${port}`));
