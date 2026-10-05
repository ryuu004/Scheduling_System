/**
 * Seed realistic multi-day activity data for verifying the analytics view.
 * Not part of the app; run manually then clean up.
 */
const KEY = process.argv[2];
const BASE = 'https://lyvdtussfdwfuscbdzrr.supabase.co/rest/v1';
const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (mins: number) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
const dateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const j = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: H });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
};

const main = async () => {
  // clear prior seed
  for (const t of ['programming', 'Gym', 'Reading']) {
    await j(`/activity_logs?title=eq.${t}`, { method: 'DELETE' });
  }

  const recurring = await j('/recurring_schedules?select=id,title');
  const prog = recurring.find((r) => r.title === 'programming')?.id;
  if (!prog) throw new Error('programming recurring rule not found');

  const rows = [];
  for (let d = 9; d >= 0; d--) {
    const date = dateStr(new Date(Date.now() - d * 86400000));
    const plannedStart = 9 * 60 + d * 4;
    const late = d % 3 === 0 ? 25 : 0;
    const actualStart = Math.min(plannedStart + late, 22 * 60);
    const actualEnd = Math.min(actualStart + 120 + (d % 4) * 15, 23 * 60);

    rows.push({
      title: 'programming',
      planned_date: date,
      planned_start_time: hhmm(plannedStart),
      planned_end_time: hhmm(plannedStart + 120),
      actual_start_time: hhmm(actualStart),
      actual_end_time: hhmm(actualEnd),
      status: 'completed',
      source: 'live',
      schedule_id: null,
      recurring_id: prog,
      occurrence_date: date,
    });

    rows.push({
      title: 'Gym',
      planned_date: date,
      planned_start_time: '17:00',
      planned_end_time: '18:00',
      actual_start_time: '17:10',
      actual_end_time: '18:05',
      status: 'completed',
      source: 'live',
      schedule_id: null,
      recurring_id: null,
      occurrence_date: date,
    });

    if (d % 4 === 0) {
      rows.push({
        title: 'Reading',
        planned_date: date,
        planned_start_time: null,
        planned_end_time: null,
        actual_start_time: '21:00',
        actual_end_time: '21:50',
        status: 'completed',
        source: 'capture',
        schedule_id: null,
        recurring_id: null,
        occurrence_date: date,
      });
    }
  }

  const created = await j('/activity_logs', {
    method: 'POST',
    body: JSON.stringify(rows),
  });
  console.log(`inserted ${created.length} logs (recurring_id=${prog})`);
};

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});