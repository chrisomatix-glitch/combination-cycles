/**
 * register.js — the actual register-placed sequence, one level above
 * CC.placeRegister(). This is the single source of truth for "which MIDI
 * notes does this cycle sound at" — audio.js's play-through and click
 * handling and notation.js's staff both call registeredNotes() and nothing
 * else, so they cannot disagree about what plays vs. what's drawn.
 *
 * (They used to: index.html defined this logic locally for audio, and
 * notation.js called CC.placeRegister() directly, skipping the re-centring
 * below — the two disagreed on literal mode's register for 115 of 118
 * cycles, e.g. M7-M7 sounding at MIDI 0-132 while notated at 60-192. Moving
 * the calculation out of the page and into one shared module both views
 * import is what makes that class of bug structurally impossible now,
 * rather than a discipline someone has to remember to keep in sync.)
 *
 * Indices 0-11 line up with circle slots; index 12 is the closing
 * return-to-start note (SPEC.md's Phase 3.1 brief).
 *
 * Bounded is CC.placeRegister() unchanged. Literal anchors its first note at
 * the centre and only climbs from there (never resetting), so a five-to-
 * seven-octave cycle ends up almost entirely above the centre — re-centre
 * the whole realisation by whole octaves on its own midpoint instead, which
 * is the only shift that preserves the interval pattern.
 */
import * as CC from '../src/cycles.js';

export function registeredNotes(intervals, { mode = 'bounded', transposition = 0 } = {}) {
  const raw = CC.placeRegister(intervals, { mode, transposition, closeCycle: true });
  if (mode !== 'literal') return raw;
  const mid = (Math.max(...raw) + Math.min(...raw)) / 2;
  const offset = Math.round((60 - mid) / 12) * 12;
  return raw.map((n) => n + offset);
}
