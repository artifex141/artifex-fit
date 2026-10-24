// История: дни с записями и суммой калорий, новые сверху; тап открывает день.
import { useLiveQuery } from 'dexie-react-hooks';
import { daysWithEntries } from '../../db/nutrition';
import { ChevronIcon } from '../kit';
import { Sheet } from './Sheet';
import { fmt } from './Summary';

const label = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
};

export function HistorySheet({ onPick, onClose }: { onPick: (date: string) => void; onClose: () => void }) {
  const days = useLiveQuery(daysWithEntries);
  return (
    <Sheet title="История" onClose={onClose}>
      {days && days.length === 0 && <p className="muted nt-sheet-sub">Записей пока нет</p>}
      <div className="nt-found-list">
        {(days ?? []).map((d) => (
          <button key={d.date} className="nt-day" onClick={() => onPick(d.date)}>
            <span>{label(d.date)}</span>
            <span className="muted">{fmt(d.kcal)} ккал</span>
            <ChevronIcon dir="right" />
          </button>
        ))}
      </div>
    </Sheet>
  );
}
