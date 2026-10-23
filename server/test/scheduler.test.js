import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createScheduler } from '../src/scheduler.js';

/** Подменные часы: таймеры срабатывают по advance(). */
function fakeClock(start = 1_000_000) {
  let t = start;
  let id = 0;
  const timers = new Map();
  return {
    now: () => t,
    setTimer: (fn, ms) => {
      timers.set(++id, { at: t + ms, fn });
      return id;
    },
    clearTimer: (h) => timers.delete(h),
    advance(ms) {
      t += ms;
      for (const [h, x] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
        if (x.at <= t) {
          timers.delete(h);
          x.fn();
        }
      }
    },
  };
}

function setup() {
  const clock = fakeClock();
  const fired = [];
  const changes = [];
  const s = createScheduler({ ...clock, onFire: (d, p) => fired.push([d, p.title]), onChange: (l) => changes.push(l) });
  return { clock, fired, changes, s };
}

test('уведомление уходит в назначенное время', () => {
  const { clock, fired, s } = setup();
  s.schedule('dev', clock.now() + 120_000, { title: 'Отдых окончен', body: '' });
  clock.advance(119_000);
  assert.deepEqual(fired, []);
  clock.advance(1_000);
  assert.deepEqual(fired, [['dev', 'Отдых окончен']]);
  assert.deepEqual(s.list(), []);
});

test('новый отдых заменяет прежний у того же устройства', () => {
  const { clock, fired, s } = setup();
  s.schedule('dev', clock.now() + 60_000, { title: 'A', body: '' });
  s.schedule('dev', clock.now() + 120_000, { title: 'B', body: '' });
  clock.advance(130_000);
  assert.deepEqual(fired, [['dev', 'B']]);
});

test('отмена убирает уведомление', () => {
  const { clock, fired, s } = setup();
  s.schedule('dev', clock.now() + 60_000, { title: 'A', body: '' });
  s.cancel('dev');
  clock.advance(120_000);
  assert.deepEqual(fired, []);
  assert.deepEqual(s.list(), []);
});

test('изменения сохраняются через onChange', () => {
  const { clock, changes, s } = setup();
  s.schedule('dev', clock.now() + 60_000, { title: 'A', body: 'b' });
  assert.deepEqual(changes.at(-1), [{ deviceId: 'dev', at: clock.now() + 60_000, payload: { title: 'A', body: 'b' } }]);
  s.cancel('dev');
  assert.deepEqual(changes.at(-1), []);
});

test('после перезапуска: будущие восстанавливаются, недавно просроченные уходят сразу, старые выбрасываются', () => {
  const { clock, fired, s } = setup();
  const now = clock.now();
  s.restore([
    { deviceId: 'future', at: now + 30_000, payload: { title: 'F', body: '' } },
    { deviceId: 'recent', at: now - 30_000, payload: { title: 'R', body: '' } },
    { deviceId: 'old', at: now - 10 * 60_000, payload: { title: 'O', body: '' } },
  ]);
  clock.advance(0);
  assert.deepEqual(fired, [['recent', 'R']]);
  clock.advance(30_000);
  assert.deepEqual(fired, [['recent', 'R'], ['future', 'F']]);
});
