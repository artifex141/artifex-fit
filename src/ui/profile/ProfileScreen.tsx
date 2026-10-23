import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { exportAll, getCycleConfig, getOpenWorkout, getPendingCycleEnd, getPosition, importAll, saveCycleConfig, setPosition } from '../../db/repo';
import { EXERCISES } from '../../program/exercises';
import { DAYS } from '../../program/program';
import { TRAINING_DAYS, dayInfo } from '../../program/schedule';
import type { DayType } from '../../program/types';
import './profile.css';

const PICK_IDS = (['A', 'B', 'C'] as DayType[]).flatMap((t) =>
  DAYS[t].exercises.filter((e) => e.weeks[0].weight.kind === 'pick').map((e) => ({ id: e.exerciseId, day: t })),
);

function Position() {
  const pos = useLiveQuery(getPosition);
  const open = useLiveQuery(async () => (await getOpenWorkout()) ?? null);
  if (!pos || open === undefined) return null;
  const cycles = Array.from({ length: pos.cycle + 1 }, (_, i) => i + 1);
  return (
    <section className="card stack">
      <h2 className="card-title">Где я в программе</h2>
      {open && <p className="hint">Сейчас идёт тренировка — сначала заверши её.</p>}
      <div className="row">
        <label className="grow">
          <span className="field-label">Цикл</span>
          <select className="field" disabled={!!open} value={pos.cycle} onChange={(e) => setPosition({ ...pos, cycle: Number(e.target.value) })}>
            {cycles.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="grow2">
          <span className="field-label">Следующая тренировка</span>
          <select className="field" disabled={!!open} value={pos.day} onChange={(e) => setPosition({ ...pos, day: Number(e.target.value) })}>
            {TRAINING_DAYS.map((d) => {
              const i = dayInfo(d);
              return (
                <option key={d} value={d}>
                  День {d} · нед. {i.week} · «{i.type}»
                </option>
              );
            })}
          </select>
        </label>
      </div>
    </section>
  );
}

function StartWeights() {
  const pos = useLiveQuery(getPosition);
  const cfg = useLiveQuery(() => (pos ? getCycleConfig(pos.cycle) : undefined), [pos?.cycle]);
  const [saved, setSaved] = useState<string | null>(null);
  if (!pos || !cfg) return null;

  const update = async (id: string, raw: string) => {
    const v = parseFloat(raw.replace(',', '.'));
    const startWeights = { ...cfg.startWeights };
    if (Number.isFinite(v) && v > 0) startWeights[id] = v;
    else delete startWeights[id];
    await saveCycleConfig(pos.cycle, { ...cfg, startWeights });
    setSaved(id);
  };

  return (
    <section className="card stack">
      <h2 className="card-title">Стартовые веса (Н1)</h2>
      <p className="muted small">
        Вес, подобранный на неделе 1 цикла {pos.cycle}. Нужен, если неделя 1 не записана в приложении. Если на неделе 2 ты уже сделал упражнение —
        возьмётся вес оттуда.
      </p>
      {PICK_IDS.map(({ id, day }) => (
        <label key={id} className="weight-row">
          <span className="weight-name">
            <span className="day-badge">{day}</span>
            {EXERCISES[id].name}
          </span>
          <input
            className="field weight-input"
            inputMode="decimal"
            placeholder="lb"
            defaultValue={cfg.startWeights[id] ?? ''}
            onBlur={(e) => update(id, e.target.value)}
          />
          {saved === id && <span className="accent small">✓</span>}
        </label>
      ))}
    </section>
  );
}

function Backup() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const doExport = async () => {
    const blob = new Blob([await exportAll()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `artifex-fit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg('Файл сохранён. На iPhone выбери «Сохранить в Файлы» и положи в iCloud.');
  };

  const doImport = async (file: File) => {
    if (!confirm('Заменить все данные приложения данными из файла?')) return;
    try {
      await importAll(await file.text());
      setMsg('Данные восстановлены.');
    } catch (e) {
      setMsg(`Не получилось: ${(e as Error).message}`);
    }
  };

  return (
    <section className="card stack">
      <h2 className="card-title">Резервная копия</h2>
      <p className="muted small">Данные хранятся только на этом телефоне. Делай копию раз в неделю.</p>
      <div className="row">
        <button className="btn grow" onClick={doExport}>
          Экспорт
        </button>
        <button className="btn grow" onClick={() => fileRef.current?.click()}>
          Импорт
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doImport(f);
            e.target.value = '';
          }}
        />
      </div>
      {msg && <p className="small">{msg}</p>}
    </section>
  );
}

export function ProfileScreen({ onNewCycle }: { onNewCycle: (cycle: number) => void }) {
  const pos = useLiveQuery(getPosition);
  const open = useLiveQuery(async () => (await getOpenWorkout()) ?? null);
  const pendingEnd = useLiveQuery(getPendingCycleEnd);
  const endCycle = pendingEnd ?? pos?.cycle;
  return (
    <div className="screen stack">
      <h1 className="screen-title">Профиль</h1>
      <Position />
      <StartWeights />
      <Backup />
      {endCycle !== undefined && (
        <button className="btn block" disabled={!!open} onClick={() => onNewCycle(endCycle)}>
          Завершить цикл {endCycle} и начать новый
        </button>
      )}
      <p className="muted small center">Artifex Fit · версия {__APP_VERSION__}</p>
    </div>
  );
}
