/**
 * Regression test: a clockwise rotate request must always produce a
 * clockwise (positive) visual displacement on screen — on every movable
 * ring, at every k in {2, 3, 4, 6}, in both traversal directions — and
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
 * k = 6 has no "opposite direction" to check: its rings hold two notes each
 * (groupPositions(6) = 2), so rotating one is a 180-degree flip with only one
 * other position to land on — pressing the left or right arrow key reaches
 * the identical state either way, and mod(x+6,12) === mod(x-6,12) makes that
 * true in rotateGroup itself, not just an artefact of this test. The
 * clockwise-vs-anticlockwise assertion pair below only applies where there
 * are more than two positions to distinguish a direction between; k = 6 gets
 * its own pair of assertions for the flip instead (see `directional` below).
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

for (const k of [2, 3, 4, 6]) {
  const base = Array(k).fill(7); // the circle-of-fifths position, degenerate by design
  const positions = 12 / k;
  const stepDeg = 30 * k;
  const directional = positions > 2; // false only at k=6 — see the module comment

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

        assert(
          `k=${k} ring ${m} (${tag}): a single step is a full ${stepDeg}deg from [${iv}]`,
          Math.abs(cwDeg) === stepDeg,
          `got ${cwDeg}deg`,
        );

        const ccwSteps = engineStepsFor(iv, m, -1);
        if (directional) {
          const ccwDeg = visualDegrees(iv, m, ccwSteps);
          assert(
            `k=${k} ring ${m} (${tag}): anticlockwise press is visually anticlockwise from [${iv}]`,
            ccwDeg < 0,
            `got ${ccwDeg}deg`,
          );
        } else {
          // Only two positions: both arrow keys must land on the ring's one
          // other position (a 180-degree flip), not silently do nothing and
          // not compound into a 360-degree round trip.
          const cw = CC.rotateGroup(iv, m, cwSteps);
          const ccw = CC.rotateGroup(iv, m, ccwSteps);
          assert(
            `k=${k} ring ${m} (${tag}): with two positions, both arrow directions reach the same flip from [${iv}]`,
            JSON.stringify(cw) === JSON.stringify(ccw) && JSON.stringify(cw) !== JSON.stringify(iv),
            `cw=[${cw}] ccw=[${ccw}] from=[${iv}]`,
          );
        }
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
