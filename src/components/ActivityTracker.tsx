import { useState } from 'react';
import type { ActivityLog, ActivitySource, Schedule, LogProvenance } from '../types';
import { provenanceFor, timeToMinutes } from '../lib/activity';

interface Props {
  logs: ActivityLog[];
  activeLogId: string | null;
  elapsed: number;
  selectedDate: string;
  schedules: Schedule[];
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onSkip: (logId: string) => void;
  onAdjustTime: (logId: string, actualStart: string, actualEnd: string) => void;
  onAddActivity: (
    title: string,
    date: string,
    actualStart: string,
    actualEnd: string,
    plan?: { plannedStartTime: string; plannedEndTime: string } & LogProvenance
  ) => void;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const SOURCE_LABEL: Record<ActivitySource, string> = {
  live: 'live',
  retrospective: 'retrospective',
  capture: 'capture',
};

const PROVENANCE_LABEL = {
  'one-time': 'one-time',
  recurring: 'recurring',
  unplanned: 'unplanned',
} as const;

/**
 * Reports activity that is already in flight or already recorded. Starting an
 * activity is no longer handled here: the schedule itself is the entry point,
 * so this component only reflects and closes out what exists.
 */
export function ActivityTracker({
  logs,
  activeLogId,
  elapsed,
  selectedDate,
  schedules,
  onPause,
  onResume,
  onFinish,
  onSkip,
  onAdjustTime,
  onAddActivity,
}: Props) {
  const [showAdjust, setShowAdjust] = useState<string | null>(null);
  const [adjustStart, setAdjustStart] = useState('');
  const [adjustEnd, setAdjustEnd] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addStart, setAddStart] = useState('');
  const [addEnd, setAddEnd] = useState('');

  const currentLog = logs.find((l) => l.id === activeLogId);
  const pendingLogs = logs.filter((l) => l.status === 'pending');
  const completedLogs = logs.filter((l) => l.status === 'completed' || l.status === 'skipped');

  const handleDoneAsPlanned = (log: ActivityLog) => {
    if (!log.planned_start_time || !log.planned_end_time) return;
    onAdjustTime(log.id, log.planned_start_time, log.planned_end_time);
  };

  const handleAdjustSubmit = (logId: string) => {
    if (adjustStart && adjustEnd) {
      onAdjustTime(logId, adjustStart, adjustEnd);
      setShowAdjust(null);
      setAdjustStart('');
      setAdjustEnd('');
    }
  };

  const handleAddSubmit = () => {
    if (!addTitle || !addStart || !addEnd) return;

    // If the logged window sits inside a planned block, attach that block as
    // the baseline so planned-vs-actual stays meaningful.
    const match = schedules.find((s) => {
      const aStart = timeToMinutes(addStart);
      const aEnd = timeToMinutes(addEnd);
      return (
        aStart >= timeToMinutes(s.start_time) && aEnd <= timeToMinutes(s.end_time)
      );
    });

    onAddActivity(
      addTitle,
      selectedDate,
      addStart,
      addEnd,
      match
        ? {
            plannedStartTime: match.start_time,
            plannedEndTime: match.end_time,
            ...provenanceFor(match, selectedDate),
          }
        : undefined
    );
    setShowAdd(false);
    setAddTitle('');
    setAddStart('');
    setAddEnd('');
  };

  const hasAnything = currentLog || pendingLogs.length > 0 || completedLogs.length > 0;

  return (
    <div className="activity-tracker">
      {currentLog && (
        <div className="tracker-section">
          <div className="tracker-title">Tracking</div>
          <div className="tracker-schedule">{currentLog.title}</div>
          <div className="tracker-elapsed">{formatElapsed(elapsed)}</div>
          <div className="tracker-actions">
            <button className="btn btn-ghost" onClick={onPause}>Pause</button>
            <button className="btn btn-ghost" onClick={onResume}>Resume</button>
            <button className="btn btn-primary" onClick={onFinish}>Finish</button>
          </div>
        </div>
      )}

      {pendingLogs.length > 0 && (
        <div className="tracker-section">
          <div className="tracker-title">Pending</div>
          {pendingLogs.map((log) => (
            <div key={log.id} className="pending-log">
              <div className="pending-info">
                <span className="pending-title">{log.title}</span>
                <span className="pending-time">{log.planned_start_time} — {log.planned_end_time}</span>
              </div>
              <div className="pending-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => handleDoneAsPlanned(log)}
                  disabled={!log.planned_start_time || !log.planned_end_time}
                >
                  Done as Planned
                </button>
                <button className="btn btn-ghost" onClick={() => { setShowAdjust(log.id); setAdjustStart(log.planned_start_time ?? ''); setAdjustEnd(log.planned_end_time ?? ''); }}>Adjust Time</button>
                <button className="btn btn-danger" onClick={() => onSkip(log.id)}>Skip</button>
              </div>
              {showAdjust === log.id && (
                <div className="adjust-form">
                  <input type="time" value={adjustStart} onChange={(e) => setAdjustStart(e.target.value)} />
                  <input type="time" value={adjustEnd} onChange={(e) => setAdjustEnd(e.target.value)} />
                  <button className="btn btn-primary" onClick={() => handleAdjustSubmit(log.id)}>Save</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {completedLogs.length > 0 && (
        <div className="tracker-section">
          <div className="tracker-title">Completed</div>
          {completedLogs.map((log) => {
            const provenance = log.schedule_id
              ? 'one-time'
              : log.recurring_id
                ? 'recurring'
                : 'unplanned';
            return (
              <div key={log.id} className="completed-log">
                <span className="completed-title">
                  {log.title}
                  <span className="log-meta">
                    {SOURCE_LABEL[log.source]} · {PROVENANCE_LABEL[provenance]}
                  </span>
                </span>
                <span className="completed-time">
                  {log.status === 'skipped'
                    ? 'Skipped'
                    : `${log.actual_start_time} — ${log.actual_end_time}`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {hasAnything && (
        <button className="btn btn-ghost add-activity-btn" onClick={() => setShowAdd(true)}>
          + Add Activity
        </button>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Add Activity</h2>
            <div className="form-group">
              <label>Title</label>
              <input type="text" value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder="What did you do?" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Start Time</label>
                <input type="time" value={addStart} onChange={(e) => setAddStart(e.target.value)} />
              </div>
              <div className="form-group">
                <label>End Time</label>
                <input type="time" value={addEnd} onChange={(e) => setAddEnd(e.target.value)} />
              </div>
            </div>
            <div className="form-actions">
              <div className="form-actions-right">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleAddSubmit}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}