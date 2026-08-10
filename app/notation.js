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
 * MIDI numbers come from CC.placeRegister(iv, {mode, transposition,
 * closeCycle:true}), the exact call index.html's registeredNotes() makes for
 * audio, so the staff and playback agree note-for-note by construction, not
 * by two independent implementations staying in sync by hand. "Out of
 * range" reuses Audio.isPlayable() for the same reason — a note the audio
 * silently skips is rendered here as a rest, not a fabricated pitch.
 *
 * Spelling is CC.spell(iv, {mode:'fixed'}) — the engine's conventional
 * circle-of-fifths spelling (one sharp, the rest flats), which is what makes
 * "no double accidentals" true by construction: fixed spelling only ever
 * emits '', a single sharp or a single flat (see PITCH_NAMES in cycles.js).
 * Contextual spelling was deliberately rejected (Phase 5's brief: 182/236
 * realisations would need double accidentals under it).
 *
 * Clef: bounded mode is about an octave, so one clef for the whole passage,
 * chosen to minimise ledger lines. Literal mode can wander up to eleven
 * octaves, so each note gets its own clef by a fixed treble/bass split at
 * middle C — VexFlow's StaveNote takes a per-note `clef` independent of the
 * stave's own, and ClefNote is a zero-tick tickable (ignoreTicks=true)
 * designed exactly for inserting the clef-change glyph mid-voice, so this is
 * one continuous stave/voice, not a stack of separate staves.
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

// Approximate MIDI range each clef covers without ledger lines (the staff
// lines themselves: E4-F5 for treble, G2-A3 for bass). Used only to choose
// a clef, not to position anything — VexFlow computes the real geometry.
const CLEF_STAFF_RANGE = { treble: [64, 77], bass: [43, 57] };
const REST_KEY = { treble: 'b/4', bass: 'd/3' };

function ledgerCost(midi, clef) {
  const [lo, hi] = CLEF_STAFF_RANGE[clef];
  if (midi < lo) return lo - midi;
  if (midi > hi) return midi - hi;
  return 0;
}

/** One clef for an entire bounded-register passage, minimising ledger lines. */
function chooseSingleClef(midiList) {
  const real = midiList.filter((m) => isPlayable(m));
  const cost = (clef) => real.reduce((sum, m) => sum + ledgerCost(m, clef), 0);
  return cost('treble') <= cost('bass') ? 'treble' : 'bass';
}

/** Per-note clef for literal mode: the standard grand-staff split at middle C. */
const clefForNote = (midi) => (midi >= 60 ? 'treble' : 'bass');

function parseName(name) {
  return { letter: name[0].toLowerCase(), accidental: ACCIDENTAL_ASCII[name.slice(1)] || '' };
}

/**
 * The thirteen notes notation draws, matching audio note-for-note. Pure and
 * exported for app/notation.test.js to check against the engine directly.
 */
export function noteSequence(iv, { mode = 'bounded', transposition = 0 } = {}) {
  const k = iv.length;
  const names12 = CC.spell(iv, { mode: 'fixed', transposition });
  const names = [...names12, names12[0]];
  const midi = CC.placeRegister(iv, {
    mode, transposition, closeCycle: true,
  });
  const singleClef = mode === 'literal' ? null : chooseSingleClef(midi);

  return names.map((name, i) => {
    const slot = i < 12 ? i : 0;
    const { letter, accidental } = parseName(name);
    const m = midi[i];
    const octave = Math.floor(m / 12) - 1;
    return {
      index: i,
      slot,
      group: CC.groupOfSlot(slot, k),
      midi: m,
      accidental,
      vexKey: `${letter}${accidental}/${octave}`,
      clef: mode === 'literal' ? clefForNote(m) : singleClef,
      isRest: !isPlayable(m),
    };
  });
}

/** The interval label above note `i` (0-11) — the step it leads into. */
export const intervalLabel = (iv, i) => CC.intervalName(iv[i % iv.length]);

function requiredHeight(entries) {
  let maxLedger = 0;
  for (const e of entries) {
    if (e.isRest) continue;
    maxLedger = Math.max(maxLedger, ledgerCost(e.midi, e.clef));
  }
  // A generous overestimate is harmless (just white space); clipping isn't.
  return 170 + maxLedger * 11;
}

function buildTickables(Flow, entries, iv, { showIntervalLabels, monochrome }) {
  const tickables = [];
  let prevClef = entries[0]?.clef;

  entries.forEach((e) => {
    if (e.index > 0 && e.clef !== prevClef) {
      tickables.push(new Flow.ClefNote(e.clef, 'small'));
    }
    prevClef = e.clef;

    let note;
    if (e.isRest) {
      note = new Flow.StaveNote({ keys: [REST_KEY[e.clef]], duration: 'qr', clef: e.clef });
    } else {
      note = new Flow.StaveNote({ keys: [e.vexKey], duration: 'q', clef: e.clef });
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

    tickables.push(note);
  });

  return tickables;
}

/** Render one cycle's notation into `container`, replacing its contents. */
function drawInto(container, iv, { mode, transposition, showIntervalLabels, monochrome }) {
  const Flow = window.Vex.Flow;
  container.innerHTML = '';

  const entries = noteSequence(iv, { mode, transposition });
  const tickables = buildTickables(Flow, entries, iv, { showIntervalLabels, monochrome });
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
