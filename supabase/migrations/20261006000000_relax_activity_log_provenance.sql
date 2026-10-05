-- Relax the provenance constraint to also permit a one-time plan that has an
-- occurrence date but no recurring rule behind it.
--
-- Previously the only legal shapes were:
--   schedule_id set, or
--   recurring_id + occurrence_date set, or
--   all three null.
--
-- A one-time schedule logged against its own date sets occurrence_date (so
-- analytics can bucket by day) without any recurring rule, which the old check
-- rejected. occurrence_date is an attribute of the log, not part of the
-- recurring identity, so it no longer participates in the constraint.
alter table activity_logs
  drop constraint if exists activity_logs_provenance_check;

alter table activity_logs
  add constraint activity_logs_provenance_check
  check (
    -- A log is either linked to a recurring rule, linked to a one-time
    -- schedule, or linked to neither. Mixing them is not meaningful.
    (schedule_id is not null and recurring_id is null)
    or (schedule_id is null and recurring_id is not null)
    or (schedule_id is null and recurring_id is null)
  );