import { useState } from 'react';
import type { Schedule, RepeatType } from './types';
import { useClock } from './hooks/useClock';
import { useSchedules } from './hooks/useSchedules';
import { useRecurringSchedules } from './hooks/useRecurringSchedules';
import { getRecurringSchedulesForDate } from './lib/recurrence';
import { CurrentActivity } from './components/CurrentActivity';
import { Timeline } from './components/Timeline';
import { ScheduleForm, type ScheduleFormData } from './components/ScheduleForm';
import { ActivityCapture } from './components/ActivityCapture';
import { DatePicker } from './components/DatePicker';
import { getLocalDateStr } from './lib/date';

export function SchedulerPage() {
  const currentTime = useClock();
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [showForm, setShowForm] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const { schedules, loading, saveSchedule, deleteSchedule } = useSchedules(selectedDate);
  const { recurring, exceptions, saveRecurring, deleteRecurring, addException } = useRecurringSchedules();

  const recurringSchedules = getRecurringSchedulesForDate(recurring, exceptions, selectedDate);
  const allSchedules = [...schedules, ...recurringSchedules].sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );

  const openAddForm = () => { setEditingSchedule(null); setShowForm(true); };
  const openEditForm = (schedule: Schedule) => { setEditingSchedule(schedule); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingSchedule(null); };

  const handleSave = async (formData: ScheduleFormData) => {
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
          await deleteSchedule(editingSchedule.id);
        }
      }
    }
    closeForm();
  };

  const handleCapture = async (data: { title: string; start_time: string; end_time: string; repeat_type: RepeatType; repeat_days: number[] }) => {
    const today = getLocalDateStr();
    if (data.repeat_type === 'none') {
      await saveSchedule({ title: data.title, date: today, start_time: data.start_time, end_time: data.end_time });
    } else {
      await saveRecurring({ title: data.title, start_time: data.start_time, end_time: data.end_time, repeat_type: data.repeat_type, repeat_days: data.repeat_days, start_date: getLocalDateStr() });
    }
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
        <CurrentActivity schedules={allSchedules} currentTime={currentTime} onCapture={() => setShowCapture(true)} />
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <Timeline schedules={allSchedules} currentTime={currentTime} onSelect={openEditForm} recurringInfo={new Map(recurring.map((r) => [r.id, { repeat_type: r.repeat_type, repeat_days: r.repeat_days }]))} />
        )}
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
    </>
  );
}
