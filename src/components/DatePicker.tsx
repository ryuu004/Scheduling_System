import { getLocalDateStr } from '../lib/date';

interface Props {
  selectedDate: string;
  onChange: (date: string) => void;
}

export function DatePicker({ selectedDate, onChange }: Props) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const formatDate = (d: Date) => getLocalDateStr(d);

  const isToday = selectedDate === formatDate(today);
  const isTomorrow = selectedDate === formatDate(tomorrow);

  const displayDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="date-picker">
      <div className="date-display">{displayDate}</div>
      <div className="date-actions">
        <button
          className={`date-btn${isToday ? ' active' : ''}`}
          onClick={() => onChange(formatDate(today))}
        >
          Today
        </button>
        <button
          className={`date-btn${isTomorrow ? ' active' : ''}`}
          onClick={() => onChange(formatDate(tomorrow))}
        >
          Tomorrow
        </button>
        <input
          type="date"
          className="date-input"
          value={selectedDate}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
