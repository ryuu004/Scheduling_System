import { useState, useEffect } from 'react';
import type { Schedule, RepeatType } from '../types';

interface Props {
  schedule?: Schedule | null;
  selectedDate: string;
  onSave: (data: ScheduleFormData) => void;
  onDelete?: () => void;
  onSkipDay?: () => void;
  onClose: () => void;
}

export interface ScheduleFormData {
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  repeat_type: RepeatType;
  repeat_days: number[];
  start_date: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ScheduleForm({ schedule, selectedDate, onSave, onDelete, onSkipDay, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(selectedDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [repeatType, setRepeatType] = useState<RepeatType>('none');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [startDate, setStartDate] = useState(selectedDate);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (schedule) {
      setTitle(schedule.title);
      setDate(schedule.date);
      setStartTime(schedule.start_time);
      setEndTime(schedule.end_time);
      setRepeatType(schedule.repeat_type || 'none');
      setRepeatDays(schedule.repeat_days || []);
      setStartDate((schedule as any).start_date || selectedDate);
    }
  }, [schedule]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), date, start_time: startTime, end_time: endTime, repeat_type: repeatType, repeat_days: repeatDays, start_date: startDate });
  };

  const toggleDay = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{schedule ? 'Edit Schedule' : 'Add Schedule'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What are you doing?"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="date">Date</label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="start">Start Time</label>
              <input
                id="start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="end">End Time</label>
              <input
                id="end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          {repeatType !== 'none' && (
            <div className="form-group">
              <label htmlFor="start-date">Start Date</label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          )}
          <div className="form-group">
            <label>Repeat</label>
            <div className="repeat-options">
              {([
                { value: 'none', label: 'Does not repeat' },
                { value: 'daily', label: 'Every day' },
                { value: 'weekdays', label: 'Weekdays' },
                { value: 'weekly', label: 'Every week' },
                { value: 'custom', label: 'Custom days' },
              ] as { value: RepeatType; label: string }[]).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`repeat-btn${repeatType === value ? ' active' : ''}`}
                  onClick={() => setRepeatType(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {(repeatType === 'weekly' || repeatType === 'custom') && (
            <div className="form-group">
              <label>Days</label>
              <div className="days-row">
                {DAYS.map((day, i) => (
                  <button
                    key={day}
                    type="button"
                    className={`day-btn${repeatDays.includes(i) ? ' active' : ''}`}
                    onClick={() => toggleDay(i)}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="form-actions">
            {schedule && onSkipDay && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onSkipDay}
              >
                Skip this day
              </button>
            )}
            {schedule && onDelete && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete
              </button>
            )}
            <div className="form-actions-right">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {schedule ? 'Save Changes' : 'Add Schedule'}
              </button>
            </div>
          </div>
        </form>
        {showDeleteConfirm && (
          <div className="delete-confirm">
            <p>Are you sure you want to delete this schedule?</p>
            <div className="delete-confirm-actions">
              <button className="btn btn-ghost" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={onDelete}>
                Yes, Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
