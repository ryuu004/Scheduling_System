import type { RecurringSchedule, RecurringException, Schedule } from '../types';

export function getRecurringSchedulesForDate(
  recurring: RecurringSchedule[],
  exceptions: RecurringException[],
  dateStr: string
): Schedule[] {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();

  return recurring
    .filter((r) => {
      if (r.repeat_type === 'none') return false;

      const isException = exceptions.some(
        (e) => e.recurring_id === r.id && e.exception_date === dateStr
      );
      if (isException) return false;

      switch (r.repeat_type) {
        case 'daily':
          return true;
        case 'weekdays':
          return dayOfWeek >= 1 && dayOfWeek <= 5;
        case 'weekly':
          return r.repeat_days.includes(dayOfWeek);
        case 'custom':
          return r.repeat_days.includes(dayOfWeek);
        default:
          return false;
      }
    })
    .map((r) => ({
      id: r.id,
      title: r.title,
      date: dateStr,
      start_time: r.start_time,
      end_time: r.end_time,
      created_at: r.created_at,
      repeat_type: r.repeat_type,
      repeat_days: r.repeat_days,
    }));
}
