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

export type ActivitySource = 'live' | 'retrospective' | 'capture';

export type ActivityStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface ActivityLog {
  id: string;
  title: string;
  planned_date: string | null;
  planned_start_time: string | null;
  planned_end_time: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  status: ActivityStatus;
  created_at: string;

  /** Provenance: which plan this activity was measured against. */
  schedule_id: string | null;
  recurring_id: string | null;
  occurrence_date: string | null;
  /** How the activity was recorded. Says nothing about data quality. */
  source: ActivitySource;
}

export interface LogProvenance {
  scheduleId?: string | null;
  recurringId?: string | null;
  occurrenceDate?: string | null;
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
