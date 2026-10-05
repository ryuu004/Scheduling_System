import {
  durationMinutes,
  plannedVsActual,
  timeDistribution,
  adherenceByDay,
  startOffsets,
  generateInsights,
  type AnalyticsLog,
} from '../src/lib/analytics';

let failures = 0;
const expect = (label: string, actual: unknown, wanted: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(wanted);
  if (!ok) { failures++; console.log(`  FAIL ${label}: got ${JSON.stringify(actual)} want ${JSON.stringify(wanted)}`); }
  else console.log(`  ok   ${label}`);
};

const mk = (o: Partial<AnalyticsLog> = {}): AnalyticsLog => ({
  title: 'Programming',
  planned_date: '2026-10-01',
  planned_start_time: '09:00',
  planned_end_time: '10:00',
  actual_start_time: '09:00',
  actual_end_time: '10:00',
  status: 'completed',
  schedule_id: 's1',
  recurring_id: null,
  occurrence_date: null,
  source: 'live',
  ...o,
});

console.log('=== duration handling ===');
expect('simple range', durationMinutes('09:00', '10:30'), 90);
expect('DB seconds format', durationMinutes('09:00:00', '10:30:00'), 90);
expect('missing end', durationMinutes('09:00', null), 0);
expect('midnight wrap counts forward', durationMinutes('23:30', '00:30'), 60);

console.log('\n=== planned vs actual ===');
{
  // 09:00-10:00 = 60m, 09:20-11:00 = 100m -> 160m actual against 120m planned.
  const r = plannedVsActual([mk(), mk({ actual_start_time: '09:20', actual_end_time: '11:00' })]);
  expect('planned summed', r.plannedMinutes, 120);
  expect('actual summed', r.actualMinutes, 160);
  expect('ratio 160/120', r.ratio, 160 / 120);
  expect('both comparable', r.comparableCount, 2);
}
{
  // Unplanned work must not leak into either side of the comparison.
  const r = plannedVsActual([
    mk(),
    mk({ planned_start_time: null, planned_end_time: null, actual_start_time: '12:00', actual_end_time: '13:30', source: 'capture' }),
  ]);
  expect('planned unaffected by unplanned', r.plannedMinutes, 60);
  expect('actual unaffected by unplanned', r.actualMinutes, 60);
  expect('unplanned counted separately', r.unplannedCount, 1);
}
{
  // A skipped plan was not spent, so it must not count against adherence.
  const r = plannedVsActual([mk({ status: 'skipped', actual_start_time: null, actual_end_time: null })]);
  expect('skipped excluded from planned', r.plannedMinutes, 0);
}
{
  const r = plannedVsActual([]);
  expect('empty is not a divide by zero', r.ratio, null);
}

console.log('\n=== time distribution ===');
{
  const d = timeDistribution([
    mk({ actual_start_time: '09:00', actual_end_time: '11:00' }),
    mk({ actual_start_time: '11:00', actual_end_time: '12:00' }),
    mk({ title: 'Gym', actual_start_time: '17:00', actual_end_time: '18:00' }),
  ]);
  expect('ranked by duration', d.map((x) => x.title), ['Programming', 'Gym']);
  expect('totals 180', d[0].actualMinutes, 180);
  expect('shares sum to 1', d.reduce((a, b) => a + b.share, 0), 1);
}
{
  expect('no data is empty', timeDistribution([]), []);
}

console.log('\n=== adherence by day ===');
{
  // Plan and actual both 09:00-10:00 on the occurrence date.
  const logs = [mk({ occurrence_date: '2026-10-02' })];
  const days = adherenceByDay(logs, '2026-10-01', '2026-10-03');
  expect('window length includes endpoints', days.length, 3);
  expect('ordered by date', days.map((d) => d.date), ['2026-10-01', '2026-10-02', '2026-10-03']);
  expect('matched the occurrence day', days[1].adherence, 1);
  expect('empty day is null not zero', days[0].adherence, null);
  expect('other empty day is null', days[2].adherence, null);
}
{
  // A log with no occurrence_date falls back to planned_date.
  const days = adherenceByDay([mk({ planned_date: '2026-10-01', occurrence_date: null })], '2026-10-01', '2026-10-01');
  expect('falls back to planned_date', days[0].adherence, 1);
}

