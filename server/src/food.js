// Питание: распознавание блюда по фото (OpenAI), продукт по штрихкоду и поиск (Open Food Facts).
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const UUIDISH = /^[0-9a-zA-Z-]{8,64}$/;
const IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE = 4 * 1024 * 1024;
const PER_DEVICE_DAY = 60;
const TOTAL_DAY = 300;
const UA = 'ArtifexFit/1.0 (fit.artifex.mobi)';
const OFF = 'https://world.openfoodfacts.org';

const INSTRUCTIONS = `Ты — нутрициолог. На фото еда. Перечисли каждый отдельный продукт или компонент блюда, который видно на тарелке.
Для каждого: название по-русски (коротко, например «Куриная грудка, жареная»), вес в граммах по размеру порции на фото,
калории, белки, жиры и углеводы на 100 г по стандартным таблицам состава продуктов, и уверенность от 0 до 1.
Учитывай подсказку пользователя, если она есть. Если еды на фото нет — верни пустой список.`;

export const MEAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['dish', 'items'],
  properties: {
    dish: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'grams', 'kcal100', 'p100', 'f100', 'c100', 'confidence'],
        properties: {
          name: { type: 'string' },
          grams: { type: 'number' },
          kcal100: { type: 'number' },
          p100: { type: 'number' },
          f100: { type: 'number' },
          c100: { type: 'number' },
          confidence: { type: 'number' },
        },
      },
    },
  },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+v) ? +v : lo));
const r1 = (v) => Math.round(v * 10) / 10;

/** Ответ модели → не больше 15 правдоподобных позиций; ккал согласованы с БЖУ. */
export function normalizeMeal(raw) {
  const items = (Array.isArray(raw?.items) ? raw.items : [])
    .filter((x) => typeof x?.name === 'string' && x.name.trim())
    .slice(0, 15)
    .map((x) => {
      const p = r1(clamp(x.p100, 0, 100));
      const f = r1(clamp(x.f100, 0, 100));
      const c = r1(clamp(x.c100, 0, 100));
      let kcal = Math.round(clamp(x.kcal100, 0, 900));
      const fromMacros = Math.round(4 * p + 9 * f + 4 * c);
      if (fromMacros > kcal * 1.3) kcal = fromMacros;
      return { name: x.name.trim().slice(0, 80), grams: Math.round(clamp(x.grams, 1, 2000)), per100: { kcal, p, f, c }, confidence: r1(clamp(x.confidence, 0, 1)) };
    });
  return { dish: typeof raw?.dish === 'string' ? raw.dish.slice(0, 80) : '', items };
}

/** КБЖУ на 100 г из nutriments Open Food Facts; null, если данных нет. */
function per100FromOff(n = {}) {
  let kcal = n['energy-kcal_100g'];
  if (kcal === undefined && n.energy_100g !== undefined) kcal = n.energy_100g / 4.184;
  const p = n.proteins_100g;
  const f = n.fat_100g;
  const c = n.carbohydrates_100g;
  if ([kcal, p, f, c].some((v) => v === undefined || !Number.isFinite(+v))) return null;
  return { kcal: Math.round(+kcal), p: r1(+p), f: r1(+f), c: r1(+c) };
}

