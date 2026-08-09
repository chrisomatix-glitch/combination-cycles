/**
 * figure.js — the circle-of-fifths figure: a second, fixed-layout view of
 * the current cycle (SPEC.md's Phase 4 brief).
 *
 * The existing circle (circle.js) lays notes out in CYCLE order, which is
 * what makes rotation and swapping legible. This view fixes the layout as
 * the circle of fifths instead — C G D A E B F# Db Ab Eb Bb F, clockwise
 * from the top, independent of the cycle — and draws a chord between each
 * pair of consecutive notes in cycle order: twelve chords, forming a star
 * polygon. This is the representation used in Berliner et al. (2018) and in
 * the author's presentation slides, so it's what makes the concordance
 * (SPEC.md §3, berlinerId) legible rather than just a number.
 *
 * Three verified facts this view exists to surface, not leave implicit:
 *   - A cycle and its retrograde draw the IDENTICAL figure (SPEC.md §3a) —
 *     every figure is shared by exactly two of the ordered forms, and the
 *     other one is always the entry's own retrogradeOf. app/figure.test.js
 *     proves both that and the count below (6/32/162) against the engine.
 *   - Inversion mirrors the figure across the C-F# axis, exactly, because
 *     pitch-class negation is exactly position negation in circle-of-fifths
 *     order — 7 is its own inverse mod 12, so negating a pitch class negates
 *     its fifths-position, which is precisely a geometric reflection.
 *   - A figure can be its own mirror image (isReflectionSymmetric) — the
 *     cycle and its inversion then draw the same figure, even though they
 *     remain different catalogue entries. app/figure.test.js also checks
 *     this happens for exactly 4/16/12 forms at k = 2/3/4.
 */
import * as CC from '../src/cycles.js';

/** The circle-of-fifths position (0-11, clockwise from C at the top) of a pitch class. */
export const positionOf = (pitchClass) => (7 * pitchClass) % 12;

/** The pitch class at a circle-of-fifths position (7 is its own inverse mod 12, so this undoes positionOf). */
export const pitchClassAt = (position) => (7 * position) % 12;

/** The fixed layout itself: pitch class at each of the 12 positions, position 0 first. */
export const FIXED_LAYOUT = Array.from({ length: 12 }, (_, position) => pitchClassAt(position));

/**
 * The chords a cycle draws on the circle-of-fifths layout: one per step, in
 * cycle order, as circle-of-fifths POSITIONS (0-11) rather than pitch
 * classes, so callers can place them on the fixed layout directly.
 * `intervalIndex` is which dial (0..k-1) produced that chord — chords repeat
 * the same k dials 12/k times around the cycle, and this is the colour key
 * SPEC.md asks for ("colour the chords by interval index").
 */
export function figureChords(iv, transposition = 0) {
  const pcs = CC.pitchClasses(iv, transposition);
  const k = iv.length;
  return pcs.map((p, i) => ({
    from: positionOf(p),
    to: positionOf(pcs[(i + 1) % 12]),
    intervalIndex: i % k,
  }));
}

/**
 * The figure's canonical signature: its twelve chords as an unordered edge
 * set (by pitch class, not position — position is just a fixed relabelling).
 * Rotating or reading a cycle's interval sequence backwards both preserve
 * the set of edges a closed loop traces, so this signature is exactly what
 * makes "these two forms draw the same figure" a checkable equality.
 */
export function figureSignature(iv, transposition = 0) {
  const pcs = CC.pitchClasses(iv, transposition);
  const edges = pcs.map((p, i) => {
    const q = pcs[(i + 1) % 12];
    return p < q ? `${p}-${q}` : `${q}-${p}`;
  });
  return edges.sort().join(',');
}

/**
 * True if inverting the cycle draws the identical figure — a genuine mirror
 * symmetry of the shape on the circle-of-fifths layout, not merely a
 * coincidence of catalogue numbering (the cycle and its inversion remain two
 * distinct catalogue entries either way).
 */
export function isReflectionSymmetric(iv, transposition = 0) {
  return figureSignature(iv, transposition) === figureSignature(CC.invert(iv), transposition);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';
const CX = 150;
const CY = 150;
const VERTEX_R = 120;
const LABEL_R = 138;
const DOT_R = 3.5;

// Kept as a literal constant, not read from the CSS custom properties
// (--color-ring-N in styles.css), because the exported SVG has to be a
// standalone file with no external stylesheet to resolve them from — see
// buildStandaloneSvg. Must be kept in sync with styles.css by hand if that
// palette ever changes; it's the one piece of colour data duplicated outside
// CSS in this app.
const RING_COLORS = ['#0072b2', '#d55e00', '#009e73', '#cc79a7'];
const MONO_COLOR = RING_COLORS[0]; // "the slides use plain blue" — SPEC.md's Phase 4 brief

const svgEl = (tag, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, val] of Object.entries(attrs)) node.setAttribute(key, val);
  return node;
};

