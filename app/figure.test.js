/**
 * Figure test (SPEC.md's Phase 4 brief, acceptance criterion 7): proves
 * against the engine, using app/figure.js's own functions rather than a
 * separate reimplementation, that:
 *
 *   - the circle-of-fifths figure — the closed loop of twelve chords a cycle
 *     draws on a fixed circle-of-fifths layout — is shared by exactly two of
 *     the ordered forms at every k, giving exactly half as many distinct
 *     figures: 6 at k=2, 32 at k=3, 162 at k=4, 1920 at k=6, and the other
 *     form sharing a figure is always the one already recorded as
 *     retrogradeOf on the catalogue entry — that's the fact the interface
 *     surfaces as "this figure is also drawn by ...";
 *   - inverting a cycle draws the identical figure — reflection-symmetric —
 *     for exactly 4 of 12 forms at k=2, 16 of 64 at k=3, 12 of 324 at k=4,
 *     64 of 3840 at k=6.
 *
 * Run: node app/figure.test.js
 */
import * as CC from '../src/cycles.js';
import { figureSignature, isReflectionSymmetric } from './figure.js';

let pass = 0; let fail = 0;
const results = [];
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  ok ? pass++ : fail++;
  results.push({ ok, name, detail: ok ? '' : `got ${a}, expected ${e}` });
}
function assert(name, cond, detail = '') {
  cond ? pass++ : fail++;
  results.push({ ok: !!cond, name, detail });
}

const EXPECTED_FIGURES = {
  2: 6, 3: 32, 4: 162, 6: 1920,
};
const EXPECTED_SYMMETRIC = {
  2: 4, 3: 16, 4: 12, 6: 64,
};

for (const k of [2, 3, 4, 6]) {
  const all = CC.allCycles(k);
  const cat = CC.buildCatalogue(k);

  const byFigure = new Map();
  for (const iv of all) {
    const sig = figureSignature(iv);
    if (!byFigure.has(sig)) byFigure.set(sig, []);
    byFigure.get(sig).push(iv);
  }

  check(`k=${k}: distinct figures`, byFigure.size, EXPECTED_FIGURES[k]);

  let wrongSize = 0;
  let sameEntry = 0;
  let properRetroPairs = 0;
  let mismatches = 0;

  for (const forms of byFigure.values()) {
    if (forms.length !== 2) { wrongSize += 1; continue; }
    const [e1, e2] = forms.map((iv) => CC.identify(iv, cat));
    if (e1.id === e2.id) { sameEntry += 1; continue; }
    const linked = e1.retrogradeOf === e2.id || e2.retrogradeOf === e1.id;
    if (linked) properRetroPairs += 1; else mismatches += 1;
  }

  assert(`k=${k}: every figure is shared by exactly two forms`,
    wrongSize === 0, `${wrongSize} figures with size != 2`);
  assert(`k=${k}: no figure is shared by two rotations of the same catalogue entry`,
    sameEntry === 0, `${sameEntry} same-entry collisions`);
  assert(`k=${k}: every figure-sharing pair is exactly a retrogradeOf link`,
    mismatches === 0, `${mismatches} mismatches`);
  check(`k=${k}: figure-sharing pairs that are proper retrograde links`,
    properRetroPairs, byFigure.size);

  const symmetricCount = all.filter((iv) => isReflectionSymmetric(iv)).length;
  check(`k=${k}: forms whose figure is reflection-symmetric under inversion`,
    symmetricCount, EXPECTED_SYMMETRIC[k]);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  for (const f of failed) console.log(`  FAIL  ${f.name}\n        ${f.detail}`);
  process.exit(1);
} else {
  console.log('  Every figure is shared by exactly two forms, and the partner is always retrogradeOf.\n');
}
