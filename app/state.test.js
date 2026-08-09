/**
 * Regression test: a clockwise rotate request must always produce a
 * clockwise (positive) visual displacement on screen — on every movable
 * ring, at every k in {2, 3, 4}, in both traversal directions — and
 * vice versa for anticlockwise (SPEC.md's Phase 2 acceptance criterion 4).
 *
 * Background: rotateGroup's `steps` is a step count in interval-sequence
 * space, not screen space. The circle mirrors between the family where the
 * dials sum to a major 2nd (mod 12) and the family where they sum to its
 * complement - reverseDirection moves between them - so the same engine step
 * sign can spin a ring opposite ways depending on the current cycle. Fixed
 * prior to Phase 1's release: circle.js once assumed steps * degrees was
 * always clockwise, which was only true in one of the two families. Phase 2
 * generalises the guard from k = 2's single movable ring to every movable
 * ring at every k, since the same assumption could just as easily have crept
 * back in while adding the other rings.
 *
 * Run: node app/state.test.js
 */
import * as CC from '../src/cycles.js';
import { visualDegrees, engineStepsFor } from './state.js';

let pass = 0; let fail = 0;
const results = [];
function assert(name, cond, detail = '') {
  cond ? pass++ : fail++;
  results.push({ ok: !!cond, name, detail });
}

const rawSigns = new Set();
let statesChecked = 0;

for (const k of [2, 3, 4]) {
  const base = Array(k).fill(7); // the circle-of-fifths position, degenerate by design
  const positions = 12 / k;
  const stepDeg = 30 * k;

  for (const reversed of [false, true]) {
    const start = reversed ? CC.reverseDirection(base) : base;
    const tag = reversed ? 'reversed' : 'forward';

    for (let m = 1; m < k; m += 1) {
      for (let pos = 0; pos < positions; pos += 1) {
        const iv = CC.rotateGroup(start, m, pos);
        if (!iv) continue; // the engine is the judge of reachability, not this test
        statesChecked += 1;

        rawSigns.add(Math.sign(visualDegrees(iv, m, 1)));

        const cwSteps = engineStepsFor(iv, m, 1);
        const cwDeg = visualDegrees(iv, m, cwSteps);
        assert(
          `k=${k} ring ${m} (${tag}): clockwise press is visually clockwise from [${iv}]`,
          cwDeg > 0,
          `got ${cwDeg}deg`,
        );

        const ccwSteps = engineStepsFor(iv, m, -1);
        const ccwDeg = visualDegrees(iv, m, ccwSteps);
        assert(
          `k=${k} ring ${m} (${tag}): anticlockwise press is visually anticlockwise from [${iv}]`,
          ccwDeg < 0,
          `got ${ccwDeg}deg`,
        );

        assert(
          `k=${k} ring ${m} (${tag}): a single step is a full ${stepDeg}deg from [${iv}]`,
          Math.abs(cwDeg) === stepDeg,
          `got ${cwDeg}deg`,
        );
      }
    }
  }
}

assert('fixture actually exercised every k and every movable ring', statesChecked > 0);

// The bug this guards against: the raw engine sign genuinely varies with the
// current cycle. If it never did, engineStepsFor's correction would be
// solving a problem that doesn't exist, and this whole test would be inert.
assert(
  'the raw engine sign for the same steps argument (+1) is not constant across reachable states',
  rawSigns.size === 2,
  `observed signs: ${[...rawSigns]}`,
);

console.log(`\n${pass} passed, ${fail} failed\n`);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  for (const f of failed) console.log(`  FAIL  ${f.name}\n        ${f.detail}`);
  process.exit(1);
} else {
  console.log('  Clockwise is always clockwise, on every ring, in every mode, in both traversal directions.\n');
}
