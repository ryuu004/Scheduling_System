import { useState } from 'react';
import { useAnalytics, type RangeDays } from './hooks/useAnalytics';
import {
  plannedVsActual,
  timeDistribution,
  adherenceByDay,
  generateInsights,
} from './lib/analytics';
import { PlannedVsActualChart, DistributionChart, AdherenceChart } from './components/charts';

const RANGES: { value: RangeDays; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

export function AnalyticsPage() {
  const [range, setRange] = useState<RangeDays>(30);
  const {
    logs,
    loading,
    error,
    windowStart,
    windowEnd,
    recurringSlots,
    loggedOccurrences,
  } = useAnalytics(range);

  const vsActual = plannedVsActual(logs);
  const distribution = timeDistribution(logs);
  const days = adherenceByDay(logs, windowStart, windowEnd);
  const insights = generateInsights({
    logs,
    applicableRecurring: recurringSlots,
    loggedOccurrences,
  });

  return (
    <div className="analytics">
      <header className="analytics-header">
        <h1 className="analytics-title">Analytics</h1>
        <div className="range-picker">
          {RANGES.map((r) => (
            <button
              key={r.value}
              className={`range-btn${range === r.value ? ' active' : ''}`}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="analytics-error">{error}</p>}
      {loading && <p className="loading">Loading...</p>}

      {!loading && !error && (
        <>
          <section className="card">
            <h2 className="card-title">Planned vs Actual</h2>
            <p className="card-sub">
              Only activities that had a plan are compared. Unplanned work is
              counted separately so it cannot distort the comparison.
            </p>
            <PlannedVsActualChart data={vsActual} />
          </section>

          <section className="card">
            <h2 className="card-title">Time Distribution</h2>
            <p className="card-sub">Where your recorded time went, by activity.</p>
            <DistributionChart slices={distribution} />
          </section>

          <section className="card">
            <h2 className="card-title">Adherence Trend</h2>
            <p className="card-sub">
              Daily actual time against planned time, for the last {range} days.
            </p>
            <AdherenceChart days={days} />
          </section>

          <section className="card">
            <h2 className="card-title">Observations</h2>
            <ul className="insight-list">
              {insights.map((insight, i) => (
                <li key={i} className={`insight insight-${insight.kind}`}>
                  <span className="insight-title">{insight.title}</span>
                  <span className="insight-detail">{insight.detail}</span>
                </li>
              ))}
            </ul>
            <p className="card-foot">
              Observations are simple rules over your own records, not guesses.
              Each one needs at least 3 comparable activities before it appears.
            </p>
          </section>
        </>
      )}
    </div>
  );
}