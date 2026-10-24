// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { db } from '../../db/db';
import { addEntries, saveTargets } from '../../db/nutrition';
import { setPosition } from '../../db/repo';
import { dayKey } from '../../nutrition/calc';
import { ProfileScreen } from './ProfileScreen';

beforeEach(async () => {
  await Promise.all([db.entries.clear(), db.settings.clear(), db.sets.clear(), db.workouts.clear()]);
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('метрики: питание — калории дня к норме, прогресс — тренировки цикла', async () => {
  await saveTargets({ kcal: 2400, p: 180, f: 80, c: 300, manual: true });
  await addEntries(dayKey(new Date()), 'dinner', [{ name: 'Курица', grams: 200, per100: { kcal: 165, p: 31, f: 3.6, c: 0 } }]);
  await setPosition({ cycle: 1, day: 12 });
  render(<ProfileScreen onNewCycle={() => {}} />);

  expect(screen.getByText('Метрики')).toBeInTheDocument();
  expect(screen.queryByText('Текущее состояние')).not.toBeInTheDocument();
  await vi.waitFor(() => expect(screen.getByTestId('metric-Питание')).toHaveTextContent('330/2400'));
  await vi.waitFor(() => expect(screen.getByTestId('metric-Прогресс')).toHaveTextContent('5/15'));
  expect(screen.getByTestId('metric-Сила')).toHaveTextContent('—');
});
