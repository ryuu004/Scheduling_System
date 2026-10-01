import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { OccurrenceOverride } from '../types';

export function useOccurrenceOverrides() {
  const [overrides, setOverrides] = useState<OccurrenceOverride[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOverrides = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('occurrence_overrides').select('*');
    if (error) {
      console.error('Failed to fetch overrides:', error);
    } else {
      setOverrides(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  const addOverride = async (recurringId: string, date: string, startTime: string, endTime: string) => {
    const { data, error } = await supabase
      .from('occurrence_overrides')
      .insert([{ recurring_id: recurringId, override_date: date, start_time: startTime, end_time: endTime }])
      .select()
      .single();

    if (!error && data) {
      setOverrides((prev) => [...prev, data]);
    } else if (error) {
      console.error('Failed to add override:', error);
    }
    return data;
  };

  const replaceOverrides = async (
    recurringId: string,
    date: string,
    segments: { start: string; end: string }[]
  ) => {
    const { error: delError } = await supabase
      .from('occurrence_overrides')
      .delete()
      .eq('recurring_id', recurringId)
      .eq('override_date', date);

    if (delError) {
      console.error('Failed to clear overrides:', delError);
      return;
    }

    setOverrides((prev) => prev.filter((o) => !(o.recurring_id === recurringId && o.override_date === date)));

    if (segments.length === 0) return;

    const rows = segments.map((s) => ({
      recurring_id: recurringId,
      override_date: date,
      start_time: s.start,
      end_time: s.end,
    }));

    const { data, error } = await supabase.from('occurrence_overrides').insert(rows).select();

    if (error) {
      console.error('Failed to save overrides:', error);
    } else if (data) {
      setOverrides((prev) => [...prev, ...data]);
    }
  };

  const removeOverride = async (overrideId: string) => {
    const { error } = await supabase.from('occurrence_overrides').delete().eq('id', overrideId);
    if (!error) {
      setOverrides((prev) => prev.filter((o) => o.id !== overrideId));
    }
  };

  return { overrides, loading, addOverride, replaceOverrides, removeOverride };
}
