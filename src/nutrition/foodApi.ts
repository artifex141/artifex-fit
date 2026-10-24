// Продукты из Open Food Facts через наш сервер: по штрихкоду и поиском.
import { push } from '../push/push';
import type { Per100 } from './calc';

export interface OffFood {
  barcode?: string;
  name: string;
  brand?: string;
  image?: string;
  per100: Per100;
}

const OFFLINE = 'Нет связи с сервером — попробуй позже или введи вручную';
type Opts = { api?: string; deviceId?: string; fetch?: typeof globalThis.fetch };

/** Сервер отвечает только известным устройствам — ID передаётся в адресе. */
async function get(path: string, query: string, { api = import.meta.env.VITE_PUSH_API ?? 'https://fit.artifex.mobi', deviceId = push.deviceId(), fetch = globalThis.fetch }: Opts): Promise<{ status: number; data: Record<string, unknown> } | { error: string }> {
  try {
    const res = await fetch(`${api}${path}?deviceId=${encodeURIComponent(deviceId)}${query}`);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch {
    return { error: OFFLINE };
  }
}

export async function fetchBarcode(code: string, opts: Opts = {}): Promise<{ food: OffFood } | { notFound: true } | { error: string }> {
  const r = await get(`/api/food/barcode/${encodeURIComponent(code)}`, '', opts);
  if ('error' in r) return r;
  if (r.status === 404) return { notFound: true };
  if (r.status !== 200) return { error: String(r.data.error ?? 'Сервер не ответил') };
  return { food: r.data as unknown as OffFood };
}

export async function searchFoods(q: string, opts: Opts = {}): Promise<{ items: OffFood[] } | { error: string }> {
  const r = await get('/api/food/search', `&q=${encodeURIComponent(q)}`, opts);
  if ('error' in r) return r;
  if (r.status !== 200) return { error: String(r.data.error ?? 'Поиск не ответил') };
  return { items: (r.data.items as OffFood[]) ?? [] };
}
