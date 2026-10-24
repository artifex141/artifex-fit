import { expect, test, vi } from 'vitest';
import { recognizePhoto } from './photo';

const DEV = '0b5c1f0e-1111-4222-8333-444455556666';
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], { type: 'image/jpeg' });
const opts = (fetch: typeof globalThis.fetch) => ({ api: 'https://api.test', deviceId: DEV, fetch });

test('распознавание: фото уходит data-URL с подсказкой, ответ — строки для проверки', async () => {
  const fetch = vi.fn(async () =>
    Response.json({ dish: 'Курица с рисом', items: [{ name: 'Куриная грудка', grams: 150, per100: { kcal: 165, p: 31, f: 3.6, c: 0 }, confidence: 0.8 }] }),
  );
  const r = await recognizePhoto(jpeg(), 'соус отдельно', opts(fetch));
  expect(r).toEqual({ dish: 'Курица с рисом', items: [{ name: 'Куриная грудка', grams: 150, per100: { kcal: 165, p: 31, f: 3.6, c: 0 } }] });
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://api.test/api/food/photo');
  expect(init.method).toBe('POST');
  const body = JSON.parse(String(init.body));
  expect(body.deviceId).toBe(DEV);
  expect(body.hint).toBe('соус отдельно');
  expect(body.image).toBe('data:image/jpeg;base64,/9j/4AECAw==');
});

test('лимит и отсутствие ключа — текст ошибки сервера', async () => {
  const limit = vi.fn(async () => Response.json({ error: 'Лимит 60 фото в сутки исчерпан' }, { status: 429 }));
  expect(await recognizePhoto(jpeg(), '', opts(limit))).toEqual({ error: 'Лимит 60 фото в сутки исчерпан' });
  const nokey = vi.fn(async () => Response.json({ error: 'Ключ OpenAI не настроен на сервере' }, { status: 503 }));
  expect(await recognizePhoto(jpeg(), '', opts(nokey))).toEqual({ error: 'Ключ OpenAI не настроен на сервере' });
});

test('нет сети или ответ не JSON — общая русская ошибка', async () => {
  const offline = vi.fn(async () => {
    throw new TypeError('Failed to fetch');
  });
  expect(await recognizePhoto(jpeg(), '', opts(offline))).toEqual({ error: 'Не удалось распознать — нет связи с сервером. Добавь вручную или попробуй позже' });
  const html = vi.fn(async () => new Response('<html>502</html>', { status: 502 }));
  expect(await recognizePhoto(jpeg(), '', opts(html))).toEqual({ error: 'Не удалось распознать — добавь вручную или попробуй позже' });
});
