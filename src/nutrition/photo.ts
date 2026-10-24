// Ввод по фото: уменьшение снимка на телефоне и распознавание блюда через наш сервер (OpenAI за ним).
import { push } from '../push/push';
import type { Per100 } from './calc';

export interface ReviewItem {
  name: string;
  grams: number;
  per100: Per100;
}

const OFFLINE = 'Не удалось распознать — нет связи с сервером. Добавь вручную или попробуй позже';
const FAILED = 'Не удалось распознать — добавь вручную или попробуй позже';

/** JPEG не больше max px по длинной стороне. Поворот по EXIF браузер учитывает при отрисовке <img>. */
export async function resizeImage(file: Blob, max: number, quality: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * k);
    canvas.height = Math.round(img.naturalHeight * k);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('Не удалось сжать фото'))), 'image/jpeg', quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function dataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(bin)}`;
}

export async function recognizePhoto(
  image: Blob,
  hint: string,
  { api = import.meta.env.VITE_PUSH_API ?? 'https://fit.artifex.mobi', deviceId = push.deviceId(), fetch = globalThis.fetch } = {},
): Promise<{ items: ReviewItem[]; dish: string } | { error: string }> {
  let res: Response;
  try {
    res = await fetch(`${api}/api/food/photo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId, image: await dataUrl(image), hint: hint.trim().slice(0, 200) }),
    });
  } catch {
    return { error: OFFLINE };
  }
  let data: { error?: string; dish?: string; items?: (ReviewItem & { confidence?: number })[] };
  try {
    data = await res.json();
  } catch {
    return { error: FAILED };
  }
  if (!res.ok) return { error: data.error || FAILED };
  return { dish: data.dish ?? '', items: (data.items ?? []).map(({ name, grams, per100 }) => ({ name, grams, per100 })) };
}
