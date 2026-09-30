import type { Schedule } from '../types';

interface Props {
  schedules: Schedule[];
  currentTime: Date;
  onCapture: () => void;
}

export function CurrentActivity({ schedules, currentTime, onCapture }: Props) {
  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  const activeSchedule = schedules.find((s) => {
    const [sh, sm] = s.start_time.split(':').map(Number);
    const [eh, em] = s.end_time.split(':').map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    return nowMinutes >= start && nowMinutes < end;
  });

  const now = currentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="current-activity">
      <div className="current-time">{now}</div>
      <div className="current-label">Current Activity</div>
      {activeSchedule ? (
        <div className="current-title">{activeSchedule.title}</div>
      ) : (
        <button className="capture-btn" onClick={onCapture}>
          <span className="capture-label">Nothing scheduled</span>
          <span className="capture-action">What are you doing right now?</span>
        </button>
      )}
    </div>
  );
}
