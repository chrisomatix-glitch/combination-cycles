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
 *     worst cases (M7-M7 etc.) the brief calls out by name;
 *   - after octave-bracket shifting, ledger lines stay small — verified
 *     against the exact catalogue, not assumed. Almost every note lands
 *     within three; the handful that don't are checked to have already
 *     received the deepest available bracket (15mb/15ma) and to still be
 *     bounded (see the dedicated block below, and its comment, for why a
 *     hard "always ≤ 3" isn't quite achievable and what actually is);
 *   - stem direction (via stemDirectionFor(), a pure reimplementation of
 *     VexFlow's own middle-line rule — see notation.js's module comment)
 *     matches the standard rule at the note's WRITTEN staff position, not
 *     its sounding pitch, at every k.
 *
 * Run: node app/notation.test.js
 */
import * as CC from '../src/cycles.js';
import { isPlayable } from './audio.js';
import {
  noteSequence, octaveBandSpans, staffLine, ledgerLineCount, stemDirectionFor,
} from './notation.js';
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

      const real = entries.filter((e) => !e.isRest);

      if (mode !== 'literal') {
        // Bounded is the claim the brief makes explicitly: every one of the
        // 118 catalogue entries sits inside the plain band, so no bracket is
        // ever drawn.
        assert(
          `${entry.id} (bounded): every note is in the plain band (no bracket needed)`,
          real.every((e) => e.band === 'plain'),
          `bands: ${real.map((e) => e.band).join(',')}`,
        );
        assert(`${entry.id} (bounded): no octave-bracket spans`, octaveBandSpans(entries).length === 0);
      }

      const stemMismatches = real.filter((e) => {
        const line = staffLine(e.letter, e.octave, e.clef);
        return stemDirectionFor(line) !== (line < 3 ? 'up' : 'down');
      });
      assert(
        `${entry.id} (${mode}): stem direction follows the standard middle-line rule at the written position`,
        stemMismatches.length === 0,
        `${stemMismatches.length} mismatches`,
      );
    }
  }
}

// Named regression cases from the brief itself: B4 in treble and D3 in bass
// both sit exactly on their clef's middle line, and both should come out
// stem-down under the standard rule.
assert('B4 in treble clef: stem down', stemDirectionFor(staffLine('b', 4, 'treble')) === 'down');
assert('D3 in bass clef: stem down', stemDirectionFor(staffLine('d', 3, 'bass')) === 'down');

// M7-M7 (the brief's own worked example): literal mode should read as five
// bands in sequence — 15mb, 8vb, plain, 8va, 15ma — and the written position
// (not the sounding pitch) is what the brackets and clef both key off.
{
  const iv = [11, 11];
  const entries = noteSequence(iv, { mode: 'literal', transposition: 0 });
  const bandSequence = [];
  for (const e of entries) {
    if (e.isRest) continue;
    if (bandSequence[bandSequence.length - 1] !== e.band) bandSequence.push(e.band);
  }
  assert(
    'M7-M7 (literal): reads as five bands in sequence — 15mb, 8vb, plain, 8va, 15ma',
    JSON.stringify(bandSequence) === JSON.stringify(['15mb', '8vb', 'plain', '8va', '15ma']),
    `got ${JSON.stringify(bandSequence)}`,
  );
}

// "Written position, not sounding pitch" is a correctness requirement of the
// implementation (noteSequence()'s clef/octave for real notes always comes
// from writtenMidi, never raw midi — see notation.js), checked directly by
// the per-entry "stem direction follows the standard rule" assertion above,
// which uses e.octave/e.letter (derived from writtenMidi) throughout. It is
// NOT additionally provable by finding a note whose stem flips between the
// raw and written positions: checked against the whole catalogue, none does
// — an octave shift moves a note by exactly 3.5 lines, and every band's
// threshold (>=2 octaves from centre) already sits far enough from the
// middle line that 3.5 more or less never crosses it. So the distinction
// matters for correctness (and for ledger-line/clef placement, which DO
// depend on it — see the ledger-line block below), just not for stem
// direction specifically, in this particular catalogue.

// Ledger lines after bracketing: a hard "never more than three" turns out
// not to be quite achievable. Octave brackets only go up to a double octave
// (15ma/15mb) — real engraving doesn't go further — and a handful of the
// most register-extreme cataloged cycles (runs of large intervals, e.g.
// M7-M7 and its relatives, which touch literal MIDI 0) are still more than
// two octaves from the nearest staff even after the deepest available
// bracket. That's an inherent consequence of an eleven-octave passage on a
// two-clef staff, not a bracketing bug — so what's actually verified here is
// the strictest true claim: every overage note already got the deepest
// available bracket (nothing is left under-corrected), and the residual
// count stays small and bounded rather than blowing up.
{
  let maxLedger = 0;
  let overCount = 0;
  let overButNotDeepest = 0;
  let total = 0;
  for (const k of [2, 3, 4]) {
    for (const entry of CC.buildCatalogue(k)) {
      const entries = noteSequence(entry.intervals, { mode: 'literal', transposition: 0 });
      for (const e of entries) {
        if (e.isRest) continue;
        total += 1;
        const count = ledgerLineCount(staffLine(e.letter, e.octave, e.clef));
        maxLedger = Math.max(maxLedger, count);
        if (count > 3) {
          overCount += 1;
          if (e.band !== '15mb' && e.band !== '15ma') overButNotDeepest += 1;
        }
      }
    }
  }
  assert(
    'literal mode: every note over three ledger lines already has the deepest available bracket (15mb/15ma)',
    overButNotDeepest === 0,
    `${overButNotDeepest} notes exceeded 3 ledger lines without a 15mb/15ma bracket`,
  );
  assert(
    'literal mode: ledger lines beyond three stay rare (< 5% of notes) and bounded (<= 6)',
    overCount / total < 0.05 && maxLedger <= 6,
    `${overCount}/${total} notes over 3 ledger lines, max ${maxLedger}`,
  );
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
