// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { SetRow, type SetRowProps } from './SetRow';

afterEach(cleanup);

const base: SetRowProps = {
  n: 1,
  rule: { kind: 'fixed', lb: 70 },
  step: 2.5,
  withDrop: false,
  status: 'active',
  suggest: { lb: 70, reps: 10 },
  onSave: () => {},
  onUndo: () => {},
};

const weightInput = () => screen.getAllByRole('textbox')[0] as HTMLInputElement;

test('активный подход: поля с подставленным весом и кнопка ✓', () => {
  render(<SetRow {...base} />);
  expect(weightInput().value).toBe('70');
  expect(screen.getByRole('button', { name: 'Записать подход' })).not.toBeDisabled();
});

test('активный подход подхватывает новый подставленный вес', () => {
  const { rerender } = render(<SetRow {...base} />);
  rerender(<SetRow {...base} suggest={{ lb: 75, reps: 10 }} />);
  expect(weightInput().value).toBe('75');
});

test('будущий подход: «- -» и неактивная ✓', () => {
  render(<SetRow {...base} status="future" />);
  expect(screen.getAllByText('- -')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Записать подход' })).toBeDisabled();
});

test('после ✓ на месте полей — таймер отдыха', () => {
  render(
    <SetRow
      {...base}
      status="done"
      fact={{ lb: 22.5, reps: 12 }}
      rest={{ left: 92, duration: 120, paused: false, onToggle: () => {} }}
    />,
  );
  expect(screen.getByText('01:32')).toBeInTheDocument();
  expect(screen.getByText('Отдых после 1 подхода')).toBeInTheDocument();
  expect(screen.getByText('22.5 lb × 12 повт.')).toBeInTheDocument();
  expect(screen.queryAllByRole('textbox')).toHaveLength(0);
});

test('после отмены подхода в полях остаются записанные значения, а не подсказка', () => {
  const { rerender } = render(<SetRow {...base} status="done" fact={{ lb: 72.5, reps: 10 }} />);
  fireEvent.click(screen.getByRole('button', { name: /Подход 1/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Удалить подход' }));
  rerender(<SetRow {...base} status="active" suggest={{ lb: 70, reps: 10 }} />);
  expect(weightInput().value).toBe('72.5');
});
