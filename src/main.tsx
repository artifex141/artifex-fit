import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { cloud } from './backup/cloud';
import { App } from './ui/App';
import './styles/global.css';

navigator.storage?.persist?.().catch(() => {});

// Облачная копия: при запуске, раз в 5 минут и при сворачивании; не чаще раза в минуту, только если данные изменились.
let lastBackup = 0;
const backup = () => {
  if (Date.now() - lastBackup < 60_000) return;
  lastBackup = Date.now();
  void cloud.sync().catch(() => {});
};
setTimeout(backup, 5_000);
setInterval(backup, 5 * 60_000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') backup();
});

// Новая версия: service worker сразу берёт управление (skipWaiting + clientsClaim) — перезагружаемся на неё.
// Проверяем обновления при каждом возвращении в приложение, иначе iPhone неделями держит старую версию.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void navigator.serviceWorker.getRegistration().then((r) => r?.update());
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
