import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Schedule } from '../types';

export function useSchedules(selectedDate: string) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('date', selectedDate)
      .is('archived_at', null)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Failed to fetch schedules:', error);
    } else {
      setSchedules(data || []);
    }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  type ScheduleRow = Pick<Schedule, 'title' | 'date' | 'start_time' | 'end_time'>;

  const toRow = (data: ScheduleRow): ScheduleRow => ({
    title: data.title,
    date: data.date,
    start_time: data.start_time,
    end_time: data.end_time,
  });

  const saveSchedule = async (formData: Omit<Schedule, 'id' | 'created_at'>, editingId?: string) => {
    const row = toRow(formData);

    if (editingId) {
      const { error } = await supabase
        .from('schedules')
        .update(row)
        .eq('id', editingId);

      if (error) {
        console.error('Failed to update schedule:', error);
        return;
      }
      setSchedules((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, ...row } : s))
      );
    } else {
      const { data, error } = await supabase
        .from('schedules')
        .insert([row])
        .select()
        .single();

      if (error) {
        console.error('Failed to save schedule:', error);
        return;
      }
      if (data) {
        setSchedules((prev) => [...prev, data].sort((a, b) =>
          a.start_time.localeCompare(b.start_time)
        ));
      }
    }
  };

  const deleteSchedule = async (id: string) => {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete schedule:', error);
      return;
    }
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  /**
   * Archive rather than delete.
   *
   * Converting a one-time schedule into a recurring one must not destroy the
   * row: activity_logs.schedule_id points at it, and a hard delete would sever
   * the provenance of historical logs. Archiving hides it from the timeline
   * while keeping those links (and the plan snapshot on each log) intact.
   */
  const archiveSchedule = async (id: string) => {
    const { error } = await supabase
      .from('schedules')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Failed to archive schedule:', error);
      return;
    }
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  return { schedules, loading, saveSchedule, deleteSchedule, archiveSchedule };
}
