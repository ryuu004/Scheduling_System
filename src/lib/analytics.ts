import type { ActivityLog, RecurringSchedule } from '../types';

/** The subset of an activity log that analytics reasons about. */
export type AnalyticsLog = Pick<
  ActivityLog,
  | 'title'
  | 'planned_date'
  | 'planned_start_time'
  | 'planned_end_time'
  | 'actual_start_time'
  | 'actual_end_time'
  | 'status'
  | 'schedule_id'
  | 'recurring_id'
  | 'occurrence_date'
  | 'source'
>;

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function durationMinutes(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const a = timeToMinutes(start);
  const b = timeToMinutes(end);
  // A range that wraps past midnight counts forward rather than going negative.
  return b > a ? b - a : b + 24 * 60 - a;
}

export interface PlannedVsActual {
  plannedMinutes: number;
  actualMinutes: number;
  /** actual / planned, or null when there is nothing to compare. */
  ratio: number | null;
  /** Count of logs that carried a plan, i.e. are comparable at all. */
  comparableCount: number;
  unplannedCount: number;
}

/**
 * Only logs that carry a plan can be compared. Unplanned work is counted
 * separately rather than being folded into either side, so a capture entry can
 * never make adherence look better or worse than it was.
 */
export function plannedVsActual(logs: AnalyticsLog[]): PlannedVsActual {
  let plannedMinutes = 0;
  let actualMinutes = 0;
  let comparableCount = 0;
  let unplannedCount = 0;

  for (const log of logs) {
    if (log.status === 'skipped') continue;

    const planned = durationMinutes(log.planned_start_time, log.planned_end_time);
    const actual = durationMinutes(log.actual_start_time, log.actual_end_time);

    if (log.planned_start_time && log.planned_end_time) {
      plannedMinutes += planned;
      if (actual > 0) {
        actualMinutes += actual;
        comparableCount++;
      }
    } else if (actual > 0) {
      unplannedCount++;
    }
  }

  return {
    plannedMinutes,
    actualMinutes,
    ratio: plannedMinutes > 0 ? actualMinutes / plannedMinutes : null,
    comparableCount,
    unplannedCount,
  };
}

export interface TitleSlice {
  title: string;
  actualMinutes: number;
  share: number;
}

/** Where actual time went, split by activity title. */
export function timeDistribution(logs: AnalyticsLog[], limit = 6): TitleSlice[] {
  const totals = new Map<string, number>();

  for (const log of logs) {
    if (log.status === 'skipped') continue;
    const mins = durationMinutes(log.actual_start_time, log.actual_end_time);
    if (mins <= 0) continue;
    totals.set(log.title, (totals.get(log.title) ?? 0) + mins);
  }

  const grand = [...totals.values()].reduce((a, b) => a + b, 0);
  if (grand === 0) return [];

  return [...totals.entries()]
    .map(([title, actualMinutes]) => ({
      title,
      actualMinutes,
      share: actualMinutes / grand,
    }))
    .sort((a, b) => b.actualMinutes - a.actualMinutes)
    .slice(0, limit);
}

export interface DayBucket {
  date: string;
  plannedMinutes: number;
  actualMinutes: number;
  /** null when the day had a plan but nothing recorded against it. */
  adherence: number | null;
}

/**
 * Build a local calendar date string. Using toISOString() here would shift the
 * window by a day for anyone west of UTC, which is exactly the bug this file
 * already had to work around elsewhere.
 */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Per-day planned vs actual, over the window, in date order. */
export function adherenceByDay(
  logs: AnalyticsLog[],
  windowStart: string,
  windowEnd: string
): DayBucket[] {
  const days: DayBucket[] = [];
  // Parse as local midnight; a bare 'YYYY-MM-DD' parses as UTC and can land on
  // the previous day in negative-offset timezones.
  const cursor = new Date(`${windowStart}T00:00:00`);
  const end = new Date(`${windowEnd}T00:00:00`);

  while (cursor <= end) {
    days.push({ date: localDateStr(cursor), plannedMinutes: 0, actualMinutes: 0, adherence: null });
    cursor.setDate(cursor.getDate() + 1);
  }

  const byDate = new Map(days.map((d) => [d.date, d]));

  for (const log of logs) {
    // Attribute to the day the work actually happened.
    const anchor =
      log.occurrence_date ?? log.planned_date ?? log.actual_start_time;
    if (!anchor) continue;
    const bucket = byDate.get(anchor);
    if (!bucket) continue;

    const planned = durationMinutes(log.planned_start_time, log.planned_end_time);
    const actual = durationMinutes(log.actual_start_time, log.actual_end_time);

    if (planned > 0) bucket.plannedMinutes += planned;
    if (actual > 0) bucket.actualMinutes += actual;
  }

  for (const d of days) {
    d.adherence = d.plannedMinutes > 0 ? d.actualMinutes / d.plannedMinutes : null;
  }

  return days;
}

export interface StartOffset {
  log: AnalyticsLog;
  /** Positive = started late, negative = started early. */
  deltaMinutes: number;
}

