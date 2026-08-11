/**
 * Regression test for the Phase 3.1 literal-mode re-centring in
 * app/register.js — the exact invariant that was silently broken when
 * notation.js called CC.placeRegister() directly and skipped it, and that
 * notation.test.js's own previous version couldn't catch because it
 * compared against CC.placeRegister() too (see notation.test.js's comment).
 * This file checks registeredNotes() against CC.placeRegister() directly,
 * so it doesn't share that blind spot.
 *
 * Run: node app/register.test.js
 */
import * as CC from '../src/cycles.js';
import { registeredNotes } from './register.js';

let pass = 0; let fail = 0;
const results = [];
function assert(name, cond, detail = '') {
  cond ? pass++ : fail++;
  results.push({ ok: !!cond, name, detail });
}

// Bounded is CC.placeRegister() unchanged — no re-centring applies.
for (const k of [2, 3, 4, 6]) {
  for (const entry of CC.buildCatalogue(k)) {
    const expected = CC.placeRegister(entry.intervals, { mode: 'bounded', closeCycle: true });
    const actual = registeredNotes(entry.intervals, { mode: 'bounded' });
    assert(
      `${entry.id}: bounded registeredNotes passes through placeRegister unchanged`,
      JSON.stringify(actual) === JSON.stringify(expected),
    );
  }
}

// Literal: registeredNotes() must re-centre the raw ascending realisation so
// its midpoint lands within half an octave of middle C (60) — the guarantee
// that makes "up to eleven octaves" span roughly evenly either side of the
// centre, rather than starting at 60 and only ever climbing.
let recentredCount = 0;
for (const k of [2, 3, 4, 6]) {
  for (const entry of CC.buildCatalogue(k)) {
    const raw = CC.placeRegister(entry.intervals, { mode: 'literal', closeCycle: true });
    const actual = registeredNotes(entry.intervals, { mode: 'literal' });

    const midpoint = (Math.max(...actual) + Math.min(...actual)) / 2;
    assert(
      `${entry.id}: literal registeredNotes is centred within half an octave of middle C`,
      Math.abs(midpoint - 60) <= 6,
      `midpoint ${midpoint}`,
    );

    // The only legal transform is a whole-octave shift (preserves the
    // interval pattern) applied uniformly to every note.
    const diffs = new Set(actual.map((n, i) => n - raw[i]));
    assert(
      `${entry.id}: literal re-centring is a single whole-octave shift applied to every note`,
      diffs.size === 1 && [...diffs][0] % 12 === 0,
      `diffs: ${[...diffs].join(',')}`,
    );

    if ([...diffs][0] !== 0) recentredCount += 1;
  }
}

// The concrete regression case named in the bug report: M7-M7 used to
// notate at MIDI 60-192 while sounding at 0-132 (raw placeRegister's
// midpoint is nowhere near 60 for this cycle) — prove registeredNotes()
// actually moves it, not just that the formula exists.
{
  const iv = [11, 11]; // M7-M7
  const raw = CC.placeRegister(iv, { mode: 'literal', closeCycle: true });
  const actual = registeredNotes(iv, { mode: 'literal' });
  const rawMid = (Math.max(...raw) + Math.min(...raw)) / 2;
  const actualMid = (Math.max(...actual) + Math.min(...actual)) / 2;
  assert('M7-M7 literal: raw placeRegister is NOT centred near middle C (this is the bug case)', Math.abs(rawMid - 60) > 6, `raw midpoint ${rawMid}`);
  assert('M7-M7 literal: registeredNotes IS centred near middle C', Math.abs(actualMid - 60) <= 6, `actual midpoint ${actualMid}`);
}

assert('at least one catalogue entry actually needed re-centring (else the fix is untested)', recentredCount > 0, `${recentredCount} entries re-centred`);

console.log(`\n${pass} passed, ${fail} failed\n`);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  for (const f of failed.slice(0, 20)) console.log(`  FAIL  ${f.name}\n        ${f.detail}`);
  if (failed.length > 20) console.log(`  ... and ${failed.length - 20} more`);
  process.exit(1);
} else {
  console.log('  Literal-mode re-centring keeps every cycle within half an octave of middle C.\n');
}
