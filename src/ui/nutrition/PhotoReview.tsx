// Ввод по фото: превью и подсказка → распознавание → проверка граммов → «Сохранить в <приём>».
import { useEffect, useState } from 'react';
import { addEntries, upsertFood } from '../../db/nutrition';
import { MEAL_LABEL, scale, sumMacros, type Meal } from '../../nutrition/calc';
import { recognizePhoto, resizeImage, type ReviewItem } from '../../nutrition/photo';
import { ChevronIcon, Overlay } from '../kit';
import { macroLine } from './Summary';
import { MinusIcon, PlusIcon } from './icons';
import './photo-review.css';

type Stage = { kind: 'hint' } | { kind: 'loading' } | { kind: 'error'; text: string } | { kind: 'review'; dish: string };

export function PhotoReview({
  file,
  date,
  meal,
  onClose,
  onManual,
  pickProduct,
  recognize = recognizePhoto,
  resize = resizeImage,
}: {
  file: Blob;
  date: string;
  meal: Meal;
  onClose: () => void;
  onManual?: () => void;
  pickProduct?: (add: (it: ReviewItem) => void) => void;
  recognize?: (image: Blob, hint: string) => Promise<{ items: ReviewItem[]; dish: string } | { error: string }>;
  resize?: (file: Blob, max: number, quality: number) => Promise<Blob>;
}) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const [stage, setStage] = useState<Stage>({ kind: 'hint' });
  const [hint, setHint] = useState('');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [saving, setSaving] = useState(false);

  const run = async () => {
    setStage({ kind: 'loading' });
    try {
      const r = await recognize(await resize(file, 1024, 0.8), hint);
      if ('error' in r) return setStage({ kind: 'error', text: r.error });
      setItems(r.items);
      setStage({ kind: 'review', dish: r.dish });
    } catch {
      setStage({ kind: 'error', text: 'Не удалось прочитать фото — попробуй другой снимок' });
    }
  };

  const update = (i: number, patch: Partial<ReviewItem>) => setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const valid = items.filter((it) => it.name.trim() && it.grams > 0);
  const total = sumMacros(valid.map((it) => scale(it.per100, it.grams)));

  const save = async () => {
    setSaving(true);
    try {
      const thumb = await resize(file, 512, 0.75).catch(() => undefined);
      const rows = [];
      for (const it of valid) rows.push({ ...it, name: it.name.trim(), foodId: await upsertFood({ source: 'ai', name: it.name.trim(), per100: it.per100 }) });
      await addEntries(date, meal, rows, thumb);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay>
      <div className="pr">
        <header className="pr-head">
          <button className="glass-btn pr-back" aria-label="Закрыть" onClick={onClose}>
            <ChevronIcon dir="left" />
          </button>
          <h2>{MEAL_LABEL[meal]}</h2>
        </header>

        {preview && <img className="pr-photo" src={preview} alt="Фото блюда" />}

        {(stage.kind === 'hint' || stage.kind === 'loading') && (
          <div className="pr-hint">
            <textarea
              className="field"
              rows={2}
              maxLength={200}
              placeholder="Подсказка (необязательно): например, «соус отдельно, рис 200 г»"
              value={hint}
              disabled={stage.kind === 'loading'}
              onChange={(e) => setHint(e.target.value)}
            />
            <button className="btn primary block" disabled={stage.kind === 'loading'} onClick={run}>
              {stage.kind === 'loading' ? 'Распознаю…' : 'Распознать'}
            </button>
          </div>
        )}

        {stage.kind === 'error' && (
          <div className="pr-msg">
            <p>{stage.text}</p>
            <div className="row">
              <button className="btn grow" onClick={run}>
                Повторить
              </button>
              {onManual && (
                <button className="btn grow" onClick={onManual}>
                  Добавить вручную
                </button>
              )}
            </div>
          </div>
        )}

        {stage.kind === 'review' && items.length === 0 && (
          <div className="pr-msg">
            <p>Еды на фото не нашлось. Попробуй другой ракурс или добавь продукт вручную.</p>
            <div className="row">
              <button className="btn grow" onClick={() => setStage({ kind: 'hint' })}>
                Повторить
              </button>
              {onManual && (
                <button className="btn grow" onClick={onManual}>
                  Добавить вручную
                </button>
              )}
            </div>
          </div>
        )}

        {stage.kind === 'review' && items.length > 0 && (
          <>
            {stage.dish && <div className="pr-dish">{stage.dish}</div>}
            <div className="pr-items">
              {items.map((it, i) => (
                <div key={i} className="pr-item">
                  <div className="pr-item-top">
                    <input className="pr-name" value={it.name} aria-label="Название" onChange={(e) => update(i, { name: e.target.value })} />
                    <button className="pr-del" aria-label={`Убрать: ${it.name}`} onClick={() => setItems((l) => l.filter((_, j) => j !== i))}>
                      ×
                    </button>
                  </div>
                  <div className="pr-item-bottom">
                    <button className="glass-btn pr-step" aria-label={`${it.name}: −10 г`} onClick={() => update(i, { grams: Math.max(1, it.grams - 10) })}>
                      <MinusIcon />
                    </button>
                    <input
                      className="pr-grams"
                      inputMode="numeric"
                      aria-label={`${it.name}: граммы`}
                      value={it.grams || ''}
                      onChange={(e) => update(i, { grams: Math.min(5000, Number(e.target.value.replace(/\D/g, '')) || 0) })}
                    />
                    <span className="pr-g">г</span>
                    <button className="glass-btn pr-step" aria-label={`${it.name}: +10 г`} onClick={() => update(i, { grams: it.grams + 10 })}>
                      <PlusIcon />
                    </button>
                    <span className="pr-macros">{macroLine(scale(it.per100, it.grams))}</span>
                  </div>
                </div>
              ))}
            </div>
            {pickProduct && (
              <button className="btn block pr-add" onClick={() => pickProduct((it) => setItems((l) => [...l, it]))}>
                <PlusIcon /> Продукт
              </button>
            )}
            <div className="pr-total">
              <span>Итого</span>
              <b>{macroLine(total)}</b>
            </div>
            <div className="pr-save">
              <button className="btn primary block" disabled={saving || valid.length === 0} onClick={save}>
                Сохранить в {MEAL_LABEL[meal]}
              </button>
            </div>
          </>
        )}
      </div>
    </Overlay>
  );
}
