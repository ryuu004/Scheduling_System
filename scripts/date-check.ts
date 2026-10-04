/**
 * Demonstrates the UTC-vs-local date bug at the 00:00-08:00 window for UTC+08:00,
 * which is when the reported "date is behind by 1 day" symptom occurs.
 */
import { getLocalDateStr } from '../src/lib/date';

const TZ = 'Asia/Kuala_Lumpur'; // UTC+08:00, no DST

function bothWays(isoUtc: string) {
  const d = new Date(isoUtc);
  return {
    at: d.toLocaleString('en-GB', { timeZone: TZ }),
    buggy: d.toISOString().split('T')[0],
    fixed: getLocalDateStr(d),
  };
}

console.log(`Timezone under test: ${TZ} (UTC+08:00)\n`);

const samples = [
  '2026-10-04T16:30:00Z', // 00:30 local Oct 5  <- the reported symptom
  '2026-10-04T17:12:00Z', // 01:12 local Oct 5  <- current time
  '2026-10-04T23:59:00Z', // 07:59 local Oct 5  <- last buggy minute
  '2026-10-05T00:00:00Z', // 08:00 local Oct 5  <- boundary, now safe
  '2026-10-04T12:00:00Z', // 20:00 local Oct 4  <- outside the window
];

let fixes = 0;
for (const s of samples) {
  const r = bothWays(s);
  const wrong = r.buggy !== r.fixed;
  if (wrong) fixes++;
  console.log(
    `  local ${r.at.padEnd(18)} buggy=${r.buggy}  fixed=${r.fixed}  ${wrong ? '<-- was WRONG' : 'ok'}`
  );
}

console.log(`\n${fixes} of ${samples.length} samples were wrong before the fix.`);

// The invariant that matters: for any instant, getLocalDateStr must equal the
// calendar date a user in TZ would read off a clock.
console.log('\nInvariant check over 48 consecutive hours:');
let violations = 0;
for (let h = 0; h < 48; h++) {
  const d = new Date(Date.UTC(2026, 9, 4, 0, 0, 0) + h * 3600_000);
  const expected = d.toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
  if (getLocalDateStr(d) !== expected) {
    violations++;
    console.log(`  MISMATCH at ${d.toISOString()}: ${getLocalDateStr(d)} != ${expected}`);
  }
}
console.log(
  violations === 0
    ? '  getLocalDateStr matches the local calendar date in all 48 cases.'
    : `  ${violations} violations`
);
process.exit(violations === 0 ? 0 : 1);