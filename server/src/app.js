// HTTP API: подписка устройства, запланировать/отменить уведомление о конце отдыха.
import { createScheduler } from './scheduler.js';

const MAX_BODY = 16 * 1024;

/**
 * @param {{
 *   store: ReturnType<typeof import('./store.js').createStore>,
 *   clock: { now: () => number, setTimer: Function, clearTimer: Function },
 *   send: (subscription: object, payload: string) => Promise<number>,  // статус ответа push-сервиса
 *   publicKey: string,
 *   origins: string[],
 *   log?: (...a: unknown[]) => void,
 * }} deps
 */
export function createApp({ store, clock, send, publicKey, origins, log = () => {} }) {
  async function deliver(deviceId, payload) {
    const sub = store.getDevice(deviceId);
    if (!sub) return;
    try {
      const status = await send(sub, JSON.stringify({ ...payload, tag: 'rest' }));
      if (status === 404 || status === 410) store.deleteDevice(deviceId);
    } catch (e) {
      log('push failed', deviceId, e?.statusCode ?? e?.message);
      if (e?.statusCode === 404 || e?.statusCode === 410) store.deleteDevice(deviceId);
    }
  }

  const scheduler = createScheduler({ ...clock, onFire: deliver, onChange: (jobs) => store.setJobs(jobs) });
  scheduler.restore(store.jobs());

  const isStr = (v, max = 200) => typeof v === 'string' && v.length > 0 && v.length <= max;

  function reply(res, status, body, origin) {
    const headers = { 'cache-control': 'no-store' };
    if (origin && origins.includes(origin)) {
      headers['access-control-allow-origin'] = origin;
      headers['access-control-allow-methods'] = 'GET, POST, OPTIONS';
      headers['access-control-allow-headers'] = 'content-type';
      headers['access-control-max-age'] = '86400';
      headers.vary = 'origin';
    }
    if (body === undefined) {
      res.writeHead(status, headers).end();
    } else {
      headers['content-type'] = 'application/json; charset=utf-8';
      res.writeHead(status, headers).end(JSON.stringify(body));
    }
  }

  function readJson(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) reject(new Error('too large'));
        else chunks.push(c);
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });
  }

  async function handler(req, res) {
    const origin = req.headers.origin;
    const url = new URL(req.url, 'http://x');
    const route = `${req.method} ${url.pathname}`;
    try {
      if (route === 'GET /api/health') return reply(res, 200, { ok: true }, origin);
      if (origin && !origins.includes(origin)) return reply(res, 403, { error: 'origin' });
      if (req.method === 'OPTIONS') return reply(res, 204, undefined, origin);
      if (route === 'GET /api/vapid') return reply(res, 200, { publicKey }, origin);

      if (req.method !== 'POST') return reply(res, 404, { error: 'not found' }, origin);
      const body = await readJson(req).catch(() => null);
      if (!body || !isStr(body.deviceId, 64)) return reply(res, 400, { error: 'deviceId' }, origin);

      if (route === 'POST /api/subscribe') {
        const s = body.subscription;
        if (!s || !isStr(s.endpoint, 1000) || !s.endpoint.startsWith('https://') || !s.keys || !isStr(s.keys.p256dh) || !isStr(s.keys.auth)) {
          return reply(res, 400, { error: 'subscription' }, origin);
        }
        store.setDevice(body.deviceId, { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } });
        return reply(res, 204, undefined, origin);
      }

      if (route === 'POST /api/rest') {
        const now = clock.now();
        if (typeof body.at !== 'number' || body.at < now - 60_000 || body.at > now + 6 * 3600_000 || !isStr(body.title) || typeof body.body !== 'string' || body.body.length > 300) {
          return reply(res, 400, { error: 'rest' }, origin);
        }
        if (!store.getDevice(body.deviceId)) return reply(res, 404, { error: 'device' }, origin);
        scheduler.schedule(body.deviceId, body.at, { title: body.title, body: body.body });
        return reply(res, 204, undefined, origin);
      }
      if (route === 'POST /api/rest/cancel') {
        if (!store.getDevice(body.deviceId)) return reply(res, 404, { error: 'device' }, origin);
        scheduler.cancel(body.deviceId);
        return reply(res, 204, undefined, origin);
      }
      return reply(res, 404, { error: 'not found' }, origin);
    } catch (e) {
      log('error', route, e);
      return reply(res, 500, { error: 'server' }, origin);
    }
  }

  return { handler, scheduler };
}
