// Карточка приёма пищи: иконка, сумма «ккал · Б · Ж · У», жёлтый «+», раскрытие списка продуктов.
import type { ReactNode } from 'react';
import type { EntryRow } from '../../db/nutrition';
import { MEAL_LABEL, sumMacros, type Macros, type Meal } from '../../nutrition/calc';
import { ChevronIcon } from '../kit';
import { fmt } from './Summary';
import { CupIcon, DotsIcon, MoonIcon, PlateIcon, PlusIcon, SunIcon } from './icons';

const MEAL_ICON: Record<Meal, ReactNode> = { breakfast: <SunIcon />, lunch: <SunIcon />, dinner: <MoonIcon />, snack: <CupIcon /> };

/** «420 ккал · Б 28 г · Ж 14 г · У 45 г»: ккал отдельно (на макете подчёркнуты). */
function MacroLine({ m, className }: { m: Macros; className: string }) {
  return (
    <span className={className}>
      <u>{fmt(m.kcal)} ккал</u>
      {` · Б ${fmt(m.p)} г · Ж ${fmt(m.f)} г · У ${fmt(m.c)} г`}
    </span>
  );
}

export function MealCard({
  meal,
  entries,
  thumbs,
  expanded,
  onToggle,
  onAdd,
  onItem,
}: {
  meal: Meal;
  entries: EntryRow[];
  thumbs: Map<number, string>;
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onItem: (e: EntryRow) => void;
}) {
  const label = MEAL_LABEL[meal];
  return (
    <section className={`nt-card nt-meal${expanded ? ' open' : ''}`} aria-label={label}>
      <div className="nt-meal-head">
        <span className="nt-meal-icon">{MEAL_ICON[meal]}</span>
        <span className="nt-meal-title">
          <b>{label}</b>
          <MacroLine m={sumMacros(entries)} className="nt-line" />
        </span>
        <button className="nt-plus" aria-label={`Добавить: ${label}`} onClick={onAdd}>
          <PlusIcon />
        </button>
        <button className="glass-btn nt-chev" aria-label={expanded ? 'Скрыть продукты' : 'Показать продукты'} aria-expanded={expanded} onClick={onToggle}>
          <ChevronIcon dir={expanded ? 'up' : 'down'} />
        </button>
      </div>
      {expanded && (
        <div className="nt-items">
          {entries.length === 0 && <div className="nt-empty">Пока пусто — нажми «+» и сфотографируй еду</div>}
          {entries.map((e) => {
            const src = e.id !== undefined ? thumbs.get(e.id) : undefined;
            return (
              <div key={e.id} className="nt-item">
                <span className="nt-thumb">{src ? <img src={src} alt="" /> : <PlateIcon />}</span>
                <span className="nt-item-text">
                  <span className="nt-item-name">{e.name}</span>
                  <span className="nt-line">{`${fmt(e.kcal)} ккал · Б ${fmt(e.p)} г · Ж ${fmt(e.f)} г · У ${fmt(e.c)} г`}</span>
                </span>
                <button className="nt-dots" aria-label={`Действия: ${e.name}`} onClick={() => onItem(e)}>
                  <DotsIcon />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
