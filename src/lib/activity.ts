import type { Schedule, LogProvenance } from '../types';

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const DAY_END = 24 * 60;

/**
 * Derive explicit provenance from a schedule.
 *
 * A one-time schedule is identified by schedule_id. A recurring occurrence is
 * identified by recurring_id + occurrence_date, because no row exists for the
 * occurrence itself. Unplanned work yields {}.
 */
export function provenanceFor(schedule: Schedule, date: string): LogProvenance {
  if (schedule.repeat_type && schedule.repeat_type !== 'none') {
    return { recurringId: schedule.id, occurrenceDate: date, scheduleId: null };
  }
  return { scheduleId: schedule.id, recurringId: null, occurrenceDate: null };
}

/**
 * Accepts both `HH:MM` (what <input type="time"> yields) and `HH:MM:SS`
 * (what Postgres `time` columns return).
 */
export function isValidTimeStr(value: string): boolean {
  if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(value)) return false;
  const [h, m] = value.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export interface ActualRangeCheck {
  ok: boolean;
  message?: string;
}

/**
 * Validate an actual start on its own, for when the end is not yet known
 * (starting an activity now). The start must be a valid time and must not fall
 * after the planned end, otherwise it could not belong to the block.
 */
export function validateActualStart(
  actualStart: string,
  plannedEnd?: string | null
): ActualRangeCheck {
  if (!isValidTimeStr(actualStart)) {
    return { ok: false, message: 'Start time is not valid.' };
  }
  if (plannedEnd && isValidTimeStr(plannedEnd)) {
    if (timeToMinutes(actualStart) > timeToMinutes(plannedEnd)) {
      return {
        ok: false,
        message: `Start (${actualStart}) is after the planned end (${plannedEnd.slice(0, 5)}).`,
      };
    }
  }
  return { ok: true };
}

/**
 * Guard an actual time range so a logged activity can never describe an
 * impossible interval, and never start after the plan it was measured against
 * in a way that silently inverts the comparison.
 */
export function validateActualRange(
  actualStart: string,
  actualEnd: string,
  plannedEnd?: string | null
): ActualRangeCheck {
  if (!isValidTimeStr(actualStart)) {
    return { ok: false, message: 'Start time is not valid.' };
  }
  if (!isValidTimeStr(actualEnd)) {
    return { ok: false, message: 'End time is not valid.' };
  }
  if (timeToMinutes(actualStart) >= timeToMinutes(actualEnd)) {
    return { ok: false, message: 'Start must be earlier than end.' };
  }
  if (plannedEnd && isValidTimeStr(plannedEnd)) {
    if (timeToMinutes(actualStart) > timeToMinutes(plannedEnd)) {
      return {
        ok: false,
        message: `Start (${actualStart}) is after the planned end (${plannedEnd.slice(0, 5)}).`,
      };
    }
  }
  return { ok: true };
}