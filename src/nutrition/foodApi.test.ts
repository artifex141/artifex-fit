import { expect, test, vi } from 'vitest';
import { fetchBarcode, searchFoods } from './foodApi';

const YOGURT = { barcode: '4600000000001', name: 'Йогурт', brand: 'Danone', per100: { kcal: 60, p: 5, f: 1.5, c: 7 } };
const opts = (fetch: typeof globalThis.fetch) => ({ api: 'https://api.test', deviceId: 'dev-00000001', fetch });

test('штрихкод: найден, нет в базе, нет сети', async () => {
  const ok = vi.fn(async () => Response.json(YOGURT));
  expect(await fetchBarcode('4600000000001', opts(ok))).toEqual({ food: YOGURT });
  expect((ok.mock.calls[0] as unknown[])[0]).toBe('https://api.test/api/food/barcode/4600000000001?deviceId=dev-00000001');

  const missing = vi.fn(async () => Response.json({ error: 'Продукта нет в базе' }, { status: 404 }));
  expect(await fetchBarcode('4600000000002', opts(missing))).toEqual({ notFound: true });

  const offline = vi.fn(async () => {
    throw new TypeError('Failed to fetch');
  });
  expect(await fetchBarcode('4600000000003', opts(offline))).toEqual({ error: 'Нет связи с сервером — попробуй позже или введи вручную' });
});

test('поиск: запрос кодируется, ответ — список; ошибка сервера — текст', async () => {
  const ok = vi.fn(async () => Response.json({ items: [YOGURT] }));
  expect(await searchFoods('йогурт 1,5%', opts(ok))).toEqual({ items: [YOGURT] });
  expect((ok.mock.calls[0] as unknown[])[0]).toBe('https://api.test/api/food/search?deviceId=dev-00000001&q=%D0%B9%D0%BE%D0%B3%D1%83%D1%80%D1%82%201%2C5%25');

  const slow = vi.fn(async () => Response.json({ error: 'Open Food Facts не ответил' }, { status: 504 }));
  expect(await searchFoods('йогурт', opts(slow))).toEqual({ error: 'Open Food Facts не ответил' });
});