/**
 * How far actual starts drifted from planned starts.
 *
 * A start that lands earlier than the plan may belong to the previous day (an
 * overnight block), which is normal rather than "very early", so those are
 * shifted forward by a day instead of being reported as extreme.
 */
export function startOffsets(logs: AnalyticsLog[]): StartOffset[] {
  const out: StartOffset[] = [];

  for (const log of logs) {
    if (log.status === 'skipped') continue;
    if (!log.planned_start_time || !log.actual_start_time) continue;

    let delta =
      timeToMinutes(log.actual_start_time) - timeToMinutes(log.planned_start_time);

    if (delta < -12 * 60) delta += 24 * 60;

    out.push({ log, deltaMinutes: delta });
  }

  return out;
}

export type InsightKind =
  | 'starts_late'
  | 'starts_early'
  | 'runs_long'
  | 'runs_short'
  | 'unplanned'
  | 'unused_recurring'
  | 'on_track';

export interface Insight {
  kind: InsightKind;
  title: string;
  detail: string;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function fmtMinutes(mins: number): string {
  const abs = Math.abs(Math.round(mins));
  if (abs < 60) return `${abs}m`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export interface InsightContext {
  logs: AnalyticsLog[];
  recurring?: RecurringSchedule[];
  /** occurrence_key -> true when some activity was logged for it. */
  loggedOccurrences?: Set<string>;
  /** recurrence_key -> true when that rule applied on some day. */
  applicableRecurring?: Set<string>;
}

const LATE_THRESHOLD = 10;
const EARLY_THRESHOLD = 10;
const DURATION_THRESHOLD = 15;
const MIN_SAMPLES = 3;

/**
 * Rule-based observations. Deliberately no inference: each insight reports a
 * count and an average the user can verify against the logs behind it.
 */
export function generateInsights(ctx: InsightContext): Insight[] {
  const { logs } = ctx;
  const insights: Insight[] = [];

  const offsets = startOffsets(logs);
  const deltas = offsets.map((o) => o.deltaMinutes);
  const avgDelta = mean(deltas);

  const overruns: number[] = [];
  for (const log of logs) {
    if (log.status === 'skipped') continue;
    // Only compare durations for activities that actually carry a plan.
    if (!log.planned_start_time || !log.planned_end_time) continue;
    const planned = durationMinutes(log.planned_start_time, log.planned_end_time);
    const actual = durationMinutes(log.actual_start_time, log.actual_end_time);
    if (planned > 0 && actual > 0) overruns.push(actual - planned);
  }
  const avgOverrun = mean(overruns);

  if (deltas.length >= MIN_SAMPLES && avgDelta != null && avgDelta >= LATE_THRESHOLD) {
    insights.push({
      kind: 'starts_late',
      title: `You start about ${fmtMinutes(avgDelta)} late`,
      detail: `Across ${deltas.length} activities that had a plan, you began later than scheduled on average.`,
    });
  } else if (deltas.length >= MIN_SAMPLES && avgDelta != null && avgDelta <= -EARLY_THRESHOLD) {
    insights.push({
      kind: 'starts_early',
      title: `You start about ${fmtMinutes(avgDelta)} early`,
      detail: `Across ${deltas.length} activities, you began earlier than scheduled on average.`,
    });
  }

  if (overruns.length >= MIN_SAMPLES && avgOverrun != null) {
    if (avgOverrun >= DURATION_THRESHOLD) {
      insights.push({
        kind: 'runs_long',
        title: `Activities run ${fmtMinutes(avgOverrun)} longer than planned`,
        detail: `Based on ${overruns.length} activities with both a plan and a recorded finish.`,
      });
    } else if (avgOverrun <= -DURATION_THRESHOLD) {
      insights.push({
        kind: 'runs_short',
        title: `Activities finish ${fmtMinutes(avgOverrun)} before planned`,
        detail: `Based on ${overruns.length} activities with both a plan and a recorded finish.`,
      });
    }
  }

  const summary = plannedVsActual(logs);
  if (summary.unplannedCount >= MIN_SAMPLES) {
    insights.push({
      kind: 'unplanned',
      title: `${summary.unplannedCount} activities had no plan`,
      detail:
        'Time spent outside a schedule. These are excluded from adherence so they do not distort it.',
    });
  }

  // Only meaningful once something has actually been recorded. With an empty
// history every recurring slot is trivially "unused", which would read as a
// judgement about the user rather than a fact about their data.
if (logs.length > 0 && ctx.loggedOccurrences && ctx.applicableRecurring) {
    let unused = 0;
    for (const key of ctx.applicableRecurring) {
      if (!ctx.loggedOccurrences.has(key)) unused++;
    }
    if (unused > 0) {
      insights.push({
        kind: 'unused_recurring',
        title: `${unused} recurring ${unused === 1 ? 'slot went' : 'slots went'} unlogged`,
        detail: 'Recurring blocks that came up in this window with no activity recorded against them.',
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      kind: 'on_track',
      title: 'No clear patterns yet',
      detail:
        insights.length === 0 && logs.length < MIN_SAMPLES
          ? 'Log a few more activities to unlock observations.'
          : 'Nothing stood out against your plans in this window.',
    });
  }

  return insights;
}