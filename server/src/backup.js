// Облачная копия данных приложения: файл на устройство на каждое сохранение, хранятся последние keep.
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const UUIDISH = /^[0-9a-zA-Z-]{8,64}$/;

export function createBackups(dir, { now = () => Date.now(), keep = 14 } = {}) {
  const devDir = (id) => {
    if (!UUIDISH.test(id)) throw new Error('deviceId');
    return path.join(dir, id);
  };
  const list = (id) => {
    try {
      return readdirSync(devDir(id)).filter((f) => /^\d+\.json$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b));
    } catch {
      return [];
    }
  };
  return {
    save(id, data) {
      const d = devDir(id);
      mkdirSync(d, { recursive: true });
      const at = now();
      writeFileSync(path.join(d, `${at}.tmp`), data);
      renameSync(path.join(d, `${at}.tmp`), path.join(d, `${at}.json`));
      const files = list(id);
      for (const f of files.slice(0, Math.max(0, files.length - keep))) rmSync(path.join(d, f), { force: true });
      return at;
    },
    latest(id) {
      const f = list(id).at(-1);
      return f ? { savedAt: parseInt(f), data: readFileSync(path.join(devDir(id), f), 'utf8') } : null;
    },
  };
}
