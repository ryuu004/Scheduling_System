import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { ActivityLog, LogProvenance } from '../types';

export function useActivityLogs(selectedDate: string) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

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
      setLogs(data || []);
      const inProgress = (data || []).find((l) => l.status === 'in_progress');
      if (inProgress) {
        setActiveLogId(inProgress.id);
        const start = new Date(inProgress.created_at).getTime();
        startTimeRef.current = start;
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }
    }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (activeLogId) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeLogId]);

  /**
   * Create an in-progress log for a schedule the user is recording directly.
   * `actualStart` is supplied when the user began before the planned time.
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
      return;
    }
    if (data) {
      setLogs((prev) => [...prev, data]);
      setActiveLogId(data.id);
      startTimeRef.current = Date.now();
      setElapsed(0);
    }
  };

  const pauseLog = async () => {
    if (!activeLogId) return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setActiveLogId(null);
  };

  const resumeLog = async () => {
    if (!activeLogId) return;
    setActiveLogId(activeLogId);
    startTimeRef.current = Date.now() - elapsed * 1000;
  };

  /**
   * Close out the in-progress log.
   *
   * A started-early activity can have an actual start later than the wall clock
   * used for "now" (e.g. logging at 02:00 that you began at 23:30 yesterday).
   * Rather than write an inverted range, the log is closed at the end of its
   * planned block, which is the only end time known to be consistent with it.
   */
  const finishLog = async () => {
    if (!activeLogId) return;
    const log = logs.find((l) => l.id === activeLogId);
    if (!log) return;

    const nowTime = new Date().toTimeString().slice(0, 8);
    let endTime = nowTime;
    let endDate = null as string | null;

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

    const { error } = await supabase
      .from('activity_logs')
      .update(patch)
      .eq('id', activeLogId);

    if (error) {
      console.error('Failed to finish activity log:', error);
    } else {
      setLogs((prev) =>
        prev.map((l) => (l.id === activeLogId ? { ...l, ...patch } : l))
      );
    }
    setActiveLogId(null);
    setElapsed(0);
  };

  const skipLog = async (logId: string) => {
    const { error } = await supabase
      .from('activity_logs')
      .update({ status: 'skipped' })
      .eq('id', logId);

    if (!error) {
      setLogs((prev) => prev.map((l) => (l.id === logId ? { ...l, status: 'skipped' } : l)));
    }
  };

  const updateActualTimes = async (logId: string, actualStart: string, actualEnd: string) => {
    const { error } = await supabase
      .from('activity_logs')
      .update({ actual_start_time: actualStart, actual_end_time: actualEnd, status: 'completed' })
      .eq('id', logId);

    if (!error) {
      setLogs((prev) =>
        prev.map((l) => (l.id === logId ? { ...l, actual_start_time: actualStart, actual_end_time: actualEnd, status: 'completed' } : l))
      );
    }
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

  const addCaptureLog = async (
    title: string,
    actualStart: string,
    actualEnd: string
  ) => {
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
    activeLogId,
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