export function createFood({ fetch, apiKey, model, now = () => Date.now(), cacheFile, log = () => {} }) {
  let cache = {};
  try {
    cache = JSON.parse(readFileSync(cacheFile, 'utf8'));
  } catch {
    /* пустой кэш */
  }
  const saveCache = () => {
    try {
      mkdirSync(path.dirname(cacheFile), { recursive: true });
      writeFileSync(cacheFile + '.tmp', JSON.stringify(cache));
      renameSync(cacheFile + '.tmp', cacheFile);
    } catch (e) {
      log('food cache', e.message);
    }
  };

  // Счётчики фото за сутки (UTC): по устройству и всего.
  let day = '';
  let perDevice = new Map();
  let total = 0;
  const countPhoto = (deviceId) => {
    const d = new Date(now()).toISOString().slice(0, 10);
    if (d !== day) {
      day = d;
      perDevice = new Map();
      total = 0;
    }
    const n = perDevice.get(deviceId) ?? 0;
    if (n >= PER_DEVICE_DAY) return `Лимит ${PER_DEVICE_DAY} фото в сутки исчерпан`;
    if (total >= TOTAL_DAY) return 'Дневной лимит распознаваний на сервере исчерпан';
    perDevice.set(deviceId, n + 1);
    total++;
    return null;
  };

  async function photo(body) {
    const { deviceId, image, hint = '' } = body ?? {};
    if (typeof deviceId !== 'string' || !UUIDISH.test(deviceId)) return { status: 400, body: { error: 'Нет или неверный deviceId' } };
    if (typeof image !== 'string' || image.length > MAX_IMAGE || !IMAGE.test(image)) return { status: 400, body: { error: 'Фото не в формате JPEG/PNG/WebP или слишком большое' } };
    if (typeof hint !== 'string' || hint.length > 200) return { status: 400, body: { error: 'Подсказка длиннее 200 символов' } };
    if (!apiKey) return { status: 503, body: { error: 'Ключ OpenAI не настроен на сервере' } };
    const limited = countPhoto(deviceId);
    if (limited) return { status: 429, body: { error: limited } };

    const started = now();
    let res;
    try {
      res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          input: [
            { role: 'system', content: INSTRUCTIONS },
            {
              role: 'user',
              content: [
                { type: 'input_text', text: hint ? `Подсказка: ${hint}` : 'Что на тарелке?' },
                { type: 'input_image', image_url: image, detail: 'auto' },
              ],
            },
          ],
          text: { format: { type: 'json_schema', name: 'meal', strict: true, schema: MEAL_SCHEMA } },
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      log('food photo', deviceId.slice(0, 8), 'network', e.name);
      return { status: 504, body: { error: 'Не удалось распознать: OpenAI не ответил вовремя' } };
    }
    if (!res.ok) {
      log('food photo', deviceId.slice(0, 8), 'openai', res.status, (await res.text()).slice(0, 200));
      return { status: 502, body: { error: `Не удалось распознать: OpenAI вернул ошибку ${res.status}` } };
    }
    const data = await res.json();
    const parts = (data.output ?? []).flatMap((o) => o.content ?? []);
    const refusal = parts.find((c) => c.type === 'refusal');
    if (refusal) return { status: 422, body: { error: `Модель отказалась: ${refusal.refusal}` } };
    const text = parts.find((c) => c.type === 'output_text')?.text ?? data.output_text;
    let meal;
    try {
      meal = normalizeMeal(JSON.parse(text));
    } catch {
      return { status: 502, body: { error: 'Не удалось распознать: модель вернула не JSON' } };
    }
    log('food photo', deviceId.slice(0, 8), model, `in=${data.usage?.input_tokens} out=${data.usage?.output_tokens}`, `${now() - started}ms`, `items=${meal.items.length}`);
    return { status: 200, body: meal };
  }

  async function offGet(url) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
    return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : null };
  }

  async function barcode(code) {
    if (!/^\d{6,14}$/.test(code ?? '')) return { status: 400, body: { error: 'Штрихкод — это 6–14 цифр' } };
    const key = `b:${code}`;
    if (cache[key]) return cache[key].found ? { status: 200, body: cache[key].item } : { status: 404, body: { error: 'Продукта нет в базе' } };
    let r;
    try {
      r = await offGet(`${OFF}/api/v2/product/${code}.json?fields=product_name,brands,nutriments,image_front_small_url`);
    } catch {
      return { status: 504, body: { error: 'Open Food Facts не ответил' } };
    }
    const p = r.data?.product;
    const per100 = p && per100FromOff(p.nutriments);
    if (!r.ok || !p || !per100 || !p.product_name) {
      cache[key] = { found: false, at: now() };
      saveCache();
      return { status: 404, body: { error: 'Продукта нет в базе' } };
    }
    const item = { barcode: code, name: p.product_name, brand: p.brands || undefined, image: p.image_front_small_url || undefined, per100 };
    cache[key] = { found: true, item, at: now() };
    saveCache();
    return { status: 200, body: item };
  }

  async function search(q) {
    const query = String(q ?? '').trim();
    if (query.length < 2 || query.length > 60) return { status: 400, body: { error: 'Запрос — от 2 до 60 символов' } };
    const key = `s:${query.toLowerCase()}`;
    if (cache[key] && now() - cache[key].at < 24 * 3600_000) return { status: 200, body: { items: cache[key].items } };
    let r;
    try {
      r = await offGet(`${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=20&fields=code,product_name,brands,nutriments,image_front_small_url`);
    } catch {
      return { status: 504, body: { error: 'Open Food Facts не ответил' } };
    }
    const items = (r.data?.products ?? [])
      .map((p) => ({ barcode: p.code, name: p.product_name, brand: p.brands || undefined, image: p.image_front_small_url || undefined, per100: per100FromOff(p.nutriments) }))
      .filter((x) => x.name && x.per100);
    cache[key] = { items, at: now() };
    saveCache();
    return { status: 200, body: { items } };
  }

  return { photo, barcode, search };
}
