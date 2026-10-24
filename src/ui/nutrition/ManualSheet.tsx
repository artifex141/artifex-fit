// Ручной ввод продукта: название, граммы, КБЖУ на 100 г (с упаковки).
import { useState } from 'react';
import type { Meal } from '../../nutrition/calc';
import { MealChips, parseNum, Sheet, type FoodPick } from './Sheet';

export function ManualSheet({
  barcode,
  meal: initialMeal,
  note,
  onSave,
  onClose,
}: {
  barcode?: string;
  meal?: Meal;
  note?: string;
  onSave: (food: FoodPick, grams: number, meal: Meal) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({ name: '', grams: '100', kcal: '', p: '', f: '', c: '' });
  const [meal, setMeal] = useState<Meal>(initialMeal ?? 'snack');
  const grams = parseNum(f.grams);
  const kcal = parseNum(f.kcal);
  const ok = f.name.trim() !== '' && grams !== null && grams > 0 && kcal !== null;
  const field = (key: keyof typeof f, label: string, mode: 'text' | 'decimal' = 'decimal') => (
    <label className="pf-field grow">
      <span>{label}</span>
      <input className="field" aria-label={label} inputMode={mode} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
    </label>
  );
  const save = () => {
    if (!ok) return;
    const food: FoodPick = { name: f.name.trim(), per100: { kcal: Math.round(kcal), p: parseNum(f.p) ?? 0, f: parseNum(f.f) ?? 0, c: parseNum(f.c) ?? 0 }, source: 'manual' };
    if (barcode) food.barcode = barcode;
    onSave(food, Math.round(grams), meal);
  };
  return (
    <Sheet title="Добавить вручную" onClose={onClose}>
      {note && <p className="hint">{note}</p>}
      {barcode && <p className="muted nt-sheet-sub">Штрихкод {barcode} — перепиши данные с упаковки, в следующий раз продукт найдётся сам.</p>}
      {field('name', 'Название', 'text')}
      <div className="row">
        {field('grams', 'Граммы')}
        {field('kcal', 'Ккал на 100 г')}
      </div>
      <div className="row">
        {field('p', 'Белки')}
        {field('f', 'Жиры')}
        {field('c', 'Углеводы')}
      </div>
      {initialMeal && <MealChips value={meal} onChange={setMeal} />}
      <button className="btn primary block" disabled={!ok} onClick={save}>
        Сохранить
      </button>
    </Sheet>
  );
}
