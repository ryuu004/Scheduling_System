export interface Schedule {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  created_at: string;
  repeat_type?: RepeatType;
  repeat_days?: number[];
  segmentId?: string;
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

export interface ActivityLog {
  id: string;
  title: string;
  planned_date: string;
  planned_start_time: string;
  planned_end_time: string;
  actual_start_time: string | null;
  actual_end_time: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  created_at: string;
}

export interface OccurrenceOverride {
  id: string;
  recurring_id: string;
  override_date: string;
  start_time: string;
  end_time: string;
  created_at: string;
}

export interface TimeSegment {
  start: string;
  end: string;
}

export type ResolutionOption =
  | { kind: 'crop_existing'; start: string; end: string; label: string; detail: string }
  | { kind: 'split_existing'; segments: TimeSegment[]; label: string; detail: string }
  | { kind: 'move_new'; start: string; end: string; label: string; detail: string }
  | { kind: 'cancel'; label: string; detail: string };

export interface ConflictResolution {
  existingTitle: string;
  newTitle: string;
  isRecurring: boolean;
  kind: 'covers_existing' | 'existing_head' | 'existing_tail' | 'inside_existing';
  existingRange: TimeSegment;
  newRange: TimeSegment;
  options: ResolutionOption[];
}