function vertexPoint(position, radius) {
  const deg = -90 + position * 30;
  const rad = (deg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

/**
 * Mount the figure: a fixed circle-of-fifths layout with the current
 * cycle's twelve chords drawn on it. Unlike circle.js's mountCircle, this
 * carries no interaction of its own (SPEC.md's Phase 4 brief) — it only
 * ever redraws in response to render() calls driven by the same state
 * changes the ring view responds to.
 */
export function mountFigure(root) {
  const svg = svgEl('svg', {
    viewBox: '0 0 300 300', class: 'figure-svg', 'aria-hidden': 'true', focusable: 'false',
  });
  root.appendChild(svg);

  const chordsGroup = svgEl('g', { class: 'figure-chords' });
  const vertexGroup = svgEl('g', { class: 'figure-vertices' });
  svg.append(chordsGroup, vertexGroup);

  // The circle-of-fifths layout is fixed forever, independent of the cycle,
  // so the twelve vertices are drawn once and never touched again.
  for (let position = 0; position < 12; position += 1) {
    const pc = pitchClassAt(position);
    const dot = vertexPoint(position, VERTEX_R);
    const label = vertexPoint(position, LABEL_R);
    const dotEl = svgEl('circle', {
      cx: dot.x.toFixed(2), cy: dot.y.toFixed(2), r: DOT_R, class: 'figure-vertex__dot',
    });
    const textEl = svgEl('text', {
      x: label.x.toFixed(2), y: label.y.toFixed(2), class: 'figure-vertex__label', 'text-anchor': 'middle', dy: '0.32em',
    });
    textEl.textContent = CC.PITCH_NAMES[pc];
    vertexGroup.append(dotEl, textEl);
  }

  // The twelve chord <line> elements are created once and reused, their
  // endpoints and class updated in place on every draw() — not recreated —
  // so the CSS transition on x1/y1/x2/y2 in styles.css has something
  // persistent to animate between draws (SPEC.md's Phase 4 brief: "a brief
  // transition of the chord endpoints is welcome if it stays legible").
  const chordEls = Array.from({ length: 12 }, () => {
    const line = svgEl('line', { class: 'figure-chord' });
    chordsGroup.appendChild(line);
    return line;
  });

  let mono = false;
  let lastIntervals = null;
  let lastTransposition = 0;

  function draw() {
    if (!lastIntervals) return;
    const chords = figureChords(lastIntervals, lastTransposition);
    chords.forEach(({ from, to, intervalIndex }, i) => {
      const p1 = vertexPoint(from, VERTEX_R);
      const p2 = vertexPoint(to, VERTEX_R);
      const el = chordEls[i];
      el.setAttribute('x1', p1.x.toFixed(2));
      el.setAttribute('y1', p1.y.toFixed(2));
      el.setAttribute('x2', p2.x.toFixed(2));
      el.setAttribute('y2', p2.y.toFixed(2));
      el.setAttribute(
        'class',
        mono ? 'figure-chord figure-chord--mono' : `figure-chord figure-chord--ring${intervalIndex}`,
      );
    });
  }

  function render(state) {
    lastIntervals = state.intervals;
    lastTransposition = state.transposition;
    draw();
  }

  function setMonochrome(value) {
    mono = value;
    draw();
  }

  return { render, setMonochrome };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * A standalone SVG document for the current cycle's figure — no external
 * stylesheet or CSS custom property to resolve, every colour and font baked
 * in as literal attributes, so it opens correctly wherever it's opened
 * (SPEC.md's Phase 4 brief, acceptance criterion 5). Rendered larger than
 * the on-screen 300-unit viewBox (900, here) so it holds up in print.
 */
export function buildStandaloneSvg(iv, transposition, { monochrome = false } = {}) {
  const size = 900;
  const scale = size / 300;
  const cx = size / 2;
  const cy = size / 2;
  const vertexR = VERTEX_R * scale;
  const labelR = LABEL_R * scale;
  const dotR = DOT_R * scale;
  const fontSize = 26 * scale;
  const strokeWidth = 2.5 * scale;

  const pt = (position, r) => {
    const deg = -90 + position * 30;
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const vertexMarkup = FIXED_LAYOUT.map((pc, position) => {
    const dot = pt(position, vertexR);
    const label = pt(position, labelR);
    return `<circle cx="${dot.x.toFixed(2)}" cy="${dot.y.toFixed(2)}" r="${dotR.toFixed(2)}" fill="#5a5a5a" />\n`
      + `  <text x="${label.x.toFixed(2)}" y="${label.y.toFixed(2)}" text-anchor="middle" dy="0.32em" `
      + `font-family="Arial, Helvetica, sans-serif" font-size="${fontSize.toFixed(1)}" font-weight="700" `
      + `fill="#1a1a1a">${CC.PITCH_NAMES[pc]}</text>`;
  }).join('\n  ');

  const chordMarkup = figureChords(iv, transposition).map(({ from, to, intervalIndex }) => {
    const p1 = pt(from, vertexR);
    const p2 = pt(to, vertexR);
    const stroke = monochrome ? MONO_COLOR : RING_COLORS[intervalIndex];
    return `<line x1="${p1.x.toFixed(2)}" y1="${p1.y.toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${p2.y.toFixed(2)}" `
      + `stroke="${stroke}" stroke-width="${strokeWidth.toFixed(2)}" stroke-linecap="round" stroke-opacity="0.85" />`;
  }).join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">\n`
    + `  <rect width="${size}" height="${size}" fill="#ffffff" />\n`
    + `  ${chordMarkup}\n`
    + `  ${vertexMarkup}\n`
    + `</svg>\n`;
}
