// Хранилище: подписки устройств и запланированные уведомления в одном JSON-файле (file = null — только в памяти).
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function createStore(file) {
  let data = { devices: {}, jobs: [], body: {} };
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
    /** Замер тела: { type, date (мс), value }; замер того же типа за ту же минуту заменяется. */
    addBody(deviceId, { type, date, value }) {
      const dev = (data.body[deviceId] ??= {});
      const list = (dev[type] ??= []);
      const minute = Math.floor(date / 60_000);
      const i = list.findIndex((x) => Math.floor(x.date / 60_000) === minute);
      if (i >= 0) list[i] = { date, value };
      else list.push({ date, value });
      list.sort((a, b) => a.date - b.date);
      if (list.length > 2000) list.splice(0, list.length - 2000);
      save();
    },
    /** Отрезок сна { start, end, stage }; тот же (начало + стадия) заменяется — повторный запуск «Команды» не дублирует. */
    addSleep(deviceId, seg) {
      const list = ((data.body[deviceId] ??= {}).sleep ??= []);
      const i = list.findIndex((x) => x.start === seg.start && x.stage === seg.stage);
      if (i >= 0) list[i] = seg;
      else list.push(seg);
      list.sort((a, b) => a.start - b.start);
      if (list.length > 5000) list.splice(0, list.length - 5000);
      save();
    },
    getBody: (deviceId) => data.body[deviceId] ?? {},
    jobs: () => data.jobs,
    setJobs(jobs) {
      data.jobs = jobs;
      save();
    },
  };
}
