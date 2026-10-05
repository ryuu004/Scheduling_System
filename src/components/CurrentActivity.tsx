import type { ActivityLog, Schedule } from '../types';
import { timeToMinutes } from '../lib/activity';

interface Props {
  schedules: Schedule[];
  logs: ActivityLog[];
  runningIds: string[];
  currentTime: Date;
  onCapture: () => void;
}

/**
 * Shows everything happening right now.
 *
 * Several activities can be in progress at once, so this lists them rather than
 * assuming a single "current" one. Scheduled blocks that are live appear too,
 * since a plan can be underway without being logged yet.
 */
export function CurrentActivity({
  schedules,
  logs,
  runningIds,
  currentTime,
  onCapture,
}: Props) {
  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const now = currentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const running = logs.filter((l) => runningIds.includes(l.id));

  const liveSchedules = schedules.filter((s) => {
    const start = timeToMinutes(s.start_time);
    const end = timeToMinutes(s.end_time);
    return nowMinutes >= start && nowMinutes < end;
  });

  // Activities already logged take precedence; a scheduled block that is not
  // being tracked is listed underneath as context.
  const untrackedSchedules = liveSchedules.filter(
    (s) => !running.some((l) => l.schedule_id === s.id || l.recurring_id === s.id)
  );

  const nothingAtAll = running.length === 0 && untrackedSchedules.length === 0;

  return (
    <div className="current-activity">
      <div className="current-time">{now}</div>
      <div className="current-label">Current Activity</div>

      {nothingAtAll ? (
        <button className="capture-btn" onClick={onCapture}>
          <span className="capture-label">Nothing scheduled</span>
          <span className="capture-action">What are you doing right now?</span>
        </button>
      ) : (
        <div className="current-list">
          {running.map((log) => (
            <div key={log.id} className="current-item">
              <span className="current-item-title">{log.title}</span>
              <span className="current-item-time">
                {log.actual_start_time?.slice(0, 5)} – now
              </span>
            </div>
          ))}
          {untrackedSchedules.map((s) => (
            <div key={s.segmentId ?? s.id} className="current-item muted">
              <span className="current-item-title">{s.title}</span>
              <span className="current-item-time">
                {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}