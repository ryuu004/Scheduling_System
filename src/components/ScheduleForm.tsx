import { useState, useEffect } from 'react';
import type { Schedule } from '../types';

interface Props {
  schedule?: Schedule | null;
  selectedDate: string;
  onSave: (data: Omit<Schedule, 'id' | 'created_at'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function ScheduleForm({ schedule, selectedDate, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(selectedDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (schedule) {
      setTitle(schedule.title);
      setDate(schedule.date);
      setStartTime(schedule.start_time);
      setEndTime(schedule.end_time);
    }
  }, [schedule]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), date, start_time: startTime, end_time: endTime });
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
          <div className="form-actions">
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
