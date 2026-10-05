import { useState } from 'react';
import type { Schedule, RepeatType, ConflictResolution, ResolutionOption } from './types';
import { useClock } from './hooks/useClock';
import { useSchedules } from './hooks/useSchedules';
import { useRecurringSchedules } from './hooks/useRecurringSchedules';
import { useActivityLogs } from './hooks/useActivityLogs';
import { useOccurrenceOverrides } from './hooks/useOccurrenceOverrides';
import { getRecurringSchedulesForDate } from './lib/recurrence';
import { detectConflicts, proposeResolution } from './lib/conflict';
import { CurrentActivity } from './components/CurrentActivity';
import { Timeline } from './components/Timeline';
import { ScheduleForm, type ScheduleFormData } from './components/ScheduleForm';
import { ScheduleActionSheet } from './components/ScheduleActionSheet';
import { ActivityCapture } from './components/ActivityCapture';
import { ActivityTracker } from './components/ActivityTracker';
import { ConflictDialog } from './components/ConflictDialog';
import { DatePicker } from './components/DatePicker';
import { getLocalDateStr } from './lib/date';
import { provenanceFor, timeToMinutes } from './lib/activity';

export function SchedulerPage() {
  const currentTime = useClock();
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateStr());
  const [showForm, setShowForm] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [actionSchedule, setActionSchedule] = useState<Schedule | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const { schedules, loading, saveSchedule, deleteSchedule, archiveSchedule } = useSchedules(selectedDate);
  const { recurring, exceptions, saveRecurring, deleteRecurring, addException } = useRecurringSchedules();
  const { logs, runningIds, elapsed, startFromSchedule, pauseLog, resumeLog, finishLog, skipLog, updateActualTimes, addRetrospectiveLog, addCaptureLog } = useActivityLogs(selectedDate);
  const { overrides, replaceOverrides } = useOccurrenceOverrides();
  const [conflict, setConflict] = useState<ConflictResolution | null>(null);
  const [pendingSave, setPendingSave] = useState<ScheduleFormData | null>(null);
  const [conflictDate, setConflictDate] = useState<string | null>(null);
  const [conflictTarget, setConflictTarget] = useState<Schedule | null>(null);

  const recurringSchedules = getRecurringSchedulesForDate(recurring, exceptions, overrides, selectedDate);
  const allSchedules = [...schedules, ...recurringSchedules].sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );

  const openAddForm = () => { setEditingSchedule(null); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingSchedule(null); };

  /** Timeline click is the entry point for recording an activity. */
  const openScheduleActions = (schedule: Schedule) => setActionSchedule(schedule);

  const startActivityFromSchedule = async (schedule: Schedule, actualStart?: string) => {
    await startFromSchedule({
      title: schedule.title,
      date: selectedDate,
      plannedStart: schedule.start_time,
      plannedEnd: schedule.end_time,
      actualStart,
      provenance: provenanceFor(schedule, selectedDate),
    });
    setActionSchedule(null);
  };

  /**
   * Finish whichever running activity was started from this schedule. With
   * several activities in progress there may be more than one, so the most
   * recently started match is used.
   */
  const finishActivityForSchedule = async (schedule: Schedule, actualEnd: string) => {
    const match = [...runningIds]
      .reverse()
      .map((id) => logs.find((l) => l.id === id))
      .find(
        (l) => l && (l.schedule_id === schedule.id || l.recurring_id === schedule.id)
      );

    if (!match) {
      setActionSchedule(null);
      return;
    }
    await updateActualTimes(
      match.id,
      match.actual_start_time ?? schedule.start_time,
      actualEnd
    );
    setActionSchedule(null);
  };

  const openEditFromAction = (schedule: Schedule) => {
    setActionSchedule(null);
    setEditingSchedule(schedule);
    setShowForm(true);
  };

  const handleSave = async (formData: ScheduleFormData) => {
    const newSchedule: Schedule = {
      id: editingSchedule?.id || '',
      title: formData.title,
      date: formData.date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      created_at: editingSchedule?.created_at || '',
      repeat_type: formData.repeat_type,
      repeat_days: formData.repeat_days,
    };

    const conflicts = detectConflicts(newSchedule, allSchedules, formData.date);

    // The user can declare an overlap intentional, in which case it is saved
    // as-is rather than being pushed back through conflict resolution.
    if (conflicts.length > 0 && !formData.allowOverlap) {
      setConflict(proposeResolution(newSchedule, conflicts[0], recurring));
      setConflictDate(formData.date);
      setConflictTarget(conflicts[0]);
      setPendingSave(formData);
      return;
    }

    await executeSave(formData);
  };

  const applyExistingChange = async (segments: { start: string; end: string }[]) => {
    if (!conflictTarget || !conflictDate) return;

    const recurringSchedule = recurring.find((r) => r.id === conflictTarget.id);

    if (recurringSchedule) {
      await replaceOverrides(recurringSchedule.id, conflictDate, segments);
      return;
    }

    // One-time schedule: replace it with the surviving segments.
    await deleteSchedule(conflictTarget.id);
    for (const seg of segments) {
      await saveSchedule({
        title: conflictTarget.title,
        date: conflictDate,
        start_time: seg.start,
        end_time: seg.end,
      });
    }
  };

  const handleConflictChoose = async (option: ResolutionOption) => {
    if (!pendingSave) {
      setConflict(null);
      return;
    }

    if (option.kind === 'crop_existing') {
      await applyExistingChange([{ start: option.start, end: option.end }]);
      await executeSave(pendingSave);
    } else if (option.kind === 'split_existing') {
      await applyExistingChange(option.segments);
      await executeSave(pendingSave);
    } else if (option.kind === 'move_new') {
      await executeSave({ ...pendingSave, start_time: option.start, end_time: option.end });
    } else {
      setConflict(null);
      setPendingSave(null);
      return;
    }

    setConflict(null);
    setPendingSave(null);
  };

  const executeSave = async (formData: ScheduleFormData) => {
    if (formData.repeat_type === 'none') {
      await saveSchedule(formData, editingSchedule?.id);
    } else {
      const recurringData = {
        title: formData.title,
        start_time: formData.start_time,
        end_time: formData.end_time,
        repeat_type: formData.repeat_type,
        repeat_days: formData.repeat_days,
        start_date: formData.start_date,
      };
      if (editingSchedule && editingSchedule.repeat_type) {
        const recurringSchedule = recurring.find((r) => r.id === editingSchedule.id);
        if (recurringSchedule) {
          await saveRecurring(recurringData, recurringSchedule.id);
        } else {
          await saveRecurring(recurringData);
        }
      } else {
        await saveRecurring(recurringData);
        if (editingSchedule) {
          // Archive, never delete: activity logs recorded against this
          // one-time schedule reference it by schedule_id, and deleting the row
          // would discard the provenance of that history.
          await archiveSchedule(editingSchedule.id);
        }
      }
    }
    closeForm();
  };

  const handleConflictReject = () => {
    setConflict(null);
    setPendingSave(null);
  };

  /**
   * The unplanned path: record what the user is actually doing, then optionally
   * promote it into a schedule. The activity is always written; the schedule is
   * a side effect the user opted into.
   */
  const handleCapture = async (data: {
    title: string;
    start_time: string;
    end_time: string;
    repeat_type: RepeatType;
    repeat_days: number[];
    alsoAddSchedule: boolean;
    allowOverlap: boolean;
  }) => {
    const today = getLocalDateStr();

    // The activity is recorded first and unconditionally: what happened is not
    // contingent on whether a plan could be saved alongside it.
    await addCaptureLog(data.title, data.start_time, data.end_time);

    if (!data.alsoAddSchedule) {
      setShowCapture(false);
      return;
    }

    const repeatType = data.alsoAddSchedule ? data.repeat_type : 'none';

    // Promote the captured activity into a plan, applying the same conflict
    // rules as the schedule form so the two entry points cannot disagree.
    await handleSave({
      title: data.title,
      date: today,
      start_time: data.start_time,
      end_time: data.end_time,
      repeat_type: repeatType,
      repeat_days: data.repeat_days,
      start_date: today,
      allowOverlap: data.allowOverlap,
    });
    setShowCapture(false);
  };

  const handleDelete = async () => {
    if (!editingSchedule) return;
    if ((editingSchedule as any).repeat_type) {
      await deleteRecurring(editingSchedule.id);
    } else {
      await deleteSchedule(editingSchedule.id);
    }
    closeForm();
  };

  const handleSkipDay = async () => {
    if (!editingSchedule) return;
    const recurringSchedule = recurring.find((r) => r.id === editingSchedule.id);
    if (recurringSchedule) {
      await addException(recurringSchedule.id, selectedDate);
    }
  };

  return (
    <>
      <header className="app-header">
        <DatePicker selectedDate={selectedDate} onChange={setSelectedDate} />
      </header>

      <main className="app-main">
        <CurrentActivity schedules={allSchedules} logs={logs} runningIds={runningIds} currentTime={currentTime} onCapture={() => setShowCapture(true)} />
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <Timeline schedules={allSchedules} currentTime={currentTime} onSelect={openScheduleActions} recurringInfo={new Map(recurring.map((r) => [r.id, { repeat_type: r.repeat_type, repeat_days: r.repeat_days }]))} />
        )}
        <ActivityTracker
          logs={logs}
          runningIds={runningIds}
          elapsed={elapsed}
          selectedDate={selectedDate}
          schedules={allSchedules}
          onPause={pauseLog}
          onResume={resumeLog}
          onFinish={finishLog}
          onSkip={skipLog}
          onAdjustTime={updateActualTimes}
          onAddActivity={addRetrospectiveLog}
        />
      </main>

      <button className="fab" onClick={openAddForm}>+ Add Schedule</button>

      {showForm && (
        <ScheduleForm
          schedule={editingSchedule}
          selectedDate={selectedDate}
          onSave={handleSave}
          onDelete={editingSchedule ? handleDelete : undefined}
          onSkipDay={editingSchedule && editingSchedule.repeat_type ? handleSkipDay : undefined}
          onClose={closeForm}
        />
      )}
      {showCapture && (
        <ActivityCapture
          currentTime={currentTime}
          onSave={handleCapture}
          onClose={() => setShowCapture(false)}
        />
      )}
      {actionSchedule && (
        <ScheduleActionSheet
          schedule={actionSchedule}
          date={selectedDate}
          runningIds={runningIds}
          isActive={(() => {
            const now = currentTime.getHours() * 60 + currentTime.getMinutes();
            return (
              now >= timeToMinutes(actionSchedule.start_time) &&
              now < timeToMinutes(actionSchedule.end_time)
            );
          })()}
          onStartNow={() => startActivityFromSchedule(actionSchedule)}
          onStartEarly={(t) => startActivityFromSchedule(actionSchedule, t)}
          onFinish={(t) => finishActivityForSchedule(actionSchedule, t)}
          onEdit={() => openEditFromAction(actionSchedule)}
          onClose={() => setActionSchedule(null)}
        />
      )}
      {conflict && (
        <ConflictDialog
          resolution={conflict}
          onChoose={handleConflictChoose}
          onReject={handleConflictReject}
        />
      )}
    </>
  );
}
