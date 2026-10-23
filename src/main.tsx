import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './styles/global.css';

navigator.storage?.persist?.().catch(() => {});

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
