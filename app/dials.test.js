/**
 * Regression test for the dial-strip space budget Phase 5's brief published
 * as a design invariant: candidateIntervals(k) — the list every dial strip
 * renders one row per value of, in order — has exactly 6/8/9 entries at
 * k=2/3/4. That's what makes the vertical-strip layout markedly shorter at
 * k=4 (9 rows vs. the old grid's 12) and narrower at k=2/3, and it's a fact
 * about the engine's group structure (candidateIntervals excludes multiples
 * of k), not an arbitrary UI choice — worth pinning down so a future engine
 * change can't silently blow the layout's space budget.
 *
 * Run: node app/dials.test.js
 */
import * as CC from '../src/cycles.js';

let pass = 0; let fail = 0;
const results = [];
function check(name, actual, expected) {
  const ok = actual === expected;
  ok ? pass++ : fail++;
  results.push({ ok, name, detail: ok ? '' : `got ${actual}, expected ${expected}` });
}

const EXPECTED_ROWS = { 2: 6, 3: 8, 4: 9 };

for (const k of [2, 3, 4]) {
  check(`k=${k}: candidateIntervals row count`, CC.candidateIntervals(k).length, EXPECTED_ROWS[k]);
}

// Every dial strip at a given k renders the identical candidates list in the
// identical order — the fact that makes "same value, same height across
// strips" true without any manual row-matching in dials.js.
for (const k of [2, 3, 4]) {
  const candidates = CC.candidateIntervals(k);
  const sorted = [...candidates].sort((a, b) => a - b);
  check(`k=${k}: candidateIntervals is already in ascending order`, JSON.stringify(candidates), JSON.stringify(sorted));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  for (const f of failed) console.log(`  FAIL  ${f.name}\n        ${f.detail}`);
  process.exit(1);
} else {
  console.log('  The dial-strip space budget matches the engine at every k.\n');
}
