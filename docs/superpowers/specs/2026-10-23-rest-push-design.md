# Push-уведомление о конце отдыха — дизайн и план

Дата: 2026-10-23 · Статус: схема утверждена пользователем в чате; спецификация и план — без отдельного ревью (как для MVP).

## Зачем
На iPhone веб-приложение при заблокированном экране не может само подать сигнал. Сигнал «Отдых окончен» приходит push-уведомлением с собственного VPS пользователя.

## Решения
- Сервер: Node 22 в Docker на VPS (31.97.131.112), слушает `127.0.0.1:8097`; снаружи — Caddy, `https://fit.artifex.mobi` (DNS `*.artifex.mobi` уже указывает на VPS). Отдельный файл `/etc/caddy/artifex-fit.caddy` + строка `import` в Caddyfile; остальные сайты не трогаем.
- Отправка: библиотека `web-push`, ключи VAPID генерируются на сервере и лежат в `.env` (не в репозитории).
- Доступ: случайный `deviceId` (UUID) создаётся в приложении; сервер принимает запросы только с известным `deviceId` и только с origin `https://artifex141.github.io` (и `http://localhost:5173` для разработки).
- Хранение: JSON-файл в томе `/data` — подписки и запланированные таймеры; после перезапуска таймеры восстанавливаются (просроченные меньше чем на 60 с — отправляются сразу, старше — выбрасываются).

## API (`/api`)
| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| GET | `/api/health` | — | `{ ok: true }` |
| GET | `/api/vapid` | — | `{ publicKey }` |
| POST | `/api/subscribe` | `{ deviceId, subscription }` | 204 |
| POST | `/api/rest` | `{ deviceId, at, title, body }` | 204 — заменяет прошлый таймер устройства |
| POST | `/api/rest/cancel` | `{ deviceId }` | 204 |

Ошибки: 400 — неверное тело; 404 — неизвестный `deviceId`; 403 — чужой origin. Ответ push-сервиса 404/410 → подписка удаляется.

## Клиент
- Service worker переходит на `injectManifest` (`src/sw.ts`): precache как раньше + обработчики `push` (показать уведомление `tag: 'rest'`) и `notificationclick` (открыть/сфокусировать приложение).
- `src/push/push.ts`: `enablePush()`, `isPushOn()`, `scheduleRestPush(at, title, body)`, `cancelRestPush()`; запросы fire-and-forget (`keepalive`), ошибки сети не мешают тренировке.
- Таймер отдыха: старт → `scheduleRestPush(конец, «Отдых окончен», «Подход N · Упражнение»)`; стоп/удаление подхода/конец тренировки → `cancelRestPush()`; пауза → отмена; продолжение → новый `scheduleRestPush`.
- Профиль: блок «Уведомления об отдыхе» — кнопка «Включить», статус, кнопка «Проверить» (уведомление через 5 с).

## Тесты
- Сервер (`node --test`): планировщик (замена, отмена, восстановление, просроченные), HTTP-маршруты с подменённой отправкой (CORS, 400/404, subscribe → rest → отправка, 410 → удаление подписки).
- Клиент (Vitest): `urlBase64ToUint8Array`; формирование запросов `scheduleRestPush`/`cancelRestPush` при включённом и выключенном push.

## План
1. `server/`: `scheduler.js`, `store.js`, `app.js`, `index.js`, `Dockerfile`, тесты → коммит.
2. Клиент: `src/sw.ts`, `src/push/push.ts` + тесты, переключение vite-plugin-pwa на injectManifest → коммит.
3. Связать с таймером отдыха и профилем → коммит.
4. VPS: копия `server/` в `/opt/artifex-fit-push`, `.env` с VAPID, `docker run` на `127.0.0.1:8097`, Caddy-блок, `caddy validate`, `systemctl reload caddy`, проверка `https://fit.artifex.mobi/api/health`.
5. Публикация приложения, проверка подписки и тестового push.
