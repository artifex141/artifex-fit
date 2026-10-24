// Облачная копия в настройках: когда сохранялась, «Сохранить сейчас», восстановление по ID прежнего устройства.
import { useState } from 'react';

type Cloud = {
  lastSaved: () => number | null;
  sync: (force?: boolean) => Promise<{ ok: true; savedAt: number } | { skipped: true } | { error: string }>;
  restore: (id: string) => Promise<{ ok: true; savedAt: number } | { error: string }>;
};

const when = (t: number) => new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export function CloudBackup({ cloud, currentId, setDeviceId, reload }: { cloud: Cloud; currentId: string; setDeviceId: (id: string) => void; reload: () => void }) {
  const [saved, setSaved] = useState(cloud.lastSaved());
  const [id, setId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [noCopy, setNoCopy] = useState(false);
  const [busy, setBusy] = useState(false);
  const target = id.trim();

  const saveNow = async () => {
    setBusy(true);
    const r = await cloud.sync(true);
    setBusy(false);
    if ('ok' in r) setSaved(r.savedAt);
    setMsg('error' in r ? `Не сохранилось: ${r.error}` : 'Копия сохранена.');
  };

  const restore = async () => {
    if (!confirm('Заменить все данные приложения данными из облачной копии этого ID?')) return;
    setBusy(true);
    const r = await cloud.restore(target);
    setBusy(false);
    if ('ok' in r) return reload();
    setNoCopy(true);
    setMsg(r.error);
  };

  return (
    <section className="card stack">
      <h2 className="card-title">Облачная копия</h2>
      <p className="muted small">
        Тренировки, питание и профиль сохраняются на сервер fit.artifex.mobi сами — при изменениях и когда сворачиваешь приложение. Если iPhone сотрёт данные
        сайта, их можно вернуть по ID.
      </p>
      <p className="small">{saved ? `Сохранено: ${when(saved)}` : 'Копия ещё не сохранялась.'}</p>
      <button className="btn block" disabled={busy} onClick={saveNow}>
        Сохранить сейчас
      </button>
      <label className="pf-field">
        <span>ID прежнего устройства (сейчас: {currentId})</span>
        <input className="field" aria-label="ID устройства" placeholder="5cc149e1-…" value={id} onChange={(e) => (setId(e.target.value), setNoCopy(false), setMsg(null))} />
      </label>
      <button className="btn block" disabled={busy || target.length < 8} onClick={restore}>
        Восстановить из облака
      </button>
      {msg && <p className="small">{msg}</p>}
      {noCopy && (
        <button
          className="btn block"
          onClick={() => {
            setDeviceId(target);
            reload();
          }}
        >
          Вернуть только ID
        </button>
      )}
    </section>
  );
}
