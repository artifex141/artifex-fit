// Нижний лист «Питания»: поверх экрана проверки фото, прокручивается, если не помещается.
import type { ReactNode } from 'react';
import { MEAL_LABEL, MEALS, type Meal, type Per100 } from '../../nutrition/calc';
import { Overlay } from '../kit';

/** Продукт, выбранный для записи: из поиска/штрихкода, вручную или из распознавания. */
export interface FoodPick {
  name: string;
  brand?: string;
  barcode?: string;
  image?: string;
  per100: Per100;
  source: 'ai' | 'off' | 'manual';
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Overlay>
      <div className="dialog-backdrop nt-sheet-back" onClick={onClose}>
        <div className="dialog card stack nt-sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
          <div className="nt-sheet-head">
            <h2 className="card-title">{title}</h2>
            <button className="nt-sheet-x" aria-label="Закрыть" onClick={onClose}>
              ×
            </button>
          </div>
          {children}
        </div>
      </div>
    </Overlay>
  );
}

export function MealChips({ value, onChange }: { value: Meal; onChange: (m: Meal) => void }) {
  return (
    <div className="nt-chips">
      {MEALS.map((m) => (
        <button key={m} type="button" className={m === value ? 'chip on' : 'chip'} aria-pressed={m === value} onClick={() => onChange(m)}>
          {MEAL_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

/** «8,5» → 8.5; пусто или мусор → null. */
export const parseNum = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
