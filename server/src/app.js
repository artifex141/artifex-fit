// HTTP API: подписка устройства, запланировать/отменить уведомление о конце отдыха.
import { createScheduler } from './scheduler.js';

const MAX_BODY = 256 * 1024;
const UUIDISH = /^[0-9a-zA-Z-]{8,64}$/;

// «Команды» и «Здоровье» называют типы по-разному — принимаем любые разумные написания.
const TYPE_ALIASES = {
  weight: ['weight', 'bodymass', 'вес', 'массатела'],
  bodyFat: ['bodyfat', 'bodyfatpercentage', 'fat', 'fatpercentage', 'жир', 'процентжира', 'процентжиравтеле'],
  leanMass: ['leanmass', 'leanbodymass', 'сухаямассатела', 'безжироваямассатела', 'безжироваямасса'],
  bmi: ['bmi', 'bodymassindex', 'имт', 'индексмассытела'],
};
// Правдоподобные границы (вес и сухая масса — в кг): отсекают вес, отправленный под видом жира или ИМТ.
const RANGES = {
  weight: { min: 25, max: 300, name: 'вес', unit: ' кг' },
  leanMass: { min: 20, max: 200, name: 'сухую массу', unit: ' кг' },
  bodyFat: { min: 2, max: 70, name: 'процент жира', unit: '%' },
  bmi: { min: 10, max: 60, name: 'ИМТ', unit: '' },
};
const TYPE_BY_KEY = Object.fromEntries(Object.entries(TYPE_ALIASES).flatMap(([t, keys]) => keys.map((k) => [k, t])));
const typeOf = (raw) => TYPE_BY_KEY[String(raw ?? '').toLowerCase().replace(/[^a-zа-яё]/g, '')];

/**
 * Замер из «Команд» → { sample: { type, date, value } } или { error: «понятная причина» }.
 * Вес хранится в кг, жир — в процентах. Значение может прийти текстом вместе с единицей: «80,2 кг», «176.4 lb».
 */
export function normalizeSample(raw, now) {
  if (!raw || typeof raw !== 'object') return { error: 'Пустой замер' };
  const type = typeOf(raw.type);
  if (!type) return { error: `Неизвестный type «${String(raw.type ?? '')}». Нужен weight, bodyFat, leanMass или bmi` };
  const text = String(raw.value ?? '').replace(',', '.');
  let value = typeof raw.value === 'number' ? raw.value : parseFloat(text);
  if (!Number.isFinite(value) || value <= 0) return { error: `Не число в value: «${String(raw.value ?? '')}»` };
  const unit = `${raw.unit ?? ''} ${typeof raw.value === 'string' ? raw.value : ''}`.toLowerCase();
  if ((type === 'weight' || type === 'leanMass') && /(^|[^a-z])lbs?([^a-z]|$)|фунт/.test(unit)) value *= 0.45359237;
  if (type === 'bodyFat' && value <= 1) value *= 100;
  const range = RANGES[type];
  if (value < range.min || value > range.max) {
    return { error: `Не похоже на ${range.name}: ${Math.round(value * 10) / 10}${range.unit}. Проверь тип в «Найти образцы» — возможно, там «Вес»` };
  }
  const parsed = raw.date ? Date.parse(raw.date) : NaN;
  const date = Number.isFinite(parsed) ? parsed : now;
  return { sample: { type, date, value: Math.round(value * 100) / 100 } }; // 2 знака: пересчёт кг↔lb без дрейфа
}

/**
 * @param {{
 *   store: ReturnType<typeof import('./store.js').createStore>,
 *   clock: { now: () => number, setTimer: Function, clearTimer: Function },
 *   send: (subscription: object, payload: string) => Promise<number>,  // статус ответа push-сервиса
 *   publicKey: string,
 *   origins: string[],
 *   log?: (...a: unknown[]) => void,
 * }} deps
 */
