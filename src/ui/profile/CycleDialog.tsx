import { useState } from 'react';
import { startNextCycle } from '../../db/repo';
import type { CycleMode } from '../../program/cycle';
import { Overlay } from '../kit';

export function CycleDialog({ cycle, onClose }: { cycle: number; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const choose = async (mode: CycleMode) => {
    setBusy(true);
    await startNextCycle(cycle, mode);
    onClose();
  };
  return (
    <Overlay>
      <div className="dialog-backdrop">
        <div className="dialog card stack">
          <h2 className="card-title">Цикл {cycle} завершён 🎉</h2>
          <p className="muted">С каких весов начать цикл {cycle + 1}?</p>
          <button className="btn primary block option" disabled={busy} onClick={() => choose('program')}>
            <span>
              <b>Как в программе</b>
              <small>Веса недели 2, в упражнениях с подбором — вес Н3</small>
            </span>
          </button>
          <button className="btn block option" disabled={busy} onClick={() => choose('best')}>
            <span>
              <b>Лучшие результаты</b>
              <small>То же плюс перевыполнение недели 4, в подборе — вес Н4</small>
            </span>
          </button>
          <button className="btn block" disabled={busy} onClick={onClose}>
            Решу позже
          </button>
        </div>
      </div>
    </Overlay>
  );
}
