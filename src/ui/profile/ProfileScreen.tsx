import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { cachedBody, inLb, loadBody, metric, type BodyData } from '../../body/body';
import { db } from '../../db/db';
import { getProfile, saveProfile } from '../../db/repo';
import { achievements, ageFrom, DEFAULT_PROFILE, formatHeight, GOAL_LABEL, goalProgress, type ProfileInfo } from '../../profile/profile';
import { ChevronIcon } from '../kit';
import { CharacterView } from './CharacterView';
import { SettingsScreen } from './SettingsScreen';
import './profile.css';
import './profile-main.css';

const sign = (v: number) => (v > 0 ? `+${v}` : `${v}`);
const dayLabel = (t: number) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).replace(' г.', '').replace('.', '');

const Icon = ({ d, fill }: { d: string; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const I = {
  pencil: 'M4 20l4.5-1 10-10-3.5-3.5-10 10L4 20zM14 6l3.5 3.5',
  bars: 'M6 19v-5M10 19v-9M14 19v-6M18 19V8',
  arm: 'M5 15c2-1 4-1 5 1 1-3 3-5 6-5 2 0 3 1 3 3-2 0-3 1-3 3v2H8c-2 0-4-1-3-4zM9 9c0-2 1-4 3-4',
  bone: 'M8.5 6.5a2 2 0 1 0-3 2.5l9 9a2 2 0 1 0 2.5-3 2 2 0 1 0-3-2.5l-9-9a2 2 0 0 0-2.5 3z',
  dumbbell: 'M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  run: 'M14 4.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM7 21l3.2-5.6 3 2.6V22M5 11.5l3.4-3.2 4.2.8 2 3 3.6 1M10.5 9l-1.8 6',
  moon: 'M20 15A8 8 0 1 1 9 4a7 7 0 0 0 11 11z',
  apple: 'M12 7c-1.5-1.5-6-2-7 2.5S7 20 9.5 20c1 0 1.5-.5 2.5-.5s1.5.5 2.5.5C17 20 20 14 19 9.5S13.5 5.5 12 7zM12 7c0-2 1-3.5 3-4',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12l7-7M16 5h3v3',
};

// Демо: шкалы состояния и метрики Apple Watch — пока нет источника данных (см. src/ui/demo.ts).
const STATE: { icon: string; label: string; score: number }[] = [
  { icon: I.dumbbell, label: 'Сила', score: 7 },
  { icon: I.heart, label: 'Выносливость', score: 6 },
  { icon: I.run, label: 'Подвижность', score: 6 },
  { icon: I.moon, label: 'Восстановление', score: 7 },
  { icon: I.apple, label: 'Питание', score: 6 },
  { icon: I.bars, label: 'Общий прогресс', score: 6 },
];

function Gauge({ frac }: { frac: number }) {
  const R = 44;
  const len = 2 * Math.PI * R * 0.75; // дуга 270°
  return (
    <svg viewBox="0 0 100 100" className="pf-gauge">
      <defs>
        <linearGradient id="pfg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd84a" />
          <stop offset="1" stopColor="#f0b400" />
        </linearGradient>
        <filter id="pfgf" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" strokeDasharray={`${len} 999`} strokeLinecap="round" transform="rotate(135 50 50)" />
      <circle cx="50" cy="50" r={R} fill="none" stroke="#f5c518" strokeOpacity="0.5" strokeWidth="7" strokeDasharray={`${len * frac} 999`} strokeLinecap="round" transform="rotate(135 50 50)" filter="url(#pfgf)" />
      <circle cx="50" cy="50" r={R} fill="none" stroke="url(#pfg)" strokeWidth="7" strokeDasharray={`${len * frac} 999`} strokeLinecap="round" transform="rotate(135 50 50)" />
    </svg>
  );
}

function EditSheet({ profile, onClose }: { profile: ProfileInfo; onClose: () => void }) {
  const ft0 = profile.heightCm ? Math.floor(profile.heightCm / 2.54 / 12) : '';
  const in0 = profile.heightCm ? Math.round((profile.heightCm / 2.54 - Number(ft0) * 12) * 10) / 10 : '';
  const [f, setF] = useState({ name: profile.name, birthYear: profile.birthYear ?? '', ft: ft0, inch: in0, goal: profile.goal, goalWeightLb: profile.goalWeightLb ?? '' });
  const num = (v: string | number) => {
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const save = async () => {
    const ft = num(f.ft);
    const inch = num(f.inch) ?? 0;
    await saveProfile({
      name: f.name.trim() || DEFAULT_PROFILE.name,
      birthYear: num(f.birthYear),
      heightCm: ft !== null ? Math.round((ft * 12 + inch) * 2.54 * 10) / 10 : null,
      goal: f.goal,
      goalWeightLb: num(f.goalWeightLb),
    });
    onClose();
  };
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog card stack" onClick={(e) => e.stopPropagation()}>
        <h2 className="card-title">Профиль</h2>
        <label className="pf-field">
          <span>Имя</span>
          <input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <div className="row">
          <label className="pf-field grow">
            <span>Год рождения</span>
            <input className="field" inputMode="numeric" value={f.birthYear} onChange={(e) => setF({ ...f, birthYear: e.target.value })} />
          </label>
          <label className="pf-field grow">
            <span>Рост, ft</span>
            <input className="field" inputMode="numeric" value={f.ft} onChange={(e) => setF({ ...f, ft: e.target.value })} />
          </label>
          <label className="pf-field grow">
            <span>in</span>
            <input className="field" inputMode="decimal" value={f.inch} onChange={(e) => setF({ ...f, inch: e.target.value })} />
          </label>
        </div>
        <div className="row">
          <label className="pf-field grow2">
            <span>Цель</span>
            <select className="field" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value as ProfileInfo['goal'] })}>
              {Object.entries(GOAL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="pf-field grow">
            <span>Целевой вес, lb</span>
            <input className="field" inputMode="decimal" value={f.goalWeightLb} onChange={(e) => setF({ ...f, goalWeightLb: e.target.value })} />
          </label>
        </div>
        <button className="btn primary block" onClick={save}>
          Сохранить
        </button>
      </div>
    </div>
  );
}

export function ProfileScreen({ onNewCycle }: { onNewCycle: (cycle: number) => void }) {
  const profile = useLiveQuery(getProfile) ?? DEFAULT_PROFILE;
  const workouts = useLiveQuery(() => db.workouts.toArray(), [], []);
  const [body, setBody] = useState<BodyData>(cachedBody);
  const [settings, setSettings] = useState(false);
  const [edit, setEdit] = useState(false);
  useEffect(() => {
    void loadBody().then(setBody);
  }, []);

  if (settings) return <SettingsScreen onNewCycle={onNewCycle} onClose={() => setSettings(false)} />;

  const now = Date.now();
  const weight = inLb(metric(body.weight, now));
  const fat = metric(body.bodyFat, now);
  const lean = inLb(metric(body.leanMass, now));
  const info = [profile.birthYear ? `${ageFrom(profile.birthYear, now)} лет` : null, profile.heightCm ? formatHeight(profile.heightCm) : null, weight ? `${weight.value} lb` : null].filter(Boolean);
  const goal = profile.goalWeightLb ? goalProgress(weight?.value ?? null, profile.goalWeightLb) : null;
  const ach = achievements(workouts, body, now);

  const bodyRows = [
    { icon: I.bars, value: fat ? `${fat.value}%` : '--%', label: 'Жир', delta: fat?.delta != null ? `${sign(fat.delta)}%` : null, up: (fat?.delta ?? 0) > 0 },
    { icon: I.arm, value: lean ? `${lean.value} lb` : '-- lb', label: 'Сухая масса', delta: lean?.delta != null ? `${sign(lean.delta)} lb` : null, up: (lean?.delta ?? 0) > 0 },
    { icon: I.bone, value: '6.8 lb', label: 'Костная масса', delta: '+0.2 lb', up: true }, // демо: в «Здоровье» нет
  ];

  return (
    <div className="pf">
      <div className="pf-stage">
        <CharacterView />

        <h1 className="pf-title">Профиль</h1>
        <button className="pf-edit" onClick={() => setEdit(true)}>
          <span className="pf-edit-icon">
            <Icon d={I.pencil} />
          </span>
          Редактировать
        </button>
        <button className="glass-btn pf-menu" aria-label="Настройки" onClick={() => setSettings(true)}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>

        <section className="pf-card pf-name" onClick={() => setEdit(true)}>
          <div className="pf-name-title">{profile.name}</div>
          <div className="pf-name-info">{info.length ? info.join('  •  ') : 'Заполни профиль'}</div>
        </section>

        <section className="pf-card pf-goal" onClick={() => setEdit(true)}>
          <div className="pf-goal-head">
            <span className="pf-goal-icon">
              <Icon d={I.target} />
            </span>
            <span>
              <b>Цель</b>
              <small>{GOAL_LABEL[profile.goal]}</small>
            </span>
          </div>
          <div className="pf-bar">
            <span style={{ width: `${(goal?.fraction ?? 0) * 100}%` }} />
          </div>
          <div className="pf-goal-foot">
            {goal ? (
              <span>
                <b>{goal.current ?? '--'}</b> / {goal.target} lb
              </span>
            ) : (
              <span className="muted">Задай целевой вес</span>
            )}
            <ChevronIcon dir="right" />
          </div>
        </section>

        <section className="pf-card pf-body">
          {bodyRows.map((r) => (
            <div key={r.label} className="pf-body-row">
              <span className="pf-round">
                <Icon d={r.icon} />
              </span>
              <span className="pf-body-text">
                <b>{r.value}</b>
                <span>{r.label}</span>
                {r.delta && (
                  <em>
                    {r.up ? '↑' : '↓'} {r.delta}
                  </em>
                )}
              </span>
              <ChevronIcon dir="right" />
            </div>
          ))}
        </section>

        <section className="pf-card pf-state">
          <div className="pf-card-head">
            <b>Текущее состояние</b>
            <span className="glass-btn pf-dots">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="6" cy="12" r="1.7" />
                <circle cx="12" cy="12" r="1.7" />
                <circle cx="18" cy="12" r="1.7" />
              </svg>
            </span>
          </div>
          {STATE.map((s) => (
            <div key={s.label} className="pf-state-row">
              <span className="pf-round">
                <Icon d={s.icon} />
              </span>
              <span className="pf-state-main">
                <span className="pf-state-label">
                  <span>{s.label}</span>
                  <span className="muted">{s.score}/10</span>
                </span>
                <span className="pf-bar thin">
                  <span style={{ width: `${s.score * 10}%` }} />
                </span>
              </span>
            </div>
          ))}
        </section>

        <section className="pf-card pf-ach">
          <div className="pf-card-head">
            <b>
              <svg viewBox="0 0 24 24" className="pf-ach-icon">
                <path d="M7 2h10v6l-5 3-5-3V2zM12 11a6 6 0 1 1 0 12 6 6 0 0 1 0-12z" fill="#f5c518" />
                <path d="M12 14.2l1.1 2.2 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3z" fill="#2b2203" />
              </svg>
              Достижения
            </b>
            <span className="pf-ach-count">
              <svg viewBox="0 0 24 24">
                <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z" fill="#f5c518" />
              </svg>
              {ach.length}
            </span>
          </div>
          {ach.length === 0 && <div className="pf-ach-empty">Первая награда — после первой тренировки</div>}
          {ach.slice(0, 2).map((a) => (
            <div key={a.id} className="pf-ach-row">
              <svg viewBox="0 0 40 46" className={`pf-badge ${a.tier}`}>
                <path d="M20 2l16 9v18l-16 9-16-9V11z" />
                <path d="M12 38l8 6 8-6" className="ribbon" />
                <path d="M20 13l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" className="star" />
              </svg>
              <span>
                <b>{a.title}</b>
                <small>{dayLabel(a.date)}</small>
              </span>
              <ChevronIcon dir="right" />
            </div>
          ))}
        </section>
      </div>

      <section className="pf-card pf-health">
        <div className="pf-health-head">
          <b>Метрики здоровья</b>
          <span className="pf-watch">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="6.5" y="6" width="11" height="12" rx="3" />
              <path d="M9 6l.6-3h4.8l.6 3M9 18l.6 3h4.8l.6-3" />
            </svg>
            Apple Watch
          </span>
          <span className="pf-today">
            Сегодня <ChevronIcon dir="down" />
          </span>
        </div>
        <div className="pf-health-grid">
          {[
            { icon: <svg viewBox="0 0 24 24"><path d={I.heart} fill="#f5c518" /></svg>, title: 'Пульс', value: <>62</>, unit: 'bpm', status: 'В норме', frac: 0.62 },
            { icon: <svg viewBox="0 0 24 24"><path d={I.moon} fill="#b9c4ff" /></svg>, title: 'Сон', value: <>7<small>ч</small> 48<small>м</small></>, unit: '', status: 'Хорошо', frac: 0.78 },
            { icon: <svg viewBox="0 0 24 24" fill="none" stroke="#f5c518" strokeWidth="2.2" strokeLinecap="round"><path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4" /></svg>, title: 'Восстановление', value: <>82<small>%</small></>, unit: '', status: 'Высокое', frac: 0.82 },
          ].map((m) => (
            <div key={m.title} className="pf-metric">
              <div className="pf-metric-head">
                {m.icon}
                <span>{m.title}</span>
                <span className="pf-info">i</span>
              </div>
              <div className="pf-metric-ring">
                <Gauge frac={m.frac} />
                <div className="pf-metric-val">
                  <b className={m.title === 'Сон' ? 'long' : undefined}>{m.value}</b>
                  {m.unit && <span>{m.unit}</span>}
                </div>
                <span className="pf-metric-status">{m.status}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {edit && <EditSheet profile={profile} onClose={() => setEdit(false)} />}
    </div>
  );
}
