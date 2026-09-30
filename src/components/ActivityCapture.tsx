import { useState } from 'react';
import type { RepeatType } from '../types';

interface Props {
  currentTime: Date;
  onSave: (data: { title: string; start_time: string; end_time: string; repeat_type: RepeatType; repeat_days: number[]; start_date: string }) => void;
  onClose: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ActivityCapture({ currentTime, onSave, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(60);
  const [repeatType, setRepeatType] = useState<RepeatType>('none');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);

  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const endTimeMinutes = Math.min(nowMinutes + duration, 24 * 60 - 1);

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      start_time: formatTime(nowMinutes),
      end_time: formatTime(endTimeMinutes),
      repeat_type: repeatType,
      repeat_days: repeatDays,
      start_date: new Date().toISOString().split('T')[0],
    });
  };

  const toggleDay = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">What are you doing right now?</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="capture-title">Activity</label>
            <input
              id="capture-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Programming, Reading, Exercise"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="capture-duration">How long?</label>
            <select
              id="capture-duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
              <option value={180}>3 hours</option>
              <option value={240}>4 hours</option>
            </select>
          </div>
          <div className="form-group">
            <label>Repeat</label>
            <div className="repeat-options">
              {([
                { value: 'none', label: 'Just today' },
                { value: 'daily', label: 'Every day' },
                { value: 'weekdays', label: 'Weekdays' },
                { value: 'weekly', label: 'Every week' },
                { value: 'custom', label: 'Custom' },
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
            <div className="form-actions-right">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
