// Продукты из Open Food Facts через наш сервер: по штрихкоду и поиском.
import type { Per100 } from './calc';

export interface OffFood {
  barcode?: string;
  name: string;
  brand?: string;
  image?: string;
  per100: Per100;
}

const OFFLINE = 'Нет связи с сервером — попробуй позже или введи вручную';
const defaults = { api: (import.meta.env.VITE_PUSH_API as string | undefined) ?? 'https://fit.artifex.mobi', fetch: (...a: Parameters<typeof fetch>) => globalThis.fetch(...a) };

async function get(path: string, { api, fetch } = defaults): Promise<{ status: number; data: Record<string, unknown> } | { error: string }> {
  try {
    const res = await fetch(`${api}${path}`);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch {
    return { error: OFFLINE };
  }
}

export async function fetchBarcode(code: string, opts = defaults): Promise<{ food: OffFood } | { notFound: true } | { error: string }> {
  const r = await get(`/api/food/barcode/${encodeURIComponent(code)}`, opts);
  if ('error' in r) return r;
  if (r.status === 404) return { notFound: true };
  if (r.status !== 200) return { error: String(r.data.error ?? 'Сервер не ответил') };
  return { food: r.data as unknown as OffFood };
}

export async function searchFoods(q: string, opts = defaults): Promise<{ items: OffFood[] } | { error: string }> {
  const r = await get(`/api/food/search?q=${encodeURIComponent(q)}`, opts);
  if ('error' in r) return r;
  if (r.status !== 200) return { error: String(r.data.error ?? 'Поиск не ответил') };
  return { items: (r.data.items as OffFood[]) ?? [] };
}
