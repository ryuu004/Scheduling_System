import { useState, useEffect } from 'react';
import type { RecurringSchedule, RepeatType } from '../types';

interface Props {
  schedule?: RecurringSchedule | null;
  onSave: (data: Omit<RecurringSchedule, 'id' | 'created_at'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function RecurringForm({ schedule, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [repeatType, setRepeatType] = useState<RepeatType>('none');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (schedule) {
      setTitle(schedule.title);
      setStartTime(schedule.start_time);
      setEndTime(schedule.end_time);
      setRepeatType(schedule.repeat_type);
      setRepeatDays(schedule.repeat_days);
    }
  }, [schedule]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), start_time: startTime, end_time: endTime, repeat_type: repeatType, repeat_days: repeatDays });
  };

  const toggleDay = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{schedule ? 'Edit Recurring' : 'Add Recurring'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="r-title">Title</label>
            <input id="r-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What are you doing?" autoFocus />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="r-start">Start Time</label>
              <input id="r-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="r-end">End Time</label>
              <input id="r-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Repeat</label>
            <div className="repeat-options">
              {(['none', 'daily', 'weekdays', 'weekly', 'custom'] as RepeatType[]).map((type) => (
                <button key={type} type="button" className={`repeat-btn${repeatType === type ? ' active' : ''}`} onClick={() => setRepeatType(type)}>
                  {type === 'none' ? 'Does not repeat' : type === 'daily' ? 'Every day' : type === 'weekdays' ? 'Weekdays' : type === 'weekly' ? 'Every week' : 'Custom days'}
                </button>
              ))}
            </div>
          </div>
          {(repeatType === 'weekly' || repeatType === 'custom') && (
            <div className="form-group">
              <label>Days</label>
              <div className="days-row">
                {DAYS.map((day, i) => (
                  <button key={day} type="button" className={`day-btn${repeatDays.includes(i) ? ' active' : ''}`} onClick={() => toggleDay(i)}>
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="form-actions">
            {schedule && onDelete && (
              <button type="button" className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}>Delete</button>
            )}
            <div className="form-actions-right">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary">{schedule ? 'Save Changes' : 'Add Recurring'}</button>
            </div>
          </div>
        </form>
        {showDeleteConfirm && (
          <div className="delete-confirm">
            <p>Are you sure you want to delete this recurring schedule?</p>
            <div className="delete-confirm-actions">
              <button className="btn btn-ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={onDelete}>Yes, Delete</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
