// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from 'vitest';
import { db } from '../../db/db';
import { addEntries, saveTargets, upsertFood } from '../../db/nutrition';
import { saveProfile } from '../../db/repo';
import { dayKey } from '../../nutrition/calc';
import { NutritionScreen } from './NutritionScreen';

const OATS = { kcal: 100, p: 4, f: 2, c: 18 };
const today = dayKey(new Date());

beforeEach(async () => {
  await Promise.all([db.entries.clear(), db.foods.clear(), db.photos.clear(), db.settings.clear()]);
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('сводка дня и суммы приёмов из записей; норма — из сохранённой', async () => {
  await saveTargets({ kcal: 2400, p: 180, f: 80, c: 300, manual: true });
  await addEntries(today, 'breakfast', [
    { name: 'Овсянка', grams: 250, per100: OATS },
    { name: 'Банан', grams: 100, per100: { kcal: 89, p: 1.1, f: 0.3, c: 23 } },
  ]);
  await addEntries(today, 'dinner', [{ name: 'Курица', grams: 200, per100: { kcal: 165, p: 31, f: 3.6, c: 0 } }]);
  render(<NutritionScreen />);

  const ring = await screen.findByTestId('nt-ring');
  await vi.waitFor(() => expect(ring).toHaveTextContent(/669/));
  expect(ring).toHaveTextContent(/из 2\s400/);
  expect(screen.getByTestId('nt-macro-p')).toHaveTextContent(/73\s*\/\s*180 г/);

  const breakfast = screen.getByRole('region', { name: 'Завтрак' });
  expect(within(breakfast).getByText(/339 ккал/)).toBeInTheDocument();
  expect(within(breakfast).getByText(/Б 11 г · Ж 5 г · У 68 г/)).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Ужин' })).toHaveTextContent(/330 ккал/);
});

test('раскрытие приёма показывает продукты; удаление через «…»', async () => {
  // Утро: по умолчанию раскрыт завтрак, обед свёрнут — иначе результат зависел бы от часа запуска теста.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 24, 8, 0));
  onTestFinished(() => vi.useRealTimers());
  await saveTargets({ kcal: 2400, p: 180, f: 80, c: 300, manual: true });
  await addEntries(dayKey(new Date()), 'lunch', [{ name: 'Гречка', grams: 150, per100: OATS }]);
  render(<NutritionScreen />);
  const lunch = await screen.findByRole('region', { name: 'Обед' });
  const toggle = within(lunch).getByRole('button', { name: 'Показать продукты' });
  fireEvent.click(toggle);
  expect(await within(lunch).findByText('Гречка')).toBeInTheDocument();
  expect(within(lunch).getByText(/150 ккал · Б 6 г · Ж 3 г · У 27 г/)).toBeInTheDocument();

  fireEvent.click(within(lunch).getByRole('button', { name: 'Действия: Гречка' }));
  fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
  await vi.waitFor(async () => expect(await db.entries.count()).toBe(0));
});

test('без нормы и профиля — просьба заполнить профиль; с профилем — расчёт', async () => {
  render(<NutritionScreen />);
  expect(await screen.findByText(/Заполни профиль/)).toBeInTheDocument();
  cleanup();

  await saveProfile({ name: 'А', birthYear: new Date().getFullYear() - 28, heightCm: 179, goal: 'mass', goalWeightLb: null });
  localStorage.setItem('artifex.body', JSON.stringify({ weight: [{ date: Date.now(), value: 160.7 / 2.20462 }] }));
  render(<NutritionScreen />);
  const ring = await screen.findByTestId('nt-ring');
  await vi.waitFor(() => expect(ring).toHaveTextContent(/из 2\s920/));
  expect(screen.queryByText(/Заполни профиль/)).not.toBeInTheDocument();
});

test('после полуночи «Сегодня» переходит на новый день (приложение вернули из фона)', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date(2026, 9, 23, 23, 50));
    await saveTargets({ kcal: 2400, p: 180, f: 80, c: 300, manual: true });
    await addEntries('2026-10-23', 'dinner', [{ name: 'Курица', grams: 200, per100: { kcal: 165, p: 31, f: 3.6, c: 0 } }]);
    render(<NutritionScreen />);
    const ring = await screen.findByTestId('nt-ring');
    await vi.waitFor(() => expect(ring).toHaveTextContent(/330/));

    vi.setSystemTime(new Date(2026, 9, 24, 8, 0));
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(ring).not.toHaveTextContent(/330/));
    expect(screen.getByRole('button', { name: /Сегодня/ })).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test('сканер: свой продукт со штрихкодом находится без сервера', async () => {
  await upsertFood({ source: 'manual', name: 'Сырок', barcode: '4600000000009', per100: { kcal: 407, p: 8.5, f: 27, c: 32 } });
  render(<NutritionScreen />);
  fireEvent.click(await screen.findByRole('button', { name: 'Сканировать' }));
  fireEvent.change(await screen.findByLabelText('Штрихкод'), { target: { value: '4600000000009' } });
  fireEvent.click(screen.getByRole('button', { name: 'Найти' }));
  expect(await screen.findByRole('dialog', { name: 'Сырок' })).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/food/barcode'));
});

test('«+» даёт выбор: снять фото или взять из медиатеки (без capture)', async () => {
  const { container } = render(<NutritionScreen />);
  await screen.findByTestId('nt-ring');
  const input = container.querySelector('input[type=file]')!;
  expect(input).toHaveAttribute('accept', 'image/*');
  expect(input).not.toHaveAttribute('capture');
});
