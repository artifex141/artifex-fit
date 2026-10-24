// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { db } from '../../db/db';
import { addEntries, getTargets, saveTargets, upsertFood } from '../../db/nutrition';
import { GramsSheet } from './GramsSheet';
import { HistorySheet } from './HistorySheet';
import { ManualSheet } from './ManualSheet';
import { Scanner } from './Scanner';
import { SearchSheet } from './SearchSheet';
import { TargetsSheet } from './TargetsSheet';

const OATS = { kcal: 350, p: 12, f: 6, c: 60 };

beforeEach(async () => {
  await Promise.all([db.entries.clear(), db.foods.clear(), db.settings.clear()]);
});
afterEach(cleanup);

test('граммы: пересчёт КБЖУ, +10, выбор приёма, сохранение', () => {
  const onSave = vi.fn();
  render(<GramsSheet food={{ name: 'Овсянка', per100: OATS, source: 'off' }} meal="breakfast" onSave={onSave} onClose={() => {}} />);
  expect(screen.getByLabelText('Граммы')).toHaveValue('100');
  expect(screen.getByText(/^350 ккал · Б 12 · Ж 6 · У 60$/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '+10 г' }));
  expect(screen.getByText(/385 ккал/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Ужин' }));
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  expect(onSave).toHaveBeenCalledWith(110, 'dinner');
});

test('граммы: правка записи — без выбора приёма', () => {
  render(<GramsSheet food={{ name: 'Овсянка', per100: OATS, source: 'ai' }} grams={250} onSave={() => {}} onClose={() => {}} />);
  expect(screen.getByLabelText('Граммы')).toHaveValue('250');
  expect(screen.queryByRole('button', { name: 'Ужин' })).not.toBeInTheDocument();
});

test('ручной ввод: нужно название и ккал; сохраняет продукт со штрихкодом', () => {
  const onSave = vi.fn();
  render(<ManualSheet barcode="4600000000009" meal="lunch" onSave={onSave} onClose={() => {}} />);
  const save = screen.getByRole('button', { name: 'Сохранить' });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Сырок' } });
  fireEvent.change(screen.getByLabelText('Ккал на 100 г'), { target: { value: '407' } });
  fireEvent.change(screen.getByLabelText('Белки'), { target: { value: '8,5' } });
  fireEvent.change(screen.getByLabelText('Граммы'), { target: { value: '45' } });
  expect(save).not.toBeDisabled();
  fireEvent.click(save);
  expect(onSave).toHaveBeenCalledWith({ name: 'Сырок', barcode: '4600000000009', per100: { kcal: 407, p: 8.5, f: 0, c: 0 }, source: 'manual' }, 45, 'lunch');
});

test('поиск: недавние продукты сразу, результаты сервера по запросу', async () => {
  await upsertFood({ source: 'manual', name: 'Банан', per100: { kcal: 89, p: 1.1, f: 0.3, c: 23 } });
  const search = vi.fn(async () => ({ items: [{ barcode: '1', name: 'Йогурт греческий', per100: { kcal: 66, p: 9, f: 2, c: 4 } }] }));
  const onPick = vi.fn();
  render(<SearchSheet onPick={onPick} onManual={() => {}} onClose={() => {}} search={search} />);
  expect(await screen.findByText('Банан')).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText(/Найти продукт/), { target: { value: 'йогурт' } });
  fireEvent.click(await screen.findByText('Йогурт греческий', {}, { timeout: 2000 }));
  expect(search).toHaveBeenCalledWith('йогурт');
  expect(onPick).toHaveBeenCalledWith({ barcode: '1', name: 'Йогурт греческий', per100: { kcal: 66, p: 9, f: 2, c: 4 }, source: 'off' });
});

test('история: дни с калориями, тап выбирает день', async () => {
  await addEntries('2026-10-21', 'lunch', [{ name: 'Овсянка', grams: 100, per100: OATS }]);
  const onPick = vi.fn();
  render(<HistorySheet onPick={onPick} onClose={() => {}} />);
  fireEvent.click(await screen.findByText(/350 ккал/));
  expect(onPick).toHaveBeenCalledWith('2026-10-21');
});

test('норма: свои цифры сохраняются, «Вернуть расчёт» сбрасывает', async () => {
  const auto = { kcal: 2920, p: 161, f: 81, c: 387, manual: false };
  const { unmount } = render(<TargetsSheet auto={auto} saved={null} onClose={() => {}} />);
  expect(screen.getByText(/Миффлин/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Ккал'), { target: { value: '2600' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить свои' }));
  await vi.waitFor(async () => expect(await getTargets()).toEqual({ kcal: 2600, p: 161, f: 81, c: 387, manual: true }));
  unmount();

  await saveTargets({ kcal: 2600, p: 161, f: 81, c: 387, manual: true });
  render(<TargetsSheet auto={auto} saved={{ kcal: 2600, p: 161, f: 81, c: 387, manual: true }} onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Вернуть расчёт' }));
  await vi.waitFor(async () => expect(await getTargets()).toBeNull());
});

test('сканер без камеры: подсказка и ввод кода вручную', async () => {
  const onCode = vi.fn();
  render(<Scanner onCode={onCode} onClose={() => {}} />);
  expect(await screen.findByText(/Нет доступа к камере/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Штрихкод'), { target: { value: '4600 0000 0000 1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Найти' }));
  expect(onCode).toHaveBeenCalledWith('4600000000001');
});
