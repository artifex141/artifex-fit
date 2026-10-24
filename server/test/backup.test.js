import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { createBackups } from '../src/backup.js';
import { createStore } from '../src/store.js';

const ORIGIN = 'https://artifex141.github.io';
const DEV = '5cc149e1-f881-46b1-98fb-c7b86b53ffff';

async function server(now = () => Date.now()) {
  const dir = mkdtempSync(path.join(tmpdir(), 'bk-'));
  const store = createStore(null);
  store.setDevice(DEV, { endpoint: 'https://web.push.apple.com/x', keys: { p256dh: 'k', auth: 'a' } });
  const backups = createBackups(dir, { now, keep: 3 });
  const srv = http.createServer(createApp({ store, clock: { now, setTimer: setTimeout, clearTimer: clearTimeout }, send: async () => 201, publicKey: 'P', origins: [ORIGIN], backups }).handler);
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { srv, dir, base: `http://127.0.0.1:${srv.address().port}` };
}
const put = (base, deviceId, data, origin = ORIGIN) =>
  fetch(`${base}/api/backup`, { method: 'POST', headers: { 'content-type': 'application/json', ...(origin && { origin }) }, body: JSON.stringify({ deviceId, data }) });

test('копия сохраняется и отдаётся последней; хранятся только последние N', async () => {
  let t = Date.UTC(2026, 9, 24, 12);
  const { srv, dir, base } = await server(() => t);
  try {
    for (const n of [1, 2, 3, 4]) {
      t += 60_000;
      assert.equal((await put(base, DEV, `{"version":1,"n":${n}}`)).status, 200);
    }
    const r = await fetch(`${base}/api/backup?deviceId=${DEV}`, { headers: { origin: ORIGIN } });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.data, '{"version":1,"n":4}');
    assert.equal(body.savedAt, t);
    assert.equal(readdirSync(path.join(dir, DEV)).length, 3);
  } finally {
    srv.close();
  }
});

test('копия: чужое устройство, без Origin, не JSON или слишком большая — отказ; нет копии — 404', async () => {
  const { srv, base } = await server();
  try {
    assert.equal((await put(base, '00000000-aaaa-bbbb-cccc-000000000000', '{}')).status, 403);
    assert.equal((await put(base, DEV, '{}', null)).status, 403);
    assert.equal((await put(base, DEV, 'не json')).status, 400);
    assert.equal((await put(base, DEV, '{"x":"' + 'a'.repeat(6 * 1024 * 1024) + '"}')).status, 400);
    assert.equal((await fetch(`${base}/api/backup?deviceId=${DEV}`, { headers: { origin: ORIGIN } })).status, 404);
  } finally {
    srv.close();
  }
});
