/**
 * notation.js — a VexFlow staff rendering of the current cycle, following the
 * Bounded/Literal register toggle note-for-note with what play-through
 * sounds (Phase 5's brief, acceptance criterion 3).
 *
 * VexFlow loads as a plain <script> tag from a CDN (index.html), same
 * pattern and same reasoning as Tone.js in audio.js: window.Vex may be
 * undefined if the CDN is blocked or offline, and since render() is wired
 * into the same renderAll() that drives every other view, a thrown error
 * here would take the whole interface down with it. draw() below checks for
 * window.Vex and degrades to a muted message rather than throwing.
 *
 * Thirteen notes, closing on the return to the starting pitch class — the
 * MIDI numbers come from register.js's registeredNotes(), the same shared
 * function audio.js's play-through and click handling call, so the staff
 * and playback agree note-for-note by construction: there is exactly one
 * place either view could get the register from, not two implementations
 * that have to be kept in sync by hand (see register.js's own comment for
 * the bug that shipped before this was true). "Out of range" reuses
 * Audio.isPlayable() for the same reason — a note the audio silently skips
 * is rendered here as a rest, not a fabricated pitch.
 *
 * Spelling is CC.spell(iv, {mode:'fixed'}) — the engine's conventional
 * circle-of-fifths spelling (one sharp, the rest flats), which is what makes
 * "no double accidentals" true by construction: fixed spelling only ever
 * emits '', a single sharp or a single flat (see PITCH_NAMES in cycles.js).
 * Contextual spelling was deliberately rejected (Phase 5's brief: 182/236
 * realisations would need double accidentals under it).
 *
 * Register bands and octave brackets: literal mode can wander up to eleven
 * octaves, which used to mean runs of ten-plus ledger lines. Instead, a note
 * far enough from the centre is WRITTEN one or two octaves closer in and
 * covered by an 8va/8vb/15ma/15mb bracket, exactly as real engraving does —
 * the note still SOUNDS at its real pitch (registeredNotes() is untouched),
 * only where it's drawn changes. Thresholds (fixed, not derived): below
 * MIDI 33 (A1) is 8vb, below 21 (A0) is 15mb; above 89 (F6) is 8va, above
 * 101 (F7) is 15ma; everything else is plain. Consecutive same-band notes
 * share one bracket (octaveBandSpans()); a rest always breaks a run, since
 * there's no pitch to notate an octave shift for. Bounded mode's notes all
 * land in the plain band by construction (verified across all 118 catalogue
 * entries — see app/notation.test.js), so this never fires there; nothing
 * here is mode-gated, it just naturally never triggers.
 *
 * Clef: bounded mode is about an octave, so one clef for the whole passage,
 * chosen to minimise ledger lines (now counted exactly via VexFlow's own
 * staff-line formula, not approximated — see staffLine()/ledgerLineCount()
 * below). Literal mode assigns each note its own clef by a fixed
 * treble/bass split at middle C, using its WRITTEN position (after any
 * octave-bracket shift), not the sounding pitch — VexFlow's StaveNote takes
 * a per-note `clef` independent of the stave's own, and ClefNote is a
 * zero-tick tickable (ignoreTicks=true) designed exactly for inserting the
 * clef-change glyph mid-voice, so this is one continuous stave/voice, not a
 * stack of separate staves.
 *
 * Stem direction: StaveNote defaults to stem-up unconditionally unless
 * `autoStem: true` is passed — confirmed against VexFlow's own source,
 * where the constructor is literally `stemDirection ?? Stem.UP`. Passing
 * autoStem delegates to VexFlow's calculateOptimalStemDirection(), which
 * implements the standard rule (on/above the middle line, stem down; below
 * it, stem up) from the same keys/clef every note is already built from —
 * so it automatically follows the WRITTEN position post-bracket, with no
 * separate calculation needed here. stemDirectionFor() below is a pure
 * reimplementation of that identical rule, exported only so the test suite
 * can check it without a DOM to run real VexFlow in.
 *
 * Notehead colour is CC.groupOfSlot(slot, k) through the same four-colour
 * palette as the ring and the figure (RING_COLORS below is a literal copy of
 * figure.js's own — see that file's comment on why it can't be read from the
 * --color-ring-N CSS custom properties: exported SVG has no stylesheet to
 * resolve them from). The paired non-colour cue (SPEC.md §5: colour must
 * never be the only signal, since journals print greyscale) is a small
 * shape-glyph Annotation under each notehead, reusing circle.js's own
 * per-ring shape vocabulary (circle/diamond/triangle/pentagon) rather than
 * VexFlow's undocumented custom-notehead-shape API.
 */
import * as CC from '../src/cycles.js';
import { isPlayable } from './audio.js';
import { registeredNotes } from './register.js';

// Kept as literal constants, not read from CSS, for the same reason
// figure.js's RING_COLORS is: the exported standalone SVG has no stylesheet
// to resolve custom properties from. Must be kept in sync with styles.css
// (--color-ring-N) and figure.js by hand if that palette ever changes.
const RING_COLORS = ['#0072b2', '#d55e00', '#009e73', '#cc79a7'];
const MONO_COLOR = RING_COLORS[0];

// circle.js's RING_SHAPES, in glyph form: ring 0 is round, then diamond,
// triangle, pentagon — the redundant non-colour cue for notehead group.
const SHAPE_GLYPHS = ['●', '◆', '▲', '⬟'];

const ACCIDENTAL_ASCII = { '♯': '#', '♭': 'b' };
const REST_KEY = { treble: 'b/4', bass: 'd/3' };

// ---------------------------------------------------------------------------
// Exact staff-line geometry (matches VexFlow's Tables.keyProperties(),
// verified against its source rather than approximated) — used for clef
// choice, ledger-line counting, octave-bracket placement, and stem
// direction, so all four agree on the same notion of "where this sits".
// ---------------------------------------------------------------------------

const NOTE_INDEX = {
  c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6,
};
const CLEF_LINE_SHIFT = { treble: 0, bass: 6 };

/**
 * VexFlow's own line formula: each diatonic letter step moves half a line,
 * so lines land on whole numbers (1 = bottom line, 5 = top) and spaces on
 * half-integers, normalised so line 3 is always the clef's own middle line
 * for both clefs (B4 in treble, D3 in bass — the user-facing rule's own
 * named examples) via the clef-specific shift.
 */
export function staffLine(letter, octave, clef) {
  const baseIndex = octave * 7 - 4 * 7;
  return (baseIndex + NOTE_INDEX[letter]) / 2 + CLEF_LINE_SHIFT[clef];
}

/** How many ledger lines a staff position needs — 0 inside the five lines. */
export function ledgerLineCount(line) {
  if (line > 5) return Math.floor(line - 5);
  if (line < 1) return Math.floor(1 - line);
  return 0;
}

/**
 * The standard stem-direction rule, matching VexFlow's own
 * calculateOptimalStemDirection() for a single note (verified against
 * source: `decider < MIDDLE_LINE(3) ? Stem.UP : Stem.DOWN`). Not used at
 * render time — StaveNote's `autoStem: true` delegates to VexFlow's real
 * implementation of this same rule — exported only for testing.
 */
export function stemDirectionFor(line) {
  return line < 3 ? 'up' : 'down';
}

function ledgerCostForClef(entry, clef) {
  return ledgerLineCount(staffLine(entry.letter, entry.octave, clef));
}

/** One clef for an entire bounded-register passage, minimising ledger lines. */
function chooseSingleClef(entries) {
  const real = entries.filter((e) => !e.isRest);
  const cost = (clef) => real.reduce((sum, e) => sum + ledgerCostForClef(e, clef), 0);
  return cost('treble') <= cost('bass') ? 'treble' : 'bass';
}

/** Per-note clef for literal mode: the standard grand-staff split at middle C. */
const clefForNote = (midi) => (midi >= 60 ? 'treble' : 'bass');

function parseName(name) {
  return { letter: name[0].toLowerCase(), accidental: ACCIDENTAL_ASCII[name.slice(1)] || '' };
}

// ---------------------------------------------------------------------------
// Register bands (octave brackets)
// ---------------------------------------------------------------------------

const PLAIN_BAND = { name: 'plain', shift: 0 };
const REGISTER_BANDS = [
  // Order matters: the more extreme band must be checked first, since its
  // range is a strict subset of the less extreme one's.
  { name: '15mb', test: (m) => m < 21, shift: 24 },
  { name: '8vb', test: (m) => m < 33, shift: 12 },
  { name: '15ma', test: (m) => m > 101, shift: -24 },
  { name: '8va', test: (m) => m > 89, shift: -12 },
];
const BRACKET_SPEC = {
  '15mb': { text: '15', superscript: 'mb', position: 'bottom' },
  '8vb': { text: '8', superscript: 'vb', position: 'bottom' },
  '8va': { text: '8', superscript: 'va', position: 'top' },
  '15ma': { text: '15', superscript: 'ma', position: 'top' },
};

function registerBandFor(midi) {
  for (const band of REGISTER_BANDS) if (band.test(midi)) return band;
  return PLAIN_BAND;
}

/**
 * Group consecutive non-rest notes sharing the same non-plain band into
 * bracket spans — one TextBracket per span. A rest or a plain note always
 * ends whatever run was open (a rest has no pitch to bracket; a plain note
 * needs no bracket). Pure and exported so the test suite can check the
 * concrete M7-M7 case named in the brief directly.
 */
export function octaveBandSpans(entries) {
  const spans = [];
  let runStart = null;
  let runBand = null;
  const close = (endIndex) => {
    if (runStart !== null) spans.push({ start: runStart, end: endIndex, band: runBand });
    runStart = null;
    runBand = null;
  };
  entries.forEach((e, i) => {
    const bandable = !e.isRest && e.band !== 'plain';
    if (!bandable) { close(i - 1); return; }
    if (runBand !== e.band) { close(i - 1); runStart = i; runBand = e.band; }
  });
  close(entries.length - 1);
  return spans;
}

/**
 * The thirteen notes notation draws, matching audio note-for-note. Pure and
 * exported for app/notation.test.js to check against the engine directly.
 */
export function noteSequence(iv, { mode = 'bounded', transposition = 0 } = {}) {
  const k = iv.length;
  const names12 = CC.spell(iv, { mode: 'fixed', transposition });
  const names = [...names12, names12[0]];
  const midi = registeredNotes(iv, { mode, transposition });

  // First pass: everything independent of the eventual clef choice, since
  // bounded's single clef needs the whole list (via chooseSingleClef) built
  // first.
  const pre = names.map((name, i) => {
    const slot = i < 12 ? i : 0;
    const { letter, accidental } = parseName(name);
    const m = midi[i];
    const isRest = !isPlayable(m);
    const band = isRest ? PLAIN_BAND : registerBandFor(m);
    const writtenMidi = m + band.shift;
    const octave = Math.floor(writtenMidi / 12) - 1;
    return {
      index: i,
      slot,
      group: CC.groupOfSlot(slot, k),
      midi: m,
      writtenMidi,
      band: band.name,
      letter,
      accidental,
      octave,
      vexKey: `${letter}${accidental}/${octave}`,
      isRest,
    };
  });

  const singleClef = mode === 'literal' ? null : chooseSingleClef(pre);

  return pre.map((e) => ({
    ...e,
    // Rests use their own out-of-range midi (no band shift ever applies to
    // them) to at least lean toward a plausible clef; real notes use the
    // WRITTEN position — after any octave-bracket shift — not the sounding
    // pitch, per the brief: this is what makes stem direction (which reads
    // straight off this clef choice) follow the written position too.
    clef: e.isRest ? clefForNote(e.midi) : (mode === 'literal' ? clefForNote(e.writtenMidi) : singleClef),
  }));
}

/** The interval label above note `i` (0-11) — the step it leads into. */
export const intervalLabel = (iv, i) => CC.intervalName(iv[i % iv.length]);

function requiredHeight(entries) {
  let maxLedger = 0;
  let hasBracket = false;
  for (const e of entries) {
    if (e.isRest) continue;
    maxLedger = Math.max(maxLedger, ledgerCostForClef(e, e.clef));
    if (e.band !== 'plain') hasBracket = true;
  }
  // A generous overestimate is harmless (just white space); clipping isn't.
  return 170 + maxLedger * 22 + (hasBracket ? 40 : 0);
}

function buildTickables(Flow, entries, iv, { showIntervalLabels, monochrome }) {
  const tickables = [];
  const notesByIndex = new Array(entries.length);
  let prevClef = entries[0]?.clef;

  entries.forEach((e) => {
    if (e.index > 0 && e.clef !== prevClef) {
      tickables.push(new Flow.ClefNote(e.clef, 'small'));
    }
    prevClef = e.clef;

    let note;
    if (e.isRest) {
      note = new Flow.StaveNote({
        keys: [REST_KEY[e.clef]], duration: 'qr', clef: e.clef, autoStem: true,
      });
    } else {
      // autoStem delegates stem direction to VexFlow's own middle-line rule
      // (see the module comment) — no stem_direction override here, since
      // an explicit one would always win over the note's actual position.
      note = new Flow.StaveNote({
        keys: [e.vexKey], duration: 'q', clef: e.clef, autoStem: true,
      });
      if (e.accidental) note.addModifier(new Flow.Accidental(e.accidental), 0);
      const color = monochrome ? MONO_COLOR : RING_COLORS[e.group % RING_COLORS.length];
      note.setKeyStyle(0, { fillStyle: color, strokeStyle: color });
      const shape = new Flow.Annotation(SHAPE_GLYPHS[e.group % SHAPE_GLYPHS.length]);
      shape.setVerticalJustification(Flow.AnnotationVerticalJustify.BOTTOM);
      note.addModifier(shape, 0);
    }

    if (showIntervalLabels && e.index < 12) {
      const label = new Flow.Annotation(intervalLabel(iv, e.index));
      label.setVerticalJustification(Flow.AnnotationVerticalJustify.TOP);
      note.addModifier(label, 0);
    }

    notesByIndex[e.index] = note;
    tickables.push(note);
  });

  return { tickables, notesByIndex };
}