console.log('\n=== start offsets, including overnight ===');
{
  // Normal late start.
  const a = startOffsets([mk({ planned_start_time: '09:00', actual_start_time: '09:30' })]);
  expect('30m late', a[0].deltaMinutes, 30);
  // Normal early start.
  const b = startOffsets([mk({ planned_start_time: '09:00', actual_start_time: '08:45' })]);
  expect('15m early', b[0].deltaMinutes, -15);
  // Overnight: planned 23:00, actually began 00:15 -> the NEXT day, so ~75m late, not -22h.
  const c = startOffsets([mk({ planned_start_time: '23:00', actual_start_time: '00:15' })]);
  expect('overnight read as late, not -22h', c[0].deltaMinutes, 75);
  // No actual start -> excluded entirely.
  expect('missing actual excluded', startOffsets([mk({ actual_start_time: null })]).length, 0);
}

console.log('\n=== rule-based insights ===');
{
  // Planned 09:00-10:00 (60m); actually 09:40-10:30 (50m). Starts 40m late
  // but finishes EARLIER than the plan, so overrun is negative.
  const lateShort = Array.from({ length: 5 }, () =>
    mk({ planned_start_time: '09:00', planned_end_time: '10:00', actual_start_time: '09:40', actual_end_time: '10:30' })
  );
  const insA = generateInsights({ logs: lateShort });
  expect('detects starting late', insA.some((i) => i.kind === 'starts_late'), true);
  expect('does NOT claim it ran long', insA.some((i) => i.kind === 'runs_long'), false);
  // 10m short is under the 15m threshold, so no duration insight either way.
  expect('10m short is below threshold', insA.some((i) => i.kind === 'runs_short'), false);

  // Planned 09:00-10:00 (60m); actually 09:10-09:40 (30m). 30m short, over threshold.
  const short = Array.from({ length: 5 }, () =>
    mk({ planned_start_time: '09:00', planned_end_time: '10:00', actual_start_time: '09:10', actual_end_time: '09:40' })
  );
  expect('reports finishing early', generateInsights({ logs: short }).some((i) => i.kind === 'runs_short'), true);

  // Planned 09:00-10:00 (60m); actually 09:40-11:00 (80m). Genuinely overruns.
  const lateLong = Array.from({ length: 5 }, () =>
    mk({ planned_start_time: '09:00', planned_end_time: '10:00', actual_start_time: '09:40', actual_end_time: '11:00' })
  );
  const insB = generateInsights({ logs: lateLong });
  expect('detects running long', insB.some((i) => i.kind === 'runs_long'), true);
}
{
  const onTime = Array.from({ length: 5 }, () => mk());
  const ins = generateInsights({ logs: onTime });
  expect('no false alarm when on time', ins.some((i) => i.kind !== 'on_track'), false);
}
{
  const few = [mk()];
  const ins = generateInsights({ logs: few });
  expect('too little data says so', ins.some((i) => i.kind === 'on_track'), true);
}
{
  // Unused recurring slots are reported from occurrence keys, but only once
  // there is some history to compare against.
  const ins = generateInsights({
    logs: [mk()],
    applicableRecurring: new Set(['r1@2026-10-01', 'r2@2026-10-01']),
    loggedOccurrences: new Set(['r1@2026-10-01']),
  });
  const u = ins.find((i) => i.kind === 'unused_recurring');
  expect('counts unlogged slots', u?.title.includes('1 recurring slot'), true);
}
{
  const ins = generateInsights({
    logs: [mk()],
    applicableRecurring: new Set(['r1@2026-10-01']),
    loggedOccurrences: new Set(['r1@2026-10-01']),
  });
  expect('no unused when all logged', ins.some((i) => i.kind === 'unused_recurring'), false);
}
{
  // An empty history must not accuse the user of skipping recurring blocks.
  const ins = generateInsights({
    logs: [],
    applicableRecurring: new Set(['r1@2026-10-01', 'r2@2026-10-01', 'r3@2026-10-01']),
    loggedOccurrences: new Set<string>(),
  });
  expect('no unused-recurring claim on empty history', ins.some((i) => i.kind === 'unused_recurring'), false);
}

console.log('\n=== no insight may claim unsupported data ===');
{
  const ins = generateInsights({ logs: [] });
  expect('empty input yields only the fallback', ins.length, 1);
  expect('fallback is honest', ins[0].kind, 'on_track');
}

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);