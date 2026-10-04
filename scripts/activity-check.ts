import { validateActualRange, validateActualStart, isValidTimeStr, timeToMinutes, minutesToTime } from '../src/lib/activity';

let failures = 0;
const expect = (label: string, actual: unknown, wanted: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(wanted);
  if (!ok) { failures++; console.log(`  FAIL ${label}: got ${JSON.stringify(actual)} want ${JSON.stringify(wanted)}`); }
  else console.log(`  ok   ${label}`);
};

console.log('=== time format acceptance (DB returns HH:MM:SS, inputs give HH:MM) ===');
expect('HH:MM accepted', isValidTimeStr('11:30'), true);
expect('HH:MM:SS accepted', isValidTimeStr('13:00:00'), true);
expect('garbage rejected', isValidTimeStr('abc'), false);
expect('25:00 rejected', isValidTimeStr('25:00'), false);
expect('empty rejected', isValidTimeStr(''), false);

console.log('\n=== starting a FUTURE block early (the reported scenario) ===');
{
  // breakfast 12:00-13:00, user says they began at 11:30
  const plannedEnd = '13:00:00';
  expect('11:30 before 13:00 valid', validateActualStart('11:30', plannedEnd).ok, true);
  expect('23:00 after planned end rejected', validateActualStart('23:00', plannedEnd).ok, false);
  const bad = validateActualStart('23:00', plannedEnd);
  expect('  with clear message', bad.message?.includes('after the planned end'), true);
  expect('  not the confusing range message', bad.message !== 'Start must be earlier than end.', true);
  expect('garbage rejected', validateActualStart('nope', plannedEnd).ok, false);
  expect('no planned end = no guard', validateActualStart('23:00', null).ok, true);
}

console.log('\n=== DB-format end time works end-to-end ===');
{
  expect('accepts DB seconds format', validateActualRange('11:30', '13:00:00', '13:00:00').ok, true);
  expect('accepts DB seconds format in start-only', validateActualStart('11:30', '13:00:00').ok, true);
}

console.log('\n=== no inverted ranges across the valid day (00:00-23:59) ===');
{
  let bad = 0;
  for (let s = 0; s < 24 * 60; s += 7) {
    for (let e = s + 1; e < 24 * 60; e += 11) {
      const res = validateActualRange(minutesToTime(s), minutesToTime(e));
      if (!res.ok) { bad++; if (bad < 3) console.log('  unexpected reject', minutesToTime(s), minutesToTime(e)); }
    }
  }
  expect('all valid start<end ranges accepted', bad, 0);
}

console.log('\n=== planned-end guard ===');
{
  // starting before planned end is fine even if after planned start
  expect('inside window ok', validateActualRange('12:30', '13:00', '13:00').ok, true);
  expect('exactly at planned end ok', validateActualRange('13:00', '14:00', '13:00').ok, true);
  expect('after planned end rejected', validateActualRange('13:01', '14:00', '13:00').ok, false);
  expect('no planned end = no guard', validateActualRange('23:00', '23:59', null).ok, true);
}

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
