import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { ActivityLog, LogProvenance } from '../types';

/**
 * Multiple activities may be in progress at once.
 *
 * Real behaviour overlaps: you can be programming while a lecture plays, or
 * walk while on a call. Nothing here serialises activities or refuses an
 * overlapping one -- schedule conflicts are a planning concern, handled
 * separately by the conflict resolver, not a constraint on what actually
 * happened.
 */
export function useActivityLogs(selectedDate: string) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  /** Logs currently running (not paused). May contain several entries. */
  const [runningIds, setRunningIds] = useState<string[]>([]);

  /** Elapsed seconds per log id, frozen while a log is paused. */
  const [elapsed, setElapsed] = useState<Record<string, number>>({});

  /** Wall-clock start per running log, used to compute elapsed on each tick. */
  const startTimesRef = useRef<Map<string, number>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runningLogs = logs.filter((l) => runningIds.includes(l.id));

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('planned_date', selectedDate)
      .order('planned_start_time', { ascending: true });

    if (error) {
      console.error('Failed to fetch activity logs:', error);
    } else {
      const rows = data || [];

      // Restore every log that was left running, not just the first one.
      const stillRunning = rows.filter((l) => l.status === 'in_progress');
      setRunningIds(stillRunning.map((l) => l.id));

      const restored: Record<string, number> = {};
      const starts = new Map<string, number>();
      for (const log of stillRunning) {
        const start = new Date(log.created_at).getTime();
        starts.set(log.id, start);
        restored[log.id] = Math.floor((Date.now() - start) / 1000);
      }
      startTimesRef.current = starts;
      setElapsed(restored);
      setLogs(rows);
    }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // One shared tick drives every running log.
  useEffect(() => {
    if (runningIds.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      setElapsed((prev) => {
        const next = { ...prev };
        for (const id of runningIds) {
          const startedAt = startTimesRef.current.get(id);
          if (startedAt != null) {
            next[id] = Math.floor((now - startedAt) / 1000);
          }
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [runningIds]);

  /**
   * Begin an activity from a schedule. Starting one never interrupts another;
   * overlapping activities are expected.
   */
  const startFromSchedule = async (args: {
    title: string;
    date: string;
    plannedStart: string;
    plannedEnd: string;
    actualStart?: string;
    provenance: LogProvenance;
  }) => {
    const nowTime = new Date().toTimeString().slice(0, 8);
    const { data, error } = await supabase
      .from('activity_logs')
      .insert([{
        title: args.title,
        planned_date: args.date,
        planned_start_time: args.plannedStart,
        planned_end_time: args.plannedEnd,
        actual_start_time: args.actualStart ?? nowTime,
        actual_end_time: null,
        status: 'in_progress',
        source: 'live',
        schedule_id: args.provenance.scheduleId ?? null,
        recurring_id: args.provenance.recurringId ?? null,
        occurrence_date: args.provenance.occurrenceDate ?? null,
      }])
      .select()
      .single();

    if (error) {
      console.error('Failed to start activity from schedule:', error);
      return null;
    }
    if (data) {
      setLogs((prev) => [...prev, data]);
      startTimesRef.current.set(data.id, Date.now());
      setElapsed((prev) => ({ ...prev, [data.id]: 0 }));
      setRunningIds((prev) => (prev.includes(data.id) ? prev : [...prev, data.id]));
    }
    return data;
  };

  /** Stop counting time for one log without closing it. */
  const pauseLog = (logId: string) => {
    setElapsed((prev) => {
      const startedAt = startTimesRef.current.get(logId);
      if (startedAt != null) {
        return { ...prev, [logId]: Math.floor((Date.now() - startedAt) / 1000) };
      }
      return prev;
    });
    startTimesRef.current.delete(logId);
    setRunningIds((prev) => prev.filter((id) => id !== logId));
  };

  /** Resume counting from the frozen elapsed value. */
  const resumeLog = (logId: string) => {
    const frozen = elapsed[logId] ?? 0;
    startTimesRef.current.set(logId, Date.now() - frozen * 1000);
    setRunningIds((prev) => (prev.includes(logId) ? prev : [...prev, logId]));
  };

  const stopTicking = (logId: string) => {
    startTimesRef.current.delete(logId);
    setRunningIds((prev) => prev.filter((id) => id !== logId));
    setElapsed((prev) => {
      const next = { ...prev };
      delete next[logId];
      return next;
    });
  };

  /**
   * Close out one log.
   *
   * A started-early activity can have an actual start later than the wall clock
   * used for "now" (e.g. logging at 02:00 that you began at 23:30 yesterday).
   * Rather than write an inverted range, the log is closed at the end of its
   * planned block, which is the only end time known to be consistent with it.
   */
  const finishLog = async (logId: string) => {
    const log = logs.find((l) => l.id === logId);
    if (!log) return;

    const nowTime = new Date().toTimeString().slice(0, 8);
    let endTime = nowTime;
    let endDate: string | null = null;

    if (log.actual_start_time && log.actual_start_time > nowTime) {
      endTime = log.planned_end_time ?? nowTime;
      endDate = log.planned_date;
    }

    const patch: Record<string, unknown> = {
      actual_end_time: endTime,
      status: 'completed',
    };
    if (endDate && endDate !== log.planned_date) {
      patch.planned_date = endDate;
    }

    const { error } = await supabase.from('activity_logs').update(patch).eq('id', logId);

    if (error) {
      console.error('Failed to finish activity log:', error);
    } else {
      setLogs((prev) => prev.map((l) => (l.id === logId ? { ...l, ...patch } : l)));
    }
    stopTicking(logId);
  };

  const skipLog = async (logId: string) => {
    const { error } = await supabase
      .from('activity_logs')
      .update({ status: 'skipped' })
      .eq('id', logId);

    if (!error) {
      setLogs((prev) => prev.map((l) => (l.id === logId ? { ...l, status: 'skipped' } : l)));
    }
    stopTicking(logId);
  };

  const updateActualTimes = async (logId: string, actualStart: string, actualEnd: string) => {
    const { error } = await supabase
      .from('activity_logs')
      .update({
        actual_start_time: actualStart,
        actual_end_time: actualEnd,
        status: 'completed',
      })
      .eq('id', logId);

    if (!error) {
      setLogs((prev) =>
        prev.map((l) =>
          l.id === logId
            ? {
                ...l,
                actual_start_time: actualStart,
                actual_end_time: actualEnd,
                status: 'completed',
              }
            : l
        )
      );
    }
    stopTicking(logId);
  };

  const addRetrospectiveLog = async (
    title: string,
    date: string,
    actualStart: string,
    actualEnd: string,
    plan?: {
      plannedStartTime: string;
      plannedEndTime: string;
    } & LogProvenance
  ) => {
    // A retrospective entry is still valid analytics. It carries a real
    // planned baseline only when a plan was matched; otherwise the plan stays
    // null rather than being fabricated from the actual times.
    const { data, error } = await supabase
      .from('activity_logs')
      .insert([{
        title,
        planned_date: plan ? date : null,
        planned_start_time: plan ? plan.plannedStartTime : null,
        planned_end_time: plan ? plan.plannedEndTime : null,
        actual_start_time: actualStart,
        actual_end_time: actualEnd,
        status: 'completed',
        source: 'retrospective',
        schedule_id: plan?.scheduleId ?? null,
        recurring_id: plan?.recurringId ?? null,
        occurrence_date: plan?.occurrenceDate ?? null,
      }])
      .select()
      .single();

    if (!error && data) {
      setLogs((prev) =>
        [...prev, data].sort((a, b) =>
          (a.actual_start_time ?? '').localeCompare(b.actual_start_time ?? '')
        )
      );
    } else if (error) {
      console.error('Failed to add retrospective log:', error);
    }
  };

  const addCaptureLog = async (title: string, actualStart: string, actualEnd: string) => {
    const { data, error } = await supabase
      .from('activity_logs')
      .insert([{
        title,
        planned_date: null,
        planned_start_time: null,
        planned_end_time: null,
        actual_start_time: actualStart,
        actual_end_time: actualEnd,
        status: 'completed',
        source: 'capture',
        schedule_id: null,
        recurring_id: null,
        occurrence_date: null,
      }])
      .select()
      .single();

    if (!error && data) {
      setLogs((prev) =>
        [...prev, data].sort((a, b) =>
          (a.actual_start_time ?? '').localeCompare(b.actual_start_time ?? '')
        )
      );
    } else if (error) {
      console.error('Failed to capture activity:', error);
    }
  };

  return {
    logs,
    loading,
    runningLogs,
    runningIds,
    elapsed,
    startFromSchedule,
    pauseLog,
    resumeLog,
    finishLog,
    skipLog,
    updateActualTimes,
    addRetrospectiveLog,
    addCaptureLog,
  };
}