import type { Schedule } from '../types';

interface Props {
  schedules: Schedule[];
  currentTime: Date;
  onSelect: (schedule: Schedule) => void;
}

export function Timeline({ schedules, currentTime, onSelect }: Props) {
  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  if (schedules.length === 0) {
    return (
      <div className="timeline-empty">
        <p>No schedules for this day</p>
      </div>
    );
  }

  const sorted = [...schedules].sort((a, b) => {
    const [ah, am] = a.start_time.split(':').map(Number);
    const [bh, bm] = b.start_time.split(':').map(Number);
    return ah * 60 + am - (bh * 60 + bm);
  });

  const [firstH] = sorted[0].start_time.split(':').map(Number);
  const [lastH] = sorted[sorted.length - 1].end_time.split(':').map(Number);
  const startHour = Math.max(0, firstH - 1);
  const endHour = Math.min(23, lastH + 1);

  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h++) {
    hours.push(h);
  }

  const nowPosition =
    ((nowMinutes - startHour * 60) / ((endHour - startHour + 1) * 60)) * 100;

  return (
    <div className="timeline">
      <div className="timeline-header">Today</div>
      <div className="timeline-body">
        <div className="timeline-hours">
          {hours.map((h) => (
            <div key={h} className="timeline-hour">
              {formatHour(h)}
            </div>
          ))}
        </div>
        <div className="timeline-events">
          {nowMinutes >= startHour * 60 && nowMinutes <= (endHour + 1) * 60 && (
            <div
              className="now-indicator"
              style={{ top: `${nowPosition}%` }}
            >
              <span className="now-dot" />
              <span className="now-label">NOW</span>
            </div>
          )}
          {sorted.map((s) => {
            const [sh, sm] = s.start_time.split(':').map(Number);
            const [eh, em] = s.end_time.split(':').map(Number);
            const top = ((sh * 60 + sm - startHour * 60) / ((endHour - startHour + 1) * 60)) * 100;
            const height = ((eh * 60 + em - (sh * 60 + sm)) / ((endHour - startHour + 1) * 60)) * 100;
            const isActive = nowMinutes >= sh * 60 + sm && nowMinutes < eh * 60 + em;

            return (
              <div
                key={s.id}
                className={`timeline-event${isActive ? ' active' : ''}`}
                style={{ top: `${top}%`, height: `${Math.max(height, 3)}%` }}
                onClick={() => onSelect(s)}
              >
                <span className="event-title">{s.title}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatHour(h: number): string {
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour} ${period}`;
}
