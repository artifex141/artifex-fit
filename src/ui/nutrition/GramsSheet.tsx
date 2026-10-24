// Сколько граммов: пересчёт КБЖУ на порцию, ±10 г, выбор приёма (кроме правки готовой записи).
import { useState } from 'react';
import { scale, type Meal } from '../../nutrition/calc';
import { MinusIcon, PlusIcon } from './icons';
import { MealChips, Sheet, type FoodPick } from './Sheet';
import { macroLine } from './Summary';

export function GramsSheet({
  food,
  grams: initial = 100,
  meal: initialMeal,
  onSave,
  onClose,
}: {
  food: FoodPick;
  grams?: number;
  meal?: Meal;
  onSave: (grams: number, meal: Meal) => void;
  onClose: () => void;
}) {
  const [grams, setGrams] = useState(initial);
  const [meal, setMeal] = useState<Meal>(initialMeal ?? 'snack');
  return (
    <Sheet title={food.name} onClose={onClose}>
      {food.brand && <p className="muted nt-sheet-sub">{food.brand}</p>}
      <p className="muted nt-sheet-sub">На 100 г: {macroLine(food.per100)}</p>
      <div className="nt-grams">
        <button className="glass-btn nt-step" aria-label="−10 г" onClick={() => setGrams((g) => Math.max(1, g - 10))}>
          <MinusIcon />
        </button>
        <input
          className="field nt-grams-input"
          inputMode="numeric"
          aria-label="Граммы"
          value={grams || ''}
          onChange={(e) => setGrams(Math.min(5000, Number(e.target.value.replace(/\D/g, '')) || 0))}
        />
        <span className="muted">г</span>
        <button className="glass-btn nt-step" aria-label="+10 г" onClick={() => setGrams((g) => g + 10)}>
          <PlusIcon />
        </button>
      </div>
      <p className="nt-portion">{macroLine(scale(food.per100, grams))}</p>
      {initialMeal && <MealChips value={meal} onChange={setMeal} />}
      <button className="btn primary block" disabled={grams <= 0} onClick={() => onSave(grams, meal)}>
        Сохранить
      </button>
    </Sheet>
  );
}
