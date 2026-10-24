import { expect, test } from 'vitest';
import { lastNight, sleepNights, type SleepSegment } from './sleep';

const t = (s: string) => Date.parse(s);
const seg = (start: string, end: string, stage: SleepSegment['stage']): SleepSegment => ({ start: t(start), end: t(end), stage });

test('ночь по стадиям: сон — без пробуждений, перекрытия не считаются дважды, дата — день пробуждения', () => {
  const nights = sleepNights([
    seg('2024-11-24T23:30:00', '2024-11-25T07:00:00', 'inBed'),
    seg('2024-11-24T23:50:00', '2024-11-25T02:00:00', 'core'),
    seg('2024-11-25T01:00:00', '2024-11-25T02:30:00', 'deep'), // перекрывает core на час
    seg('2024-11-25T02:30:00', '2024-11-25T03:00:00', 'awake'),
    seg('2024-11-25T03:00:00', '2024-11-25T06:40:00', 'rem'),
  ]);
  expect(nights).toHaveLength(1);
  expect(nights[0]).toMatchObject({ date: '2024-11-25', asleepMin: 160 + 220, deepMin: 90, inBedMin: 450 });
});

test('только «в кровати» (iPhone без часов): сон = время в кровати; разрывы до 3 ч — та же ночь', () => {
  const nights = sleepNights([
    seg('2024-11-25T00:00:00', '2024-11-25T00:40:00', 'inBed'),
    seg('2024-11-25T01:10:00', '2024-11-25T05:00:00', 'inBed'),
    seg('2024-11-26T00:30:00', '2024-11-26T05:30:00', 'inBed'),
  ]);
  expect(nights.map((n) => [n.date, n.asleepMin, n.deepMin])).toEqual([
    ['2024-11-25', 270, 0],
    ['2024-11-26', 300, 0],
  ]);
});

test('дневной сон в тот же день не перебивает ночь', () => {
  const nights = sleepNights([
    seg('2024-11-25T00:00:00', '2024-11-25T07:00:00', 'asleep'),
    seg('2024-11-25T15:00:00', '2024-11-25T15:30:00', 'asleep'),
  ]);
  expect(nights).toHaveLength(1);
  expect(nights[0].asleepMin).toBe(420);
});

test('последняя ночь для карточки: оценка по длительности, старая ночь — с датой', () => {
  const n = (date: string, asleepMin: number) => ({ date, start: 0, end: 0, asleepMin, deepMin: 0, inBedMin: asleepMin });
  const now = Date.parse('2024-11-26T12:00:00');
  expect(lastNight([n('2024-11-25', 300), n('2024-11-26', 468)], now)).toEqual({ min: 468, status: 'Хорошо', frac: 468 / 480 });
  expect(lastNight([n('2024-11-26', 380)], now)?.status).toBe('Норма');
  expect(lastNight([n('2024-11-26', 300)], now)?.status).toBe('Мало');
  expect(lastNight([n('2024-11-20', 420)], now)?.status).toBe('20 нояб');
  expect(lastNight([], now)).toBeNull();
});
