import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { exportAll, getCycleConfig, getOpenWorkout, getPendingCycleEnd, getPosition, importAll, saveCycleConfig, setPosition } from '../../db/repo';
import { EXERCISES } from '../../program/exercises';
import { DAYS } from '../../program/program';
import { TRAINING_DAYS, dayInfo } from '../../program/schedule';
import type { DayType } from '../../program/types';
import { cachedBody, inLb, loadBody, metric, type BodyData } from '../../body/body';
import { cloud } from '../../backup/cloud';
import { push } from '../../push/push';
import { CloudBackup } from './CloudBackup';
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

function PushSettings() {
  const [on, setOn] = useState(push.isOn());
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;

  const enable = async () => {
    setBusy(true);
    const r = await push.enable();
    setBusy(false);
    setOn(r === 'on');
    setMsg(
      {
        on: 'Готово: уведомление придёт, когда закончится отдых — даже на заблокированном экране.',
        denied: 'Уведомления запрещены. Разреши их: Настройки → Уведомления → Artifex.',
        unsupported: 'Это работает только в приложении, открытом с экрана «Домой» (iOS 16.4+).',
        error: 'Сервер уведомлений недоступен. Попробуй позже.',
      }[r],
    );
  };

  const testPush = async () => {
    await push.scheduleRest(Date.now() + 5000, 'Отдых окончен', 'Проверка: так будет выглядеть сигнал');
    setMsg('Через 5 секунд придёт уведомление. Можно заблокировать экран.');
  };

  return (
    <section className="card stack">
      <h2 className="card-title">Уведомления об отдыхе</h2>
      <p className="muted small">Сигнал о конце отдыха со звуком — даже когда экран заблокирован. Музыка не прерывается.</p>
      {!standalone && <p className="hint small">Сначала установи приложение: Safari → «Поделиться» → «На экран „Домой“», и открой его оттуда.</p>}
      {on ? (
        <div className="row">
          <button className="btn grow" onClick={testPush}>
            Проверить
          </button>
          <button
            className="btn grow"
            onClick={() => {
              push.disable();
              setOn(false);
              setMsg('Уведомления выключены.');
            }}
          >
            Выключить
          </button>
        </div>
      ) : (
        <button className="btn primary block" disabled={busy} onClick={enable}>
          {busy ? 'Подключаю…' : 'Включить уведомления'}
        </button>
      )}
      {msg && <p className="small">{msg}</p>}
    </section>
  );
}

const API = import.meta.env.VITE_PUSH_API ?? 'https://fit.artifex.mobi';

function ZeppLife() {
  const [data, setData] = useState<BodyData>(cachedBody);
  const [copied, setCopied] = useState(false);
  const id = push.deviceId();
  useEffect(() => {
    void loadBody().then(setData);
  }, []);
  const w = inLb(metric(data.weight, Date.now()));
  const f = metric(data.bodyFat, Date.now());
  const day = (t: number) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };


  return (
    <section className="card stack">
      <h2 className="card-title">Вес и состав тела из Zepp Life</h2>
      <p className="small">
        {w ? (
          <>
            Последний замер: <b>{w.value} lb</b>
            {f ? `, жир ${f.value}%` : ''} — {day(w.lastDate)}
          </>
        ) : (
          <span className="muted">Данных пока нет — на «Прогрессе» показаны демо-значения.</span>
        )}
      </p>
      <div className="row">
        <code className="device-id">{id}</code>
        <button className="btn" onClick={copy}>
          {copied ? 'Скопировано' : 'Копировать ID'}
        </button>
      </div>
      <details className="howto">
        <summary>Как настроить (один раз, ~5 минут)</summary>
        <ol>
          <li>
            Разреши Zepp Life писать в «Здоровье» — это включается в самом приложении <b>«Здоровье»</b>, а не в Zepp Life: <b>«Здоровье» → аватар справа вверху → «Приложения» → Zepp Life → «Включить все»</b> (как минимум «Вес» и «Процент жира»). Если Zepp Life в этом списке нет — открой в Zepp Life вкладку <b>«Профиль»</b> и найди пункт про Apple «Здоровье» / «Health»; при первом включении iPhone покажет запрос доступа. Потом встань на весы и открой Zepp Life — замер появится в «Здоровье».
          </li>
          <li>
            Открой <b>«Команды» → «+»</b>, назови команду <b>Artifex: замеры</b>.
          </li>
          <li>
            Добавь действие <b>«Найти образцы данных Здоровья»</b> (Find Health Samples): Тип — <b>Вес</b>, <b>без фильтра по дате</b>, сортировка — <b>по дате начала, сначала новые</b>, ограничение — <b>30</b>.
          </li>
          <li>
            Добавь <b>«Повторить с каждым»</b> для найденных образцов, внутри — <b>«Получить содержимое URL»</b> (Get Contents of URL):
            <br />URL: <code>{API}/api/body</code>, метод — <b>GET</b>, тела запроса нет.
            <br />Раскрой <b>Headers</b> и добавь заголовки: <code>Device</code> = твой ID (кнопка выше), <code>Value</code> = «Объект повтора» (Repeat Item), <code>Unit</code> = <code>lbs</code>, <code>Date</code> = «Отформатированная дата» (Start Date в формате <b>ISO 8601</b>).
          </li>
          <li>
            Для остальных показателей — такая же команда с другим типом в «Найти образцы» и ещё одним заголовком <code>Type</code>: <code>bodyFat</code> (процент жира, Unit = <code>%</code>), <code>leanMass</code> (сухая масса, Unit = <code>lbs</code>) или <code>bmi</code>. Без <code>Type</code> замер считается весом.
            <br />
            Проверка: запусти команду вручную — ответ <code>{'{"ok":true,"saved":1}'}</code> на каждый замер значит всё дошло; если ошибка — в ней написано, что не так.
          </li>
          <li>
            «Команды» → <b>Автоматизация → «+» → Время суток</b> (например, 9:00, ежедневно) → <b>«Запускать сразу»</b> → выбери «Artifex: замеры». Один раз запусти команду вручную.
          </li>
        </ol>
        <p className="muted small">Мышечная масса, вода и костная масса в «Здоровье» не передаются — эти блоки пока демо.</p>
      </details>
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

/** Настройки (бывший «Профиль»): программа, уведомления, Zepp Life, стартовые веса, резервная копия. */
export function SettingsScreen({ onNewCycle, onClose }: { onNewCycle: (cycle: number) => void; onClose: () => void }) {
  const pos = useLiveQuery(getPosition);
  const open = useLiveQuery(async () => (await getOpenWorkout()) ?? null);
  const pendingEnd = useLiveQuery(getPendingCycleEnd);
  const endCycle = pendingEnd ?? pos?.cycle;
  return (
    <div className="screen stack settings">
      <div className="row">
        <button className="glass-btn" style={{ width: 40, height: 40 }} aria-label="Назад" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <h1 className="screen-title">Настройки</h1>
      </div>
      <Position />
      <PushSettings />
      <ZeppLife />
      <StartWeights />
      <CloudBackup cloud={cloud} currentId={push.deviceId()} setDeviceId={push.setDeviceId} reload={() => location.reload()} />
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
