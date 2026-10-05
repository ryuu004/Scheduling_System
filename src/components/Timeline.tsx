import type { Schedule, RepeatType } from '../types';

interface Props {
  schedules: Schedule[];
  currentTime: Date;
  onSelect: (schedule: Schedule) => void;
  recurringInfo?: Map<string, { repeat_type: RepeatType; repeat_days: number[] }>;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getRepeatLabel(repeatType: RepeatType, repeatDays: number[]): string {
  switch (repeatType) {
    case 'daily': return 'Every day';
    case 'weekdays': return 'Weekdays';
    case 'weekly': return repeatDays.length > 0 ? repeatDays.map((d) => DAY_LABELS[d]).join(', ') : 'Weekly';
    case 'custom': return repeatDays.length > 0 ? repeatDays.map((d) => DAY_LABELS[d]).join(', ') : 'Custom';
    default: return '';
  }
}

interface Placed {
  schedule: Schedule;
  start: number;
  end: number;
  lane: number;
}

/**
 * Assign each block a horizontal lane so overlapping blocks sit side by side
 * instead of stacking on top of one another.
 *
 * Blocks are placed in start order into the first lane whose last occupant has
 * already ended; `totalLanes` is how many are needed at the widest point, and
 * every block is then scaled to that width so the column stays a fixed size
 * regardless of how many lanes exist.
 */
function layoutLanes(schedules: Schedule[]): { placed: Placed[]; totalLanes: number } {
  const items = schedules
    .map((s) => {
      const [sh, sm] = s.start_time.split(':').map(Number);
      const [eh, em] = s.end_time.split(':').map(Number);
      return { schedule: s, start: sh * 60 + sm, end: eh * 60 + em };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const laneEnds: number[] = [];

  const placed: Placed[] = items.map((item) => {
    let lane = laneEnds.findIndex((endAt) => endAt <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    return { ...item, lane };
  });

  return { placed, totalLanes: Math.max(laneEnds.length, 1) };
}

export function Timeline({ schedules, currentTime, onSelect, recurringInfo }: Props) {
  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const recurringIds = new Set(schedules.filter((s) => !s.created_at).map((s) => s.id));

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

  const { placed, totalLanes } = layoutLanes(schedules);

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
          {placed.map(({ schedule: s, start, end, lane }) => {
            const top = ((start - startHour * 60) / ((endHour - startHour + 1) * 60)) * 100;
            const height = ((end - start) / ((endHour - startHour + 1) * 60)) * 100;
            const isActive = nowMinutes >= start && nowMinutes < end;
            const width = 100 / totalLanes;
            const isLastLane = lane === totalLanes - 1;

            return (
              <div
                key={s.segmentId ?? s.id}
                className={`timeline-event${isActive ? ' active' : ''}${totalLanes > 1 ? ' split' : ''}`}
                style={{
                  top: `${top}%`,
                  height: `${Math.max(height, 3)}%`,
                  left: `${lane * width}%`,
                  width: isLastLane ? `calc(${width}% - 4px)` : `calc(${width}% - 2px)`,
                }}
                onClick={() => onSelect(s)}
              >
                <span className="event-title">
                  {s.title}
                  {recurringIds.has(s.id) && recurringInfo?.has(s.id) && (
                    <span className="recurring-label">
                      {getRepeatLabel(recurringInfo.get(s.id)!.repeat_type, recurringInfo.get(s.id)!.repeat_days)}
                    </span>
                  )}
                </span>
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
