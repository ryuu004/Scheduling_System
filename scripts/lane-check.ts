/**
 * Lane layout for overlapping timeline blocks.
 *
 * Mirrors layoutLanes() in src/components/Timeline.tsx. Overlapping blocks must
 * land in different lanes; if two overlap share a lane they render on top of
 * each other and one becomes invisible.
 */

type Block = { id: string; start: number; end: number };

function layoutLanes(blocks: Block[]) {
  const items = [...blocks].sort((a, b) => a.start - b.start || a.end - b.end);
  const laneEnds: number[] = [];
  const placed = items.map((item) => {
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

let failures = 0;
const expect = (label: string, actual: unknown, wanted: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(wanted);
  if (!ok) { failures++; console.log(`  FAIL ${label}: got ${JSON.stringify(actual)} want ${JSON.stringify(wanted)}`); }
  else console.log(`  ok   ${label}`);
};

const overlaps = (a: Block, b: Block) => a.start < b.end && b.start < a.end;

console.log('=== the reported scenario: programming 1:45-3:00 + lecture 2:20-3:15 ===');
{
  const { placed, totalLanes } = layoutLanes([
    { id: 'prog', start: 105, end: 180 },
    { id: 'lecture', start: 140, end: 195 },
  ]);
  expect('two lanes needed', totalLanes, 2);
  expect('different lanes', placed[0].lane !== placed[1].lane, true);
}

console.log('\n=== single block occupies one lane ===');
{
  const { totalLanes } = layoutLanes([{ id: 'a', start: 60, end: 120 }]);
  expect('one lane', totalLanes, 1);
}

console.log('\n=== touching blocks share a lane (no overlap) ===');
{
  const { totalLanes } = layoutLanes([
    { id: 'a', start: 60, end: 120 },
    { id: 'b', start: 120, end: 180 },
  ]);
  expect('sequential blocks reuse lane', totalLanes, 1);
}

console.log('\n=== containment forces a second lane ===');
{
  const { totalLanes, placed } = layoutLanes([
    { id: 'outer', start: 60, end: 240 },
    { id: 'inner', start: 90, end: 120 },
  ]);
  expect('nested needs two lanes', totalLanes, 2);
  expect('nested blocks differ', placed[0].lane !== placed[1].lane, true);
}

console.log('\n=== EXHAUSTIVE: overlapping blocks never share a lane ===');
{
  let bad = 0;
  let cases = 0;
  const blocks: Block[] = [];
  for (let i = 0; i < 12; i++) {
    blocks.push({ id: `b${i}`, start: (i * 37) % 600, end: ((i * 37) % 600) + 40 + (i % 5) * 30 });
  }
  // sweep many subsets
  for (let mask = 1; mask < 2048; mask++) {
    const subset = blocks.filter((_, i) => mask & (1 << i));
    if (subset.length < 2) continue;
    cases++;
    const { placed } = layoutLanes(subset);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        if (overlaps(placed[i], placed[j]) && placed[i].lane === placed[j].lane) {
          bad++;
          if (bad < 4) console.log(`  collision: ${placed[i].id} & ${placed[j].id} both lane ${placed[i].lane}`);
        }
      }
    }
  }
  console.log(`  swept ${cases} subsets`);
  expect('overlapping blocks always separated', bad, 0);
}

console.log('\n=== EXHAUSTIVE: lane count never exceeds number of blocks ===');
{
  let bad = 0;
  const blocks: Block[] = [];
  for (let i = 0; i < 10; i++) {
    blocks.push({ id: `b${i}`, start: (i * 53) % 700, end: ((i * 53) % 700) + 60 + (i % 4) * 25 });
  }
  for (let mask = 1; mask < 1024; mask++) {
    const subset = blocks.filter((_, i) => mask & (1 << i));
    const { totalLanes, placed } = layoutLanes(subset);
    if (totalLanes > subset.length) { bad++; console.log('  too many lanes', totalLanes, subset.length); }
    const maxLane = Math.max(...placed.map((p) => p.lane));
    if (maxLane >= totalLanes) { bad++; console.log('  lane index out of range'); }
  }
  expect('lane indices always in range', bad, 0);
}

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);