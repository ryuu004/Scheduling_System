import { useState } from 'react';
import type { Schedule } from '../types';
import { validateActualRange, validateActualStart, provenanceFor } from '../lib/activity';

interface Props {
  schedule: Schedule;
  date: string;
  isActive: boolean;
  onStartNow: () => void;
  onStartEarly: (actualStart: string) => void;
  onFinish: (actualEnd: string) => void;
  onEdit: () => void;
  onClose: () => void;
}

/**
 * Recording an activity is entered through the schedule itself: the user picks
 * the block they are doing, rather than the system inferring intent from the
 * clock. This is what makes "started early" expressible at all, since a
 * future block can never contain the current time.
 */
export function ScheduleActionSheet({
  schedule,
  date,
  isActive,
  onStartNow,
  onStartEarly,
  onFinish,
  onEdit,
  onClose,
}: Props) {
  const [mode, setMode] = useState<'idle' | 'early' | 'finish'>('idle');
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submitEarly = () => {
    // Only the actual start is known at this point. The start must be a valid
    // time and must not fall after the planned end, otherwise it could never
    // belong to this block.
    const check = validateActualStart(time, schedule.end_time);
    if (!check.ok) {
      setError(check.message ?? 'Invalid time.');
      return;
    }
    onStartEarly(time);
  };

  const submitFinish = () => {
    const check = validateActualRange(schedule.start_time, time, schedule.end_time);
    if (!check.ok) {
      setError(check.message ?? 'Invalid time.');
      return;
    }
    onFinish(time);
  };

  const provenance = provenanceFor(schedule, date);
  const isRecurring = Boolean(schedule.repeat_type && schedule.repeat_type !== 'none');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal action-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="action-sheet-head">
          <h2 className="modal-title">{schedule.title}</h2>
          <span className="action-sheet-time">
            {schedule.start_time.slice(0, 5)} – {schedule.end_time.slice(0, 5)}
            {isRecurring && ' · recurring'}
          </span>
        </div>

        {mode === 'idle' && (
          <>
            <div className="action-options">
              <button className="conflict-option" onClick={onStartNow}>
                <span className="conflict-option-label">
                  {isActive ? 'Start now' : `Start now (${schedule.start_time.slice(0, 5)} is planned)`}
                </span>
                <span className="conflict-option-detail">
                  Begin tracking from the current time
                </span>
              </button>

              <button className="conflict-option" onClick={() => { setMode('early'); setError(null); }}>
                <span className="conflict-option-label">Started earlier</span>
                <span className="conflict-option-detail">
                  Record when you actually began
                </span>
              </button>

              {isActive && (
                <button className="conflict-option" onClick={() => { setMode('finish'); setError(null); }}>
                  <span className="conflict-option-label">Finish now</span>
                  <span className="conflict-option-detail">
                    End this activity at the current time
                  </span>
                </button>
              )}

              <button className="conflict-option" onClick={onEdit}>
                <span className="conflict-option-label">Edit schedule</span>
                <span className="conflict-option-detail">
                  Change the plan, not the activity
                </span>
              </button>
            </div>

            <div className="action-sheet-foot">
              <span className="action-sheet-provenance">
                Will be logged against{' '}
                {provenance.scheduleId ? 'this one-time schedule' : 'this recurring occurrence'}
              </span>
            </div>
          </>
        )}

        {mode === 'early' && (
          <div className="action-inline">
            <label htmlFor="early-time">Actual start time</label>
            <input
              id="early-time"
              type="time"
              value={time}
              onChange={(e) => { setTime(e.target.value); setError(null); }}
              autoFocus
            />
            {error && <p className="action-error">{error}</p>}
            <div className="form-actions">
              <div className="form-actions-right">
                <button className="btn btn-ghost" onClick={() => setMode('idle')}>Back</button>
                <button className="btn btn-primary" onClick={submitEarly}>Start</button>
              </div>
            </div>
          </div>
        )}

        {mode === 'finish' && (
          <div className="action-inline">
            <label htmlFor="finish-time">Actual end time</label>
            <input
              id="finish-time"
              type="time"
              value={time}
              onChange={(e) => { setTime(e.target.value); setError(null); }}
              autoFocus
            />
            {error && <p className="action-error">{error}</p>}
            <div className="form-actions">
              <div className="form-actions-right">
                <button className="btn btn-ghost" onClick={() => setMode('idle')}>Back</button>
                <button className="btn btn-primary" onClick={submitFinish}>Finish</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}