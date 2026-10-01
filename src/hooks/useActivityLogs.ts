import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { ActivityLog } from '../types';

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

  const startLog = async (title: string, plannedStartTime: string, plannedEndTime: string) => {
    const { data, error } = await supabase
      .from('activity_logs')
      .insert([{
        title,
        planned_date: selectedDate,
        planned_start_time: plannedStartTime,
        planned_end_time: plannedEndTime,
        actual_start_time: new Date().toTimeString().slice(0, 8),
        status: 'in_progress',
      }])
      .select()
      .single();

    if (!error && data) {
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

  const finishLog = async () => {
    if (!activeLogId) return;
    const endTime = new Date().toTimeString().slice(0, 8);
    const { error } = await supabase
      .from('activity_logs')
      .update({ actual_end_time: endTime, status: 'completed' })
      .eq('id', activeLogId);

    if (!error) {
      setLogs((prev) =>
        prev.map((l) => (l.id === activeLogId ? { ...l, actual_end_time: endTime, status: 'completed' } : l))
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

  const addRetrospectiveLog = async (title: string, date: string, actualStart: string, actualEnd: string) => {
    const { data, error } = await supabase
      .from('activity_logs')
      .insert([{
        title,
        planned_date: date,
        planned_start_time: actualStart,
        planned_end_time: actualEnd,
        actual_start_time: actualStart,
        actual_end_time: actualEnd,
        status: 'completed',
      }])
      .select()
      .single();

    if (!error && data) {
      setLogs((prev) => [...prev, data].sort((a, b) => a.planned_start_time.localeCompare(b.planned_start_time)));
    }
  };

  return {
    logs,
    loading,
    activeLogId,
    elapsed,
    startLog,
    pauseLog,
    resumeLog,
    finishLog,
    skipLog,
    updateActualTimes,
    addRetrospectiveLog,
  };
}
