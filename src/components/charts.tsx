import type { DayBucket, PlannedVsActual, TitleSlice } from '../lib/analytics';

function fmtDuration(mins: number): string {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Planned against actual, as a pair of horizontal bars.
 *
 * Bars are scaled against the larger of the two so the comparison stays
 * readable whether you over- or under-spend.
 */
export function PlannedVsActualChart({ data }: { data: PlannedVsActual }) {
  const max = Math.max(data.plannedMinutes, data.actualMinutes, 1);
  const plannedPct = (data.plannedMinutes / max) * 100;
  const actualPct = (data.actualMinutes / max) * 100;

  if (data.comparableCount === 0) {
    return <EmptyChart note="No activities with both a plan and a record yet." />;
  }

  const delta = data.actualMinutes - data.plannedMinutes;

  return (
    <div className="chart">
      <Bar label="Planned" value={fmtDuration(data.plannedMinutes)} pct={plannedPct} tone="muted" />
      <Bar label="Actual" value={fmtDuration(data.actualMinutes)} pct={actualPct} tone="solid" />
      <p className="chart-note">
        {delta === 0
          ? 'Actual time matched planned time.'
          : `${fmtDuration(Math.abs(delta))} ${delta > 0 ? 'more' : 'less'} than planned.`}
      </p>
    </div>
  );
}

function Bar({
  label,
  value,
  pct,
  tone,
}: {
  label: string;
  value: string;
  pct: number;
  tone: 'muted' | 'solid';
}) {
  return (
    <div className="bar-row">
      <div className="bar-head">
        <span className="bar-label">{label}</span>
        <span className="bar-value">{value}</span>
      </div>
      <div className="bar-track">
        <div className={`bar-fill ${tone}`} style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
    </div>
  );
}

/** Where actual time went, ranked by total time. */
export function DistributionChart({ slices }: { slices: TitleSlice[] }) {
  if (slices.length === 0) {
    return <EmptyChart note="No completed activities to break down yet." />;
  }

  return (
    <div className="chart">
      {slices.map((s) => (
        <div key={s.title} className="bar-row">
          <div className="bar-head">
            <span className="bar-label">{s.title}</span>
            <span className="bar-value">
              {fmtDuration(s.actualMinutes)}
              <span className="bar-share">{Math.round(s.share * 100)}%</span>
            </span>
          </div>
          <div className="bar-track">
            <div className="bar-fill solid" style={{ width: `${Math.max(s.share * 100, 1)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Daily adherence as columns against a 100% reference line.
 *
 * Days with no plan render empty rather than zero, since zero would read as
 * "you did nothing" when it actually means "nothing was asked of you".
 */
export function AdherenceChart({ days }: { days: DayBucket[] }) {
  const withData = days.filter((d) => d.adherence !== null);

  if (withData.length === 0) {
    return <EmptyChart note="No days with a plan and a record yet." />;
  }

  return (
    <div className="chart">
      <div className="trend">
        <div className="trend-reference" aria-hidden="true" />
        {days.map((d) => (
          <div key={d.date} className="trend-col" title={`${d.date}: ${d.adherence === null ? 'no plan' : Math.round(d.adherence * 100) + '% of plan'}`}>
            <div className={`trend-bar${d.adherence === null ? ' empty' : d.adherence >= 1 ? ' over' : ' under'}`}
                 style={{ height: d.adherence === null ? '2px' : `${Math.min(d.adherence, 2) * 50}%` }} />
          </div>
        ))}
      </div>
      <div className="trend-legend">
        <span className="trend-cap">{days[0]?.date.slice(5)}</span>
        <span className="trend-key">under plan · on plan · over plan</span>
        <span className="trend-cap">{days[days.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

function EmptyChart({ note }: { note: string }) {
  return (
    <div className="chart">
      <p className="chart-empty">{note}</p>
    </div>
  );
}