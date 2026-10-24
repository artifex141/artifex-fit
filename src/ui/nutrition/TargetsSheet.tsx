// Дневная норма: расчёт по профилю (с пояснением) или свои цифры.
import { useState } from 'react';
import { clearTargets, saveTargets } from '../../db/nutrition';
import type { Targets } from '../../nutrition/calc';
import { parseNum, Sheet } from './Sheet';
import { fmt } from './Summary';

const KEYS = [
  { key: 'kcal', label: 'Ккал' },
  { key: 'p', label: 'Белки, г' },
  { key: 'f', label: 'Жиры, г' },
  { key: 'c', label: 'Углеводы, г' },
] as const;

export function TargetsSheet({ auto, saved, onClose }: { auto: Targets | null; saved: Targets | null; onClose: () => void }) {
  const base = saved ?? auto;
  const [f, setF] = useState(() => Object.fromEntries(KEYS.map(({ key }) => [key, base ? String(base[key]) : ''])) as Record<(typeof KEYS)[number]['key'], string>);
  const nums = KEYS.map(({ key }) => parseNum(f[key]));
  const ok = nums.every((n) => n !== null) && (nums[0] ?? 0) > 0;
  const save = async () => {
    const [kcal, p, fat, c] = nums.map((n) => Math.round(n ?? 0));
    await saveTargets({ kcal, p, f: fat, c, manual: true });
    onClose();
  };
  return (
    <Sheet title="Дневная норма" onClose={onClose}>
      {auto ? (
        <p className="muted nt-sheet-sub">
          Расчёт: {fmt(auto.kcal)} ккал · Б {auto.p} · Ж {auto.f} · У {auto.c}. Формула Миффлина — Сан Жеора × 1,55 (три тренировки в неделю) с поправкой на цель из профиля; белок — 1 г на фунт веса, жиры — 25 % калорий, углеводы — остаток.
        </p>
      ) : (
        <p className="muted nt-sheet-sub">Для расчёта по формуле Миффлина — Сан Жеора заполни в профиле год рождения и рост; вес берётся из Zepp Life. Или задай свои цифры.</p>
      )}
      <div className="row nt-targets">
        {KEYS.map(({ key, label }) => (
          <label key={key} className="pf-field grow">
            <span>{label}</span>
            <input className="field" aria-label={label.replace(', г', '')} inputMode="numeric" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
          </label>
        ))}
      </div>
      <button className="btn primary block" disabled={!ok} onClick={save}>
        Сохранить свои
      </button>
      {saved && (
        <button
          className="btn block"
          onClick={async () => {
            await clearTargets();
            onClose();
          }}
        >
          Вернуть расчёт
        </button>
      )}
    </Sheet>
  );
}
