-- Activity log provenance: link each log to the plan it came from, without
-- making planned-vs-actual analytics depend on title/time guesswork.

-- 1. Soft-archive one-time schedules.
--    Converting a one-time schedule into a recurring one used to DELETE the
--    schedules row, which would drop activity logs that reference it. Archiving
--    keeps the row (and therefore the provenance) intact.
alter table schedules
  add column if not exists archived_at timestamptz;

create index if not exists schedules_active_idx
  on schedules (date, start_time)
  where archived_at is null;

-- 2. Explicit provenance on activity logs.
--    schedule_id           -> one-time plan
--    recurring_id + occurrence_date -> a single occurrence of a recurring rule
--    all three null        -> unplanned activity, no plan to compare against
alter table activity_logs
  add column if not exists schedule_id uuid references schedules(id) on delete set null,
  add column if not exists recurring_id uuid references recurring_schedules(id) on delete set null,
  add column if not exists occurrence_date date,
  add column if not exists source text not null default 'live';

-- source records HOW the activity was recorded, never whether its data is
-- usable for analytics: a retrospective log can be perfectly accurate.
alter table activity_logs
  drop constraint if exists activity_logs_source_check;
alter table activity_logs
  add constraint activity_logs_source_check
  check (source in ('live', 'retrospective', 'capture'));

-- 3. An unplanned activity legitimately has no plan. Fabricating one (the old
--    behaviour set planned = actual) reported zero deviation and skewed averages.
alter table activity_logs
  alter column planned_date drop not null,
  alter column planned_start_time drop not null,
  alter column planned_end_time drop not null;

-- 4. Provenance must be fully specified or entirely absent; no half-linked rows.
alter table activity_logs
  drop constraint if exists activity_logs_provenance_check;
alter table activity_logs
  add constraint activity_logs_provenance_check
  check (
    schedule_id is not null
    or (recurring_id is not null and occurrence_date is not null)
    or (recurring_id is null and occurrence_date is null)
  );

create index if not exists activity_logs_schedule_idx on activity_logs (schedule_id);
create index if not exists activity_logs_recurring_idx on activity_logs (recurring_id, occurrence_date);

-- 5. Backfill: pre-existing rows have unknowable provenance. Their planned_*
--    were fabricated as copies of actual, so mark them retrospective AND clear
--    the fake baseline rather than letting it skew deviation stats.
update activity_logs
set source = 'retrospective',
    planned_date = null,
    planned_start_time = null,
    planned_end_time = null
where planned_start_time is not null
  and planned_start_time = actual_start_time;