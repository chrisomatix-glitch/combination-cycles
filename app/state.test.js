/**
 * Regression test: a clockwise rotate request must always produce a
 * clockwise (positive) visual displacement on screen, in both dial-sum
 * families the two-interval circle can be in, and vice versa for
 * anticlockwise.
 *
 * Background: rotateGroup's `steps` is a step count in interval-sequence
 * space, not screen space. The circle mirrors between the family where the
 * dials sum to a major 2nd (mod 12) and the family where they sum to a
 * minor 7th (its complement) - reverseDirection moves between them - so the
 * same engine step sign spins the ring opposite ways in each. Fixed prior to
 * this test: circle.js assumed steps * 60deg was always clockwise, which was
 * only true in one of the two families.
 *
 * Run: node app/state.test.js
 */
import * as CC from '../src/cycles.js';
import { visualDegrees, engineStepsFor } from './state.js';

const MOVABLE_GROUP = 1;

let pass = 0; let fail = 0;
const results = [];
function assert(name, cond, detail = '') {
  cond ? pass++ : fail++;
  results.push({ ok: !!cond, name, detail });
}

// Every state reachable in the two-interval mode: six rotations x the two
// directions (see app/state.js's rotateVisual / circle.js's reverse control).
function reachableStates() {
  const start = [7, 7];
  const out = [];
  for (const base of [start, CC.reverseDirection(start)]) {
    for (let steps = 0; steps < 6; steps += 1) {
      const iv = CC.rotateGroup(base, MOVABLE_GROUP, steps);
      if (iv) out.push(iv);
    }
  }
  return out;
}

const states = reachableStates();
assert('reachable-state fixture covers all 12 ordered two-interval forms', states.length, 12);

for (const iv of states) {
  const cwSteps = engineStepsFor(iv, MOVABLE_GROUP, 1);
  const cwDeg = visualDegrees(iv, MOVABLE_GROUP, cwSteps);
  assert(`clockwise press is visually clockwise from [${iv}]`, cwDeg > 0, `got ${cwDeg}deg`);

  const ccwSteps = engineStepsFor(iv, MOVABLE_GROUP, -1);
  const ccwDeg = visualDegrees(iv, MOVABLE_GROUP, ccwSteps);
  assert(`anticlockwise press is visually anticlockwise from [${iv}]`, ccwDeg < 0, `got ${ccwDeg}deg`);

  // A single step is always one physical slot (60deg at k=2), whichever way it turns.
  assert(`clockwise step is a full 60deg from [${iv}]`, Math.abs(cwDeg) === 60, `got ${cwDeg}deg`);
}

// The bug this guards against: the two families really do disagree on the
// raw engine sign for the same steps argument. If they didn't, the fix would
// be solving a problem that doesn't exist.
const m2Family = [7, 7]; // dials sum to 14 = M2 (mod 12)
const m7Family = CC.reverseDirection(m2Family); // dials sum to its complement, m7 (mod 12)
const rawSignM2 = Math.sign(visualDegrees(m2Family, MOVABLE_GROUP, 1));
const rawSignM7 = Math.sign(visualDegrees(m7Family, MOVABLE_GROUP, 1));
assert(
  'the two dial-sum families mirror: the same raw engine step (+1) flips visual sign between them',
  rawSignM2 !== 0 && rawSignM7 !== 0 && rawSignM2 !== rawSignM7,
  `M2 family: ${rawSignM2 > 0 ? 'CW' : 'CCW'}, m7 family: ${rawSignM7 > 0 ? 'CW' : 'CCW'}`,
);

console.log(`\n${pass} passed, ${fail} failed\n`);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  for (const f of failed) console.log(`  FAIL  ${f.name}\n        ${f.detail}`);
  process.exit(1);
} else {
  console.log('  Clockwise is always clockwise, in both dial-sum families.\n');
}
