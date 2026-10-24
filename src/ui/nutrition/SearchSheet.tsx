// Поиск продукта: сначала недавние, по запросу — Open Food Facts (с задержкой 400 мс).
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { recentFoods } from '../../db/nutrition';
import { searchFoods, type OffFood } from '../../nutrition/foodApi';
import { PlateIcon } from './icons';
import { Sheet, type FoodPick } from './Sheet';
import { fmt } from './Summary';

type Result = { kind: 'idle' } | { kind: 'loading' } | { kind: 'items'; items: OffFood[] } | { kind: 'error'; text: string };

function Row({ food, onPick }: { food: FoodPick; onPick: (f: FoodPick) => void }) {
  return (
    <button className="nt-found" onClick={() => onPick(food)}>
      <span className="nt-found-thumb">{food.image ? <img src={food.image} alt="" /> : <PlateIcon />}</span>
      <span className="nt-found-text">
        <span>{food.name}</span>
        <small>
          {food.brand ? `${food.brand} · ` : ''}
          {fmt(food.per100.kcal)} ккал на 100 г
        </small>
      </span>
    </button>
  );
}

export function SearchSheet({
  onPick,
  onManual,
  onClose,
  search = searchFoods,
}: {
  onPick: (f: FoodPick) => void;
  onManual: () => void;
  onClose: () => void;
  search?: (q: string) => Promise<{ items: OffFood[] } | { error: string }>;
}) {
  const [q, setQ] = useState('');
  const [result, setResult] = useState<Result>({ kind: 'idle' });
  const recent = useLiveQuery(() => recentFoods(), []) ?? [];
  const query = q.trim();

  useEffect(() => {
    if (query.length < 2) return setResult({ kind: 'idle' });
    let live = true;
    setResult({ kind: 'loading' });
    const t = setTimeout(async () => {
      const r = await search(query);
      if (live) setResult('error' in r ? { kind: 'error', text: r.error } : { kind: 'items', items: r.items });
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, search]);

  const local = recent.filter((f) => query.length < 2 || f.name.toLowerCase().includes(query.toLowerCase()));
  const pickOff = (f: OffFood) => onPick({ ...f, source: 'off' });

  return (
    <Sheet title="Поиск продуктов" onClose={onClose}>
      <input className="field" type="search" placeholder="Найти продукт: «творог 5%»" value={q} onChange={(e) => setQ(e.target.value)} />
      {local.length > 0 && (
        <div className="nt-found-list">
          <div className="nt-found-caption">{query.length < 2 ? 'Недавние' : 'Мои продукты'}</div>
          {local.map((f) => (
            <Row key={f.id} food={{ name: f.name, brand: f.brand, barcode: f.barcode, image: f.image, per100: f.per100, source: f.source }} onPick={onPick} />
          ))}
        </div>
      )}
      {result.kind === 'loading' && <p className="muted nt-sheet-sub">Ищу…</p>}
      {result.kind === 'error' && <p className="hint">{result.text}</p>}
      {result.kind === 'items' && (
        <div className="nt-found-list">
          <div className="nt-found-caption">Open Food Facts</div>
          {result.items.length === 0 && <p className="muted nt-sheet-sub">Ничего не нашлось</p>}
          {result.items.map((f, i) => (
            <Row key={`${f.barcode ?? ''}-${i}`} food={{ ...f, source: 'off' }} onPick={() => pickOff(f)} />
          ))}
        </div>
      )}
      <button className="btn block" onClick={onManual}>
        Нет нужного — ввести вручную
      </button>
    </Sheet>
  );
}
