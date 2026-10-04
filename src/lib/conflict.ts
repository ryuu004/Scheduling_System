import type { Schedule, ConflictResolution, ResolutionOption, RecurringSchedule } from '../types';
import { timeToMinutes, minutesToTime, DAY_END } from './activity';

export function detectConflicts(
  newSchedule: Schedule,
  existingSchedules: Schedule[],
  date: string
): Schedule[] {
  const newStart = timeToMinutes(newSchedule.start_time);
  const newEnd = timeToMinutes(newSchedule.end_time);

  return existingSchedules.filter((existing) => {
    if (existing.id === newSchedule.id) return false;
    if (existing.date !== date) return false;
    const existingStart = timeToMinutes(existing.start_time);
    const existingEnd = timeToMinutes(existing.end_time);
    return newStart < existingEnd && newEnd > existingStart;
  });
}

export type OverlapKind =
  | 'covers_existing'
  | 'existing_head'
  | 'existing_tail'
  | 'inside_existing';

export function classifyOverlap(e: { start: number; end: number }, n: { start: number; end: number }): OverlapKind {
  const coversStart = n.start <= e.start;
  const coversEnd = n.end >= e.end;
  if (coversStart && coversEnd) return 'covers_existing';
  if (coversStart) return 'existing_head';
  if (coversEnd) return 'existing_tail';
  return 'inside_existing';
}

export function proposeResolution(
  newSchedule: Schedule,
  conflictingSchedule: Schedule,
  recurringSchedules: RecurringSchedule[]
): ConflictResolution {
  const e = {
    start: timeToMinutes(conflictingSchedule.start_time),
    end: timeToMinutes(conflictingSchedule.end_time),
  };
  const n = {
    start: timeToMinutes(newSchedule.start_time),
    end: timeToMinutes(newSchedule.end_time),
  };

  const kind = classifyOverlap(e, n);
  const duration = n.end - n.start;
  const isRecurring = recurringSchedules.some((r) => r.id === conflictingSchedule.id);

  const existingTitle = conflictingSchedule.title;
  const newTitle = newSchedule.title;
  const options: ResolutionOption[] = [];

  const crop = (start: number, end: number, note: string): ResolutionOption => ({
    kind: 'crop_existing',
    start: minutesToTime(start),
    end: minutesToTime(end),
    label: `Crop "${existingTitle}" to ${minutesToTime(start)} – ${minutesToTime(end)}`,
    detail: note,
  });
  const moveNew = (start: number, end: number): ResolutionOption => ({
    kind: 'move_new',
    start: minutesToTime(start),
    end: minutesToTime(end),
    label: `Move "${newTitle}" to ${minutesToTime(start)} – ${minutesToTime(end)}`,
    detail: `Leaves "${existingTitle}" untouched at ${conflictingSchedule.start_time} – ${conflictingSchedule.end_time}`,
  });

  if (kind === 'covers_existing') {
    // The new schedule consumes the existing one entirely; there is nothing left to crop.
    if (e.end + duration <= DAY_END) options.push(moveNew(e.end, e.end + duration));
    if (e.start - duration >= 0) options.push(moveNew(e.start - duration, e.start));
  } else if (kind === 'existing_head') {
    // New schedule covers the start of the existing; the tail survives.
    if (n.end < e.end) {
      options.push(crop(n.end, e.end, `Keeps the part of "${existingTitle}" after "${newTitle}"`));
    }
    if (e.end + duration <= DAY_END) options.push(moveNew(e.end, e.end + duration));
    if (e.start - duration >= 0) options.push(moveNew(e.start - duration, e.start));
  } else if (kind === 'existing_tail') {
    // New schedule covers the end of the existing; the head survives.
    if (e.start < n.start) {
      options.push(crop(e.start, n.start, `Keeps the part of "${existingTitle}" before "${newTitle}"`));
    }
    if (e.end + duration <= DAY_END) options.push(moveNew(e.end, e.end + duration));
    if (e.start - duration >= 0) options.push(moveNew(e.start - duration, e.start));
  } else {
    // The new schedule sits strictly inside the existing one, leaving a hole.
    const before = { start: e.start, end: n.start };
    const after = { start: n.end, end: e.end };
    const beforeValid = before.end > before.start;
    const afterValid = after.end > after.start;

    if (beforeValid && afterValid) {
      options.push({
        kind: 'split_existing',
        segments: [
          { start: minutesToTime(before.start), end: minutesToTime(before.end) },
          { start: minutesToTime(after.start), end: minutesToTime(after.end) },
        ],
        label: `Split "${existingTitle}" into two blocks`,
        detail: `Keeps ${minutesToTime(before.start)} – ${minutesToTime(before.end)} and ${minutesToTime(after.start)} – ${minutesToTime(after.end)}`,
      });
    }
    if (beforeValid) {
      options.push(
        crop(before.start, before.end, `Removes the time after "${newTitle}"`)
      );
    }
    if (afterValid) {
      options.push(
        crop(after.start, after.end, `Removes the time before "${newTitle}"`)
      );
    }
    if (e.end + duration <= DAY_END) options.push(moveNew(e.end, e.end + duration));
    if (e.start - duration >= 0) options.push(moveNew(e.start - duration, e.start));
  }

  options.push({
    kind: 'cancel',
    label: `Cancel — don't add "${newTitle}"`,
    detail: 'Leave everything exactly as it is',
  });

  return {
    existingTitle,
    newTitle,
    isRecurring,
    kind,
    existingRange: {
      start: minutesToTime(e.start),
      end: minutesToTime(e.end),
    },
    newRange: { start: newSchedule.start_time, end: newSchedule.end_time },
    options,
  };
}