/** Render one cycle's notation into `container`, replacing its contents. */
function drawInto(container, iv, { mode, transposition, showIntervalLabels, monochrome }) {
  const Flow = window.Vex.Flow;
  container.innerHTML = '';

  const entries = noteSequence(iv, { mode, transposition });
  const { tickables, notesByIndex } = buildTickables(Flow, entries, iv, { showIntervalLabels, monochrome });
  const height = requiredHeight(entries);
  const width = Math.max(220, 70 + tickables.length * 52);

  const renderer = new Flow.Renderer(container, Flow.Renderer.Backends.SVG);
  renderer.resize(width, height);
  const context = renderer.getContext();

  const stave = new Flow.Stave(10, height / 2 - 40, width - 20);
  stave.addClef(entries[0].clef);
  stave.setContext(context).draw();

  const voice = new Flow.Voice({ numBeats: entries.length, beatValue: 4 });
  voice.setStrict(false);
  voice.addTickables(tickables);

  new Flow.Formatter().joinVoices([voice]).formatToStave([voice], stave);
  voice.draw(context, stave);

  // Octave brackets are drawn after voice.draw(), not before: TextBracket
  // reads each note's stave via checkStave(), which is only set once the
  // note has actually been drawn onto one.
  for (const span of octaveBandSpans(entries)) {
    const spec = BRACKET_SPEC[span.band];
    let maxLedger = 0;
    for (let i = span.start; i <= span.end; i += 1) {
      maxLedger = Math.max(maxLedger, ledgerCostForClef(entries[i], entries[i].clef));
    }
    const bracket = new Flow.TextBracket({
      start: notesByIndex[span.start],
      stop: notesByIndex[span.end],
      text: spec.text,
      superscript: spec.superscript,
      position: spec.position,
    });
    bracket.setLine(2 + maxLedger);
    bracket.setContext(context).draw();
  }

  return container.querySelector('svg');
}

/**
 * Mount the notation panel. render(state, {registerMode}) redraws fully on
 * every call — VexFlow doesn't support incremental updates the way the
 * hand-rolled circle/figure SVG do, and a full redraw only on state change
 * (not per frame) is cheap enough here.
 */
export function mountNotation(root) {
  const holder = document.createElement('div');
  holder.className = 'notation-svg-holder';
  root.appendChild(holder);

  const unavailableEl = document.createElement('p');
  unavailableEl.className = 'hint';
  unavailableEl.textContent = 'Notation unavailable — VexFlow failed to load.';
  unavailableEl.hidden = true;
  root.appendChild(unavailableEl);

  let showIntervalLabels = true;
  let lastState = null;
  let lastMode = 'bounded';

  function draw() {
    if (!lastState) return;
    if (typeof window.Vex === 'undefined') {
      holder.hidden = true;
      unavailableEl.hidden = false;
      return;
    }
    holder.hidden = false;
    unavailableEl.hidden = true;
    try {
      drawInto(holder, lastState.intervals, {
        mode: lastMode,
        transposition: lastState.transposition,
        showIntervalLabels,
        monochrome: false,
      });
    } catch {
      // A broken render should not break the rest of the interface — the
      // other three views still update via the same renderAll() call.
      holder.hidden = true;
      unavailableEl.hidden = false;
    }
  }

  function render(state, { registerMode } = {}) {
    lastState = state;
    if (registerMode) lastMode = registerMode;
    draw();
  }

  function setShowIntervalLabels(value) {
    showIntervalLabels = value;
    draw();
  }

  return { render, setShowIntervalLabels };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * A standalone SVG document for the current cycle's notation. VexFlow's SVG
 * backend already renders to a real <svg> element, so — unlike figure.js,
 * which hand-builds its export markup — this just serialises that element
 * (rendered off-screen) rather than duplicating the drawing logic.
 */
export function buildStandaloneSvg(iv, {
  mode = 'bounded', transposition = 0, monochrome = false, showIntervalLabels = true,
} = {}) {
  if (typeof window.Vex === 'undefined') return null;

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-99999px';
  document.body.appendChild(container);

  try {
    const svg = drawInto(container, iv, {
      mode, transposition, showIntervalLabels, monochrome,
    });
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const width = svg.getAttribute('width');
    const height = svg.getAttribute('height');
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', width);
    bg.setAttribute('height', height);
    bg.setAttribute('fill', '#ffffff');
    svg.insertBefore(bg, svg.firstChild);
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
  } finally {
    container.remove();
  }
}
