import { proposeResolution, timeToMinutes } from '../src/lib/conflict';
import type { Schedule, RecurringSchedule } from '../src/types';

const mk = (over: Partial<Schedule> = {}): Schedule => ({
  id: 'new', title: 'meeting', date: '2026-10-03',
  start_time: '09:00', end_time: '10:00', created_at: '', ...over,
});

const existing = (over: Partial<Schedule> = {}): Schedule => ({
  id: 'ex', title: 'programming', date: '2026-10-03',
  start_time: '09:00', end_time: '10:00', created_at: '', ...over,
});

const asRecurring = (s: Schedule): RecurringSchedule => ({
  id: s.id, title: s.title, start_time: s.start_time, end_time: s.end_time,
  repeat_type: 'daily', repeat_days: [], start_date: '2020-01-01', created_at: '',
});

const show = (label: string, r: ReturnType<typeof proposeResolution>) => {
  console.log(`\n--- ${label}`);
  console.log(`    kind=${r.kind}`);
  r.options.forEach((o) => console.log(`    [${o.kind}] ${o.label} :: ${o.detail}`));
};

let failures = 0;
const expect = (label: string, actual: unknown, wanted: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(wanted);
  if (!ok) { failures++; console.log(`  FAIL ${label}: got ${JSON.stringify(actual)} want ${JSON.stringify(wanted)}`); }
  else console.log(`  ok   ${label}`);
};

console.log('=== SCENARIO 1: your reported bug ===');
console.log('existing programming 01:00-03:00, new meeting 02:00-03:00');
{
  const e = existing({ start_time: '01:00', end_time: '03:00' });
  const n = mk({ start_time: '02:00', end_time: '03:00' });
  const r = proposeResolution(n, e, [asRecurring(e)]);
  show('tail overlap', r);
  expect('classified as existing_tail', r.kind, 'existing_tail');
  const crop = r.options.find((o) => o.kind === 'crop_existing') as any;
  console.log(`    => crop result: ${crop.start} - ${crop.end}`);
  expect('crops to 01:00-02:00 (left piece survives)', [crop.start, crop.end], ['01:00', '02:00']);
  expect('no zero-length block', crop.start !== crop.end, true);
}

console.log('\n=== SCENARIO 2: middle / "inside" ===');
console.log('existing programming 01:00-03:00, new meeting 01:30-02:30');
{
  const e = existing({ start_time: '01:00', end_time: '03:00' });
  const n = mk({ start_time: '01:30', end_time: '02:30' });
  const r = proposeResolution(n, e, [asRecurring(e)]);
  show('inside', r);
  expect('classified as inside_existing', r.kind, 'inside_existing');
  const split = r.options.find((o) => o.kind === 'split_existing') as any;
  expect('split keeps both pieces', split.segments, [
    { start: '01:00', end: '01:30' },
    { start: '02:30', end: '03:00' },
  ]);
  const crops = r.options.filter((o) => o.kind === 'crop_existing');
  expect('offers a cut-tail option', crops.length >= 1, true);
  expect('offers cancel', r.options.some((o) => o.kind === 'cancel'), true);
}

console.log('\n=== SCENARIO 3: new covers existing entirely ===');
{
  const e = existing({ start_time: '01:00', end_time: '02:00' });
  const n = mk({ start_time: '00:30', end_time: '03:00' });
  const r = proposeResolution(n, e, [asRecurring(e)]);
  show('covers', r);
  expect('classified as covers_existing', r.kind, 'covers_existing');
  expect('offers NO crop (nothing left to crop)', r.options.some((o) => o.kind === 'crop_existing'), false);
  expect('offers moving the new one', r.options.some((o) => o.kind === 'move_new'), true);
  expect('offers cancel', r.options.some((o) => o.kind === 'cancel'), true);
}

console.log('\n=== SCENARIO 4: new covers existing head ===');
{
  const e = existing({ start_time: '01:00', end_time: '04:00' });
  const n = mk({ start_time: '00:30', end_time: '02:00' });
  const r = proposeResolution(n, e, [asRecurring(e)]);
  show('head', r);
  expect('classified as existing_head', r.kind, 'existing_head');
  const crop = r.options.find((o) => o.kind === 'crop_existing') as any;
  expect('keeps the tail 02:00-04:00', [crop.start, crop.end], ['02:00', '04:00']);
}

console.log('\n=== SCENARIO 5: exhaustive no-garbage sweep ===');
{
  // Every overlapping pair must yield only valid, non-degenerate blocks.
  let pairs = 0, bad = 0;
  for (let es = 0; es < 24 * 4; es += 7) {
    for (let ee = es + 15; ee <= 24 * 60; ee += 23) {
      for (let ns = 0; ns < 24 * 4; ns += 7) {
        for (let ne = ns + 15; ne <= 24 * 60; ne += 23) {
          if (!(ns < ee && ne > es)) continue;
          pairs++;
          const e = existing({ start_time: `${String(Math.floor(es / 60)).padStart(2, '0')}:${String(es % 60).padStart(2, '0')}`,
                               end_time: `${String(Math.floor(ee / 60)).padStart(2, '0')}:${String(ee % 60).padStart(2, '0')}` });
          const n = mk({ start_time: `${String(Math.floor(ns / 60)).padStart(2, '0')}:${String(ns % 60).padStart(2, '0')}`,
                         end_time: `${String(Math.floor(ne / 60)).padStart(2, '0')}:${String(ne % 60).padStart(2, '0')}` });
          const r = proposeResolution(n, e, [asRecurring(e)]);
          for (const o of r.options) {
            const segs = o.kind === 'split_existing' ? o.segments
                       : o.kind === 'crop_existing' ? [{ start: o.start, end: o.end }] : [];
            for (const sg of segs) {
              const a = timeToMinutes(sg.start), b = timeToMinutes(sg.end);
              if (!(b > a)) { bad++; if (bad < 4) console.log(`  degenerate ${sg.start}-${sg.end} :: E ${e.start_time}-${e.end_time} N ${n.start_time}-${n.end_time} kind=${o.kind}`); }
              // surviving block must stay inside the original
              if (a < timeToMinutes(e.start_time) || b > timeToMinutes(e.end_time)) { bad++; if (bad < 4) console.log(`  out-of-bounds ${sg.start}-${sg.end} :: E ${e.start_time}-${e.end_time}`); }
              // and must not overlap the new schedule
              if (a < timeToMinutes(n.end_time) && b > timeToMinutes(n.start_time)) { bad++; if (bad < 4) console.log(`  still overlaps N ${sg.start}-${sg.end} :: E ${e.start_time}-${e.end_time} N ${n.start_time}-${n.end_time}`); }
            }
            if (o.kind === 'move_new') {
              const a = timeToMinutes(o.start), b = timeToMinutes(o.end);
              if (b - a !== ne - ns) { bad++; console.log('  move_new changed duration'); }
              if (a < timeToMinutes(e.end_time) && b > timeToMinutes(e.start_time)) { bad++; console.log('  move_new still overlaps'); }
            }
          }
        }
      }
    }
  }
  console.log(`  checked ${pairs} overlapping pairs`);
  expect('no degenerate / out-of-bounds / still-overlapping results', bad, 0);
}

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
