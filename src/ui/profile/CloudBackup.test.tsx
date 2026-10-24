// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CloudBackup } from './CloudBackup';

afterEach(cleanup);

const fake = (restore: () => Promise<{ ok: true; savedAt: number } | { error: string }>) => ({
  lastSaved: () => Date.UTC(2026, 9, 24, 15, 30),
  sync: vi.fn(async () => ({ ok: true as const, savedAt: 1 })),
  restore: vi.fn(restore),
});

test('восстановление по старому ID: подтверждение, восстановление, перезапуск', async () => {
  vi.stubGlobal('confirm', () => true);
  const cloud = fake(async () => ({ ok: true, savedAt: 1 }));
  const reload = vi.fn();
  render(<CloudBackup cloud={cloud} currentId="12bd2cb2-new" setDeviceId={() => {}} reload={reload} />);
  expect(screen.getByText(/Сохранено/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('ID устройства'), { target: { value: ' 5cc149e1-f881-46b1-98fb-c7b86b534b06 ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Восстановить из облака' }));
  await vi.waitFor(() => expect(reload).toHaveBeenCalled());
  expect(cloud.restore).toHaveBeenCalledWith('5cc149e1-f881-46b1-98fb-c7b86b534b06');
  vi.unstubAllGlobals();
});

test('копии нет — можно вернуть только старый ID (замеры Zepp снова видны)', async () => {
  vi.stubGlobal('confirm', () => true);
  const cloud = fake(async () => ({ error: 'Копии для этого ID нет' }));
  const setDeviceId = vi.fn();
  const reload = vi.fn();
  render(<CloudBackup cloud={cloud} currentId="12bd2cb2-new" setDeviceId={setDeviceId} reload={reload} />);
  fireEvent.change(screen.getByLabelText('ID устройства'), { target: { value: '5cc149e1-f881-46b1-98fb-c7b86b534b06' } });
  fireEvent.click(screen.getByRole('button', { name: 'Восстановить из облака' }));
  expect(await screen.findByText(/Копии для этого ID нет/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Вернуть только ID' }));
  expect(setDeviceId).toHaveBeenCalledWith('5cc149e1-f881-46b1-98fb-c7b86b534b06');
  expect(reload).toHaveBeenCalled();
  vi.unstubAllGlobals();
});
