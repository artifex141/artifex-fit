// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { SetRow } from './SetRow';

afterEach(cleanup);

const props = {
  n: 1,
  rule: { kind: 'fixed', lb: 70 } as const,
  step: 2.5,
  withDrop: false,
  disabled: false,
  onSave: () => {},
  onUndo: () => {},
};

test('после отмены подхода в полях остаются записанные значения, а не подсказка', () => {
  const { rerender } = render(<SetRow {...props} done initial={{ lb: 72.5, reps: 10 }} />);
  rerender(<SetRow {...props} done={false} initial={{ lb: 70, reps: 10 }} />);
  expect((screen.getAllByRole('textbox')[0] as HTMLInputElement).value).toBe('72.5');
});

test('невыполненный подход подхватывает новый подставленный вес', () => {
  const { rerender } = render(<SetRow {...props} done={false} initial={{ lb: 70, reps: 10 }} />);
  rerender(<SetRow {...props} done={false} initial={{ lb: 75, reps: 10 }} />);
  expect((screen.getAllByRole('textbox')[0] as HTMLInputElement).value).toBe('75');
});