export function createApp({ store, clock, send, publicKey, origins, food = null, log = () => {} }) {
  async function deliver(deviceId, payload) {
    const sub = store.getDevice(deviceId);
    if (!sub) return;
    try {
      const status = await send(sub, JSON.stringify({ ...payload, tag: 'rest' }));
      if (status === 404 || status === 410) store.deleteDevice(deviceId);
    } catch (e) {
      log('push failed', deviceId, e?.statusCode ?? e?.message);
      if (e?.statusCode === 404 || e?.statusCode === 410) store.deleteDevice(deviceId);
    }
  }

  const scheduler = createScheduler({ ...clock, onFire: deliver, onChange: (jobs) => store.setJobs(jobs) });
  scheduler.restore(store.jobs());

  const isStr = (v, max = 200) => typeof v === 'string' && v.length > 0 && v.length <= max;

  function reply(res, status, body, origin) {
    const headers = { 'cache-control': 'no-store' };
    if (origin && origins.includes(origin)) {
      headers['access-control-allow-origin'] = origin;
      headers['access-control-allow-methods'] = 'GET, POST, OPTIONS';
      headers['access-control-allow-headers'] = 'content-type';
      headers['access-control-max-age'] = '86400';
      headers.vary = 'origin';
    }
    if (body === undefined) {
      res.writeHead(status, headers).end();
    } else {
      headers['content-type'] = 'application/json; charset=utf-8';
      res.writeHead(status, headers).end(JSON.stringify(body));
    }
  }

  /** Тело запроса как JSON; больше max — дочитываем впустую и отказываем (иначе клиент зависнет на отправке). */
  function readJson(req, max = MAX_BODY) {
    return new Promise((resolve, reject) => {
      let size = 0;
      let tooLarge = false;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > max) tooLarge = true;
        else chunks.push(c);
      });
      req.on('end', () => {
        if (tooLarge) return reject(new Error('too large'));
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });
  }

  const UNKNOWN_DEVICE = 'Устройство не подключено к серверу — включи уведомления в настройках Artifex';
  const knownDevice = (id) => typeof id === 'string' && UUIDISH.test(id) && Boolean(store.getDevice(id) || Object.keys(store.getBody(id)).length);
  // Запросы к Open Food Facts: не больше OFF_PER_DAY на устройство за сутки (UTC).
  const OFF_PER_DAY = 500;
  let offDay = '';
  let offCount = new Map();
  const countOff = (id) => {
    const d = new Date(clock.now()).toISOString().slice(0, 10);
    if (d !== offDay) [offDay, offCount] = [d, new Map()];
    const n = offCount.get(id) ?? 0;
    if (n >= OFF_PER_DAY) return false;
    offCount.set(id, n + 1);
    return true;
  };

  async function handler(req, res) {
    const origin = req.headers.origin;
    const url = new URL(req.url, 'http://x');
    const route = `${req.method} ${url.pathname}`;
    // Журнал всех запросов (кроме проверок здоровья): видно, что реально присылают «Команды».
    if (url.pathname !== '/api/health') {
      res.on('finish', () => log('req', route, res.statusCode, String(req.headers['user-agent'] ?? '').slice(0, 40), req.headers['content-type'] ?? ''));
    }
    try {
      if (route === 'GET /api/health') return reply(res, 200, { ok: true }, origin);
      if (origin && !origins.includes(origin)) return reply(res, 403, { error: 'origin' });
      if (req.method === 'OPTIONS') return reply(res, 204, undefined, origin);
      if (route === 'GET /api/vapid') return reply(res, 200, { publicKey }, origin);

      // Питание: фото (тело до 6 МБ — base64 фото до 4 МБ), штрихкод, поиск.
      // Только из приложения и только с устройств, которые уже знает сервер (подписка на уведомления или замеры тела),
      // иначе любой скрипт со случайными deviceId выбрал бы дневной лимит OpenAI.
      if (food && url.pathname.startsWith('/api/food/') && !origin) return reply(res, 403, { error: 'Запрос не из приложения' });
      if (food && route === 'POST /api/food/photo') {
        const body = await readJson(req, 6 * 1024 * 1024).catch(() => null);
        if (!body) return reply(res, 400, { error: 'Фото слишком большое или запрос не JSON' }, origin);
        if (!knownDevice(body.deviceId)) return reply(res, 403, { error: UNKNOWN_DEVICE }, origin);
        const r = await food.photo(body);
        return reply(res, r.status, r.body, origin);
      }
      const bc = food && req.method === 'GET' && /^\/api\/food\/barcode\/([^/]+)$/.exec(url.pathname);
      if ((bc || (food && route === 'GET /api/food/search')) && !knownDevice(url.searchParams.get('deviceId'))) return reply(res, 403, { error: UNKNOWN_DEVICE }, origin);
      if ((bc || (food && route === 'GET /api/food/search')) && !countOff(url.searchParams.get('deviceId'))) return reply(res, 429, { error: `Лимит ${OFF_PER_DAY} запросов к базе продуктов в сутки исчерпан` }, origin);
      if (bc) {
        const r = await food.barcode(decodeURIComponent(bc[1]));
        return reply(res, r.status, r.body, origin);
      }
      if (food && route === 'GET /api/food/search') {
        const r = await food.search(url.searchParams.get('q') ?? '');
        return reply(res, r.status, r.body, origin);
      }
      if (route === 'GET /api/body' || route === 'GET /api/body/add') {
        // Замер можно прислать GET-запросом: значения в адресе (?deviceId=&type=&value=&unit=&date=)
        // или в заголовках Device/DeviceId, Type, Value, Unit, Date — так их проще задать в «Командах».
        const q = Object.fromEntries(url.searchParams);
        const h = req.headers;
        const value = q.value ?? h.value;
        const deviceId = q.deviceId ?? h.deviceid ?? h.device ?? '';
        if (value === undefined && route === 'GET /api/body') {
          if (!UUIDISH.test(deviceId)) return reply(res, 400, { error: 'deviceId' }, origin);
          return reply(res, 200, store.getBody(deviceId), origin);
        }
        if (!UUIDISH.test(deviceId)) return reply(res, 400, { error: 'Нет или неверный deviceId — скопируй ID в профиле Artifex' }, origin);
        // «+» часового пояса без экранирования приходит пробелом: «…08:00:00 03:00» → «…08:00:00+03:00»
        const date = (q.date ?? (q.value === undefined ? h.date : undefined))?.replace(/ (\d{2}:?\d{2})$/, '+$1');
        const r = normalizeSample({ type: q.type ?? h.type ?? 'weight', value, unit: q.unit ?? h.unit, date }, clock.now());
        log('body-get', deviceId.slice(0, 8), r.error ? `400 ${r.error}` : `200 ${r.sample.type}=${r.sample.value}`);
        if (r.error) return reply(res, 400, { error: r.error }, origin);
        store.addBody(deviceId, r.sample);
        return reply(res, 200, { ok: true, saved: 1 }, origin);
      }

      if (req.method !== 'POST') return reply(res, 404, { error: 'not found' }, origin);
      const body = await readJson(req).catch(() => null);
      if (!body || !isStr(body.deviceId, 64) || (route === 'POST /api/body' && !UUIDISH.test(body.deviceId))) {
        log('bad request', route, body ? JSON.stringify(body).slice(0, 200) : 'не JSON');
        return reply(res, 400, { error: body ? 'Нет или неверный deviceId — скопируй ID в профиле Artifex' : 'Тело запроса не JSON' }, origin);
      }

      if (route === 'POST /api/body') {
        const raws = Array.isArray(body.samples) ? body.samples.slice(0, 1000) : [body];
        const results = raws.map((r) => normalizeSample(r, clock.now()));
        const bad = results.find((x) => x.error);
        log('body', String(body.deviceId).slice(0, 8), bad ? `400 ${bad.error}` : `200 x${results.length}`, JSON.stringify(raws[0]).slice(0, 200));
        if (bad || results.length === 0) return reply(res, 400, { error: bad?.error ?? 'Нет замеров' }, origin);
        for (const x of results) store.addBody(body.deviceId, x.sample);
        return reply(res, 200, { ok: true, saved: results.length }, origin);
      }

      if (route === 'POST /api/subscribe') {
        const s = body.subscription;
        if (!s || !isStr(s.endpoint, 1000) || !s.endpoint.startsWith('https://') || !s.keys || !isStr(s.keys.p256dh) || !isStr(s.keys.auth)) {
          return reply(res, 400, { error: 'subscription' }, origin);
        }
        store.setDevice(body.deviceId, { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } });
        return reply(res, 204, undefined, origin);
      }

      if (route === 'POST /api/rest') {
        const now = clock.now();
        if (typeof body.at !== 'number' || body.at < now - 60_000 || body.at > now + 6 * 3600_000 || !isStr(body.title) || typeof body.body !== 'string' || body.body.length > 300) {
          return reply(res, 400, { error: 'rest' }, origin);
        }
        if (!store.getDevice(body.deviceId)) return reply(res, 404, { error: 'device' }, origin);
        scheduler.schedule(body.deviceId, body.at, { title: body.title, body: body.body });
        return reply(res, 204, undefined, origin);
      }
      if (route === 'POST /api/rest/cancel') {
        if (!store.getDevice(body.deviceId)) return reply(res, 404, { error: 'device' }, origin);
        scheduler.cancel(body.deviceId);
        return reply(res, 204, undefined, origin);
      }
      return reply(res, 404, { error: 'not found' }, origin);
    } catch (e) {
      log('error', route, e);
      return reply(res, 500, { error: 'server' }, origin);
    }
  }

  return { handler, scheduler };
}
