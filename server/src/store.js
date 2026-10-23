// Хранилище: подписки устройств и запланированные уведомления в одном JSON-файле (file = null — только в памяти).
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function createStore(file) {
  let data = { devices: {}, jobs: [] };
  if (file) {
    try {
      data = { ...data, ...JSON.parse(readFileSync(file, 'utf8')) };
    } catch {
      /* первый запуск */
    }
  }
  const save = () => {
    if (!file) return;
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file + '.tmp', JSON.stringify(data));
    renameSync(file + '.tmp', file);
  };
  return {
    getDevice: (id) => data.devices[id],
    setDevice(id, subscription) {
      data.devices[id] = subscription;
      save();
    },
    deleteDevice(id) {
      delete data.devices[id];
      data.jobs = data.jobs.filter((j) => j.deviceId !== id);
      save();
    },
    jobs: () => data.jobs,
    setJobs(jobs) {
      data.jobs = jobs;
      save();
    },
  };
}
