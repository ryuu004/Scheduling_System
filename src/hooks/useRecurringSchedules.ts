import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { RecurringSchedule, RecurringException } from '../types';

export function useRecurringSchedules() {
  const [recurring, setRecurring] = useState<RecurringSchedule[]>([]);
  const [exceptions, setExceptions] = useState<RecurringException[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecurring = useCallback(async () => {
    setLoading(true);
    const [{ data: recData, error: recError }, { data: excData, error: excError }] = await Promise.all([
      supabase.from('recurring_schedules').select('*').order('start_time', { ascending: true }),
      supabase.from('recurring_exceptions').select('*'),
    ]);

    if (recError) console.error('Failed to fetch recurring schedules:', recError);
    else setRecurring(recData || []);

    if (excError) console.error('Failed to fetch exceptions:', excError);
    else setExceptions(excData || []);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecurring();
  }, [fetchRecurring]);

  const saveRecurring = async (data: Omit<RecurringSchedule, 'id' | 'created_at'>, editingId?: string) => {
    if (editingId) {
      const { error } = await supabase
        .from('recurring_schedules')
        .update({ title: data.title, start_time: data.start_time, end_time: data.end_time, repeat_type: data.repeat_type, repeat_days: data.repeat_days, start_date: data.start_date })
        .eq('id', editingId);

      if (!error) {
        setRecurring((prev) => prev.map((r) => (r.id === editingId ? { ...r, ...data } : r)));
      }
    } else {
      const { data: created, error } = await supabase
        .from('recurring_schedules')
        .insert([data])
        .select()
        .single();

      if (!error && created) {
        setRecurring((prev) => [...prev, created]);
      }
    }
  };

  const deleteRecurring = async (id: string) => {
    const { error } = await supabase.from('recurring_schedules').delete().eq('id', id);
    if (!error) {
      setRecurring((prev) => prev.filter((r) => r.id !== id));
      setExceptions((prev) => prev.filter((e) => e.recurring_id !== id));
    }
  };

  const addException = async (recurringId: string, date: string) => {
    const { data, error } = await supabase
      .from('recurring_exceptions')
      .insert([{ recurring_id: recurringId, exception_date: date }])
      .select()
      .single();

    if (!error && data) {
      setExceptions((prev) => [...prev, data]);
    }
  };

  const removeException = async (exceptionId: string) => {
    const { error } = await supabase.from('recurring_exceptions').delete().eq('id', exceptionId);
    if (!error) {
      setExceptions((prev) => prev.filter((e) => e.id !== exceptionId));
    }
  };

  return { recurring, exceptions, loading, saveRecurring, deleteRecurring, addException, removeException };
}
