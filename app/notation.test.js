/**
 * Regression test for notation.js against the frozen engine (Phase 5's
 * brief, acceptance criteria 3 and 5), for every catalogue entry at every
 * k in {2, 3, 4} and both register modes:
 *
 *   - the MIDI numbers notation draws are exactly registeredNotes(iv,
 *     {mode, transposition}) — the same shared function audio.js's
 *     play-through and click handling call — so the staff and play-through
 *     agree note for note, not just by eye. This is deliberately NOT
 *     compared against CC.placeRegister() directly: an earlier version of
 *     this test did exactly that, which is precisely why it passed 944/944
 *     while notation and audio actually disagreed on literal mode's
 *     register for 115 of 118 cycles — CC.placeRegister() skips the Phase
 *     3.1 re-centring registeredNotes() applies, so comparing against it
 *     was comparing notation to the wrong ground truth;
 *   - a note is a rest if and only if Audio.isPlayable() says it's out of
 *     range, reusing audio's own rule rather than a second definition of
 *     "out of range" that could drift from it;
 *   - every spelled accidental is '', '#' or 'b' — never a double sharp or
 *     flat — proving CC.spell's fixed mode really does avoid them
 *     structurally (SPEC.md §4), across the whole catalogue, not just the
 *     worst cases (M7-M7 etc.) the brief calls out by name.
 *
 * Run: node app/notation.test.js
 */
import * as CC from '../src/cycles.js';
import { isPlayable } from './audio.js';
import { noteSequence } from './notation.js';
import { registeredNotes } from './register.js';

let pass = 0; let fail = 0;
const results = [];
function assert(name, cond, detail = '') {
  cond ? pass++ : fail++;
  results.push({ ok: !!cond, name, detail });
}

let checked = 0;

for (const k of [2, 3, 4]) {
  const catalogue = CC.buildCatalogue(k);
  for (const entry of catalogue) {
    for (const mode of ['bounded', 'literal']) {
      const entries = noteSequence(entry.intervals, { mode, transposition: 0 });
      checked += 1;

      const expectedMidi = registeredNotes(entry.intervals, { mode, transposition: 0 });
      assert(
        `${entry.id} (${mode}): notation MIDI matches registeredNotes (audio's own source) exactly`,
        JSON.stringify(entries.map((e) => e.midi)) === JSON.stringify(expectedMidi),
        `got ${JSON.stringify(entries.map((e) => e.midi))}, expected ${JSON.stringify(expectedMidi)}`,
      );

      const restMismatches = entries.filter((e) => e.isRest !== !isPlayable(e.midi));
      assert(
        `${entry.id} (${mode}): isRest matches Audio.isPlayable exactly`,
        restMismatches.length === 0,
        `${restMismatches.length} mismatches`,
      );

      const badAccidentals = entries.filter((e) => !['', '#', 'b'].includes(e.accidental));
      assert(
        `${entry.id} (${mode}): every accidental is '', '#' or 'b'`,
        badAccidentals.length === 0,
        `found: ${badAccidentals.map((e) => e.accidental).join(',')}`,
      );

      assert(`${entry.id} (${mode}): exactly thirteen notes`, entries.length === 13, `got ${entries.length}`);
    }
  }
}

console.log(`\n${pass} passed, ${fail} failed (${checked} catalogue entry/mode combinations checked)\n`);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  for (const f of failed.slice(0, 20)) console.log(`  FAIL  ${f.name}\n        ${f.detail}`);
  if (failed.length > 20) console.log(`  ... and ${failed.length - 20} more`);
  process.exit(1);
} else {
  console.log('  Notation matches audio note-for-note, and spelling never needs a double accidental.\n');
}
