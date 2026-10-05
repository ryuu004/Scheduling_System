import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ActivityLog, RecurringSchedule, RecurringException, OccurrenceOverride } from '../types';
import { getRecurringSchedulesForDate } from '../lib/recurrence';
import { getLocalDateStr } from '../lib/date';
import type { AnalyticsLog } from '../lib/analytics';

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return getLocalDateStr(d);
}

export type RangeDays = 7 | 30 | 90;

/**
 * Loads activity logs across a window for the analytics view.
 *
 * Analytics reasons over many days at once, so this fetches by date range
 * rather than the single selected day the scheduler works with. Recurring
 * occurrences are matched back to logs by rule + occurrence date, which is the
 * only stable identity an occurrence has.
 */
export function useAnalytics(rangeDays: RangeDays) {
  const [logs, setLogs] = useState<AnalyticsLog[]>([]);
  const [recurring, setRecurring] = useState<RecurringSchedule[]>([]);
  const [exceptions, setExceptions] = useState<RecurringException[]>([]);
  const [overrides, setOverrides] = useState<OccurrenceOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = getLocalDateStr();
  const start = addDays(today, -(rangeDays - 1));

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [logsRes, recRes, excRes, ovrRes] = await Promise.all([
      supabase
        .from('activity_logs')
        .select('*')
        .gte('planned_date', start)
        .lte('planned_date', today),
      supabase.from('recurring_schedules').select('*'),
      supabase.from('recurring_exceptions').select('*'),
      supabase.from('occurrence_overrides').select('*'),
    ]);

    const firstError = logsRes.error || recRes.error || excRes.error || ovrRes.error;
    if (firstError) {
      console.error('Failed to load analytics:', firstError);
      setError('Could not load your activity history.');
    }

    setLogs((logsRes.data ?? []) as AnalyticsLog[]);
    setRecurring(recRes.data ?? []);
    setExceptions(excRes.data ?? []);
    setOverrides(ovrRes.data ?? []);
    setLoading(false);
  }, [start, today]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Recurring blocks that actually came up in the window. Each occurrence is
   * identified by `${recurring_id}@${date}`, matching how logs record
   * provenance, so an occurrence with no log can be reported as unused.
   */
  const recurringSlots = (() => {
    const applicable = new Set<string>();
    if (recurring.length === 0) return applicable;

    const cursor = new Date(`${start}T00:00:00`);
    const end = new Date(`${today}T00:00:00`);
    let guard = 0;

    while (cursor <= end && guard < 400) {
      guard++;
      const date = getLocalDateStr(cursor);
      for (const s of getRecurringSchedulesForDate(recurring, exceptions, overrides, date)) {
        // A recurring occurrence is identified by repeat_type; its id is the
        // rule's id, which is what logs reference as recurring_id.
        if (s.repeat_type && s.repeat_type !== 'none') {
          applicable.add(`${s.id}@${date}`);
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return applicable;
  })();

  const loggedOccurrences = new Set(
    (logs as ActivityLog[])
      .filter((l) => l.recurring_id && l.occurrence_date)
      .map((l) => `${l.recurring_id}@${l.occurrence_date}`)
  );

  return {
    logs,
    loading,
    error,
    windowStart: start,
    windowEnd: today,
    recurringSlots,
    loggedOccurrences,
    refresh: fetchData,
  };
}