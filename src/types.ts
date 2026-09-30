export interface Schedule {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  created_at: string;
  repeat_type?: RepeatType;
  repeat_days?: number[];
}

export type RepeatType = 'none' | 'daily' | 'weekdays' | 'weekly' | 'custom';

export interface RecurringSchedule {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  repeat_type: RepeatType;
  repeat_days: number[];
  start_date: string;
  created_at: string;
}

export interface RecurringException {
  id: string;
  recurring_id: string;
  exception_date: string;
  created_at: string;
}
