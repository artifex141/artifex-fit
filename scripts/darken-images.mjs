// Перекрашивает карточки упражнений (белый фон, синие стрелки) под макет: тёмный фон, жёлтые стрелки.
// Использование: node scripts/darken-images.mjs <папка с исходными .webp/.png/.jpg> [папка вывода=public/exercises]
// PNG с прозрачным фоном кладутся прямо на тёмный градиент по альфе; белый фон вырезается заливкой от краёв.
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const [src, out = 'public/exercises'] = process.argv.slice(2);
if (!src) throw new Error('Укажи папку с исходными картинками');

const TOP = [27, 33, 40]; // фон кадра сверху
const BOTTOM = [12, 16, 20]; // и снизу
const YELLOW = [245, 197, 24];

const bgAt = (y, h) => TOP.map((c, k) => c + (BOTTOM[k] - c) * (y / h));
// Синие стрелки → жёлтые (s — насколько пиксель «стрелочный»), остальное как есть.
const recolor = (r, g, b, bg) => {
  if (b - r > 25 && b >= g) {
    const s = Math.min(1, (b - r) / 140);
    return bg.map((c, k) => c + (YELLOW[k] - c) * s);
  }
  return [r, g, b];
};

/** Прозрачный фон: смешиваем пиксель с градиентом по альфе. null — если прозрачности почти нет. */
async function onAlpha(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let clear = 0;
  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] < 250) clear++;
  if (clear < w * h * 0.05) return null;
  const out = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const bg = bgAt(Math.floor(i / w), h);
    const a = data[i * 4 + 3] / 255;
    const c = recolor(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], bg);
    for (let k = 0; k < 3; k++) out[i * 3 + k] = bg[k] + (c[k] - bg[k]) * a;
  }
  return { out, w, h };
}

for (const file of (await readdir(src)).filter((f) => /\.(webp|png|jpe?g)$/i.test(f))) {
  const name = file.replace(/\.[^.]+$/, '.webp');
  const alpha = await onAlpha(path.join(src, file));
  if (alpha) {
    await sharp(alpha.out, { raw: { width: alpha.w, height: alpha.h, channels: 3 } }).resize({ width: 1500 }).webp({ quality: 74 }).toFile(path.join(out, name));
    console.log('ok (alpha)', name);
    continue;
  }
  const { data, info } = await sharp(path.join(src, file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
  const light = (r, g, b) => (r + g + b) / 3;
  const sat = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);

  // Фон: светлые малонасыщенные пиксели, связанные с краем картинки (заливка от краёв).
  const isBg = new Uint8Array(w * h);
  const queue = [];
  const tryPush = (i) => {
    if (isBg[i]) return;
    const [r, g, b] = px(i);
    if (light(r, g, b) > 200 && sat(r, g, b) < 22) {
      isBg[i] = 1;
      queue.push(i);
    }
  };
  for (let x = 0; x < w; x++) tryPush(x), tryPush((h - 1) * w + x);
  for (let y = 0; y < h; y++) tryPush(y * w), tryPush(y * w + w - 1);
  while (queue.length) {
    const i = queue.pop();
    const x = i % w;
    if (x > 0) tryPush(i - 1);
    if (x < w - 1) tryPush(i + 1);
    if (i >= w) tryPush(i - w);
    if (i < w * (h - 1)) tryPush(i + w);
  }

  // Замкнутые белые участки (между тросом и телом, под скамьёй) — тоже фон, если они крупные.
  const seen = new Uint8Array(w * h);
  const white = (i) => {
    const [r, g, b] = px(i);
    return light(r, g, b) > 228 && sat(r, g, b) < 18;
  };
  for (let start = 0; start < w * h; start++) {
    if (isBg[start] || seen[start] || !white(start)) continue;
    const comp = [start];
    seen[start] = 1;
    for (let k = 0; k < comp.length; k++) {
      const i = comp[k];
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j >= 0 && j < w * h && !seen[j] && !isBg[j] && white(j)) {
          seen[j] = 1;
          comp.push(j);
        }
      }
    }
    if (comp.length > 400) for (const i of comp) isBg[i] = 1;
  }

  const outBuf = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const y = Math.floor(i / w);
    const t = y / h;
    const bg = TOP.map((c, k) => c + (BOTTOM[k] - c) * t);
    let [r, g, b] = px(i);
    let res;
    if (isBg[i]) {
      // Тень на полу (серое на белом) → затемнение тёмного фона.
      const shade = Math.min(1, Math.max(0, (255 - light(r, g, b)) / 55));
      res = bg.map((c) => c * (1 - 0.55 * shade));
    } else if (b - r > 25 && b >= g) {
      // Синие стрелки → жёлтые, с плавным переходом в фон.
      const s = Math.min(1, (b - r) / 140);
      res = bg.map((c, k) => c + (YELLOW[k] - c) * s);
    } else {
      // Светлая кайма у края фигуры — смешиваем с фоном.
      const x = i % w;
      const nearBg = (x > 0 && isBg[i - 1]) || (x < w - 1 && isBg[i + 1]) || (i >= w && isBg[i - w]) || (i < w * (h - 1) && isBg[i + w]);
      const l = light(r, g, b);
      if (nearBg && l > 170 && sat(r, g, b) < 30) {
        const a = (l - 170) / 85;
        res = [r, g, b].map((c, k) => c + (bg[k] - c) * a);
      } else res = [r, g, b];
    }
    outBuf[i * 3] = res[0];
    outBuf[i * 3 + 1] = res[1];
    outBuf[i * 3 + 2] = res[2];
  }
  await sharp(outBuf, { raw: { width: w, height: h, channels: 3 } })
    .resize({ width: 1500 })
    .webp({ quality: 74 })
    .toFile(path.join(out, name));
  console.log('ok', name);
}
