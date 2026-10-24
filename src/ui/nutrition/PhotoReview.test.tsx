// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { db } from '../../db/db';
import { PhotoReview } from './PhotoReview';

const photo = new Blob(['jpg'], { type: 'image/jpeg' });
const resize = vi.fn(async (b: Blob) => b);
const CHICKEN = { name: 'Куриная грудка', grams: 150, per100: { kcal: 165, p: 31, f: 3.6, c: 0 } };
const RICE = { name: 'Рис', grams: 200, per100: { kcal: 130, p: 2.7, f: 0.3, c: 28 } };

beforeEach(async () => {
  await Promise.all([db.entries.clear(), db.foods.clear(), db.photos.clear()]);
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

test('распознать → поправить граммы и удалить строку → сохранить в приём с фото', async () => {
  const recognize = vi.fn(async () => ({ dish: 'Курица с рисом', items: [CHICKEN, RICE] }));
  const onClose = vi.fn();
  render(<PhotoReview file={photo} date="2026-10-23" meal="lunch" onClose={onClose} recognize={recognize} resize={resize} />);

  fireEvent.change(screen.getByPlaceholderText(/Подсказка/), { target: { value: 'без соуса' } });
  fireEvent.click(screen.getByRole('button', { name: 'Распознать' }));
  expect(await screen.findByDisplayValue('150')).toBeInTheDocument();
  expect(recognize).toHaveBeenCalledWith(photo, 'без соуса');
  expect(screen.getByText(/508 ккал/)).toBeInTheDocument(); // 248 + 260

  fireEvent.click(screen.getByRole('button', { name: 'Куриная грудка: +10 г' }));
  expect(screen.getByDisplayValue('160')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Убрать: Рис' }));
  expect(screen.queryByDisplayValue('Рис')).not.toBeInTheDocument();
  expect(screen.getByText('Итого').parentElement).toHaveTextContent(/264 ккал/);

  fireEvent.click(screen.getByRole('button', { name: 'Сохранить в Обед' }));
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  const [e] = await db.entries.toArray();
  expect(e).toMatchObject({ date: '2026-10-23', meal: 'lunch', name: 'Куриная грудка', grams: 160, kcal: 264 });
  expect(e.photoId).toBeDefined();
  expect((await db.foods.get(e.foodId!))?.source).toBe('ai');
});

test('ошибка распознавания — текст и «Повторить»; фото остаётся', async () => {
  const recognize = vi.fn().mockResolvedValueOnce({ error: 'Лимит 60 фото в сутки исчерпан' }).mockResolvedValueOnce({ dish: '', items: [CHICKEN] });
  render(<PhotoReview file={photo} date="2026-10-23" meal="dinner" onClose={() => {}} recognize={recognize} resize={resize} />);
  fireEvent.click(screen.getByRole('button', { name: 'Распознать' }));
  expect(await screen.findByText('Лимит 60 фото в сутки исчерпан')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  expect(await screen.findByDisplayValue('Куриная грудка')).toBeInTheDocument();
  expect(recognize).toHaveBeenCalledTimes(2);
});

test('на фото нет еды — сообщение вместо пустого списка', async () => {
  render(<PhotoReview file={photo} date="2026-10-23" meal="snack" onClose={() => {}} recognize={async () => ({ dish: '', items: [] })} resize={resize} />);
  fireEvent.click(screen.getByRole('button', { name: 'Распознать' }));
  expect(await screen.findByText(/Еды на фото не нашлось/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Сохранить/ })).not.toBeInTheDocument();
});
