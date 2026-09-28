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

  const saveSchedule = async (formData: Omit<Schedule, 'id' | 'created_at'>, editingId?: string) => {
    if (editingId) {
      const { error } = await supabase
        .from('schedules')
        .update(formData)
        .eq('id', editingId);

      if (!error) {
        setSchedules((prev) =>
          prev.map((s) => (s.id === editingId ? { ...s, ...formData } : s))
        );
      }
    } else {
      const { data, error } = await supabase
        .from('schedules')
        .insert([formData])
        .select()
        .single();

      if (!error && data) {
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

    if (!error) {
      setSchedules((prev) => prev.filter((s) => s.id !== id));
    }
  };

  return { schedules, loading, saveSchedule, deleteSchedule };
}
