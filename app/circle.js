/**
 * circle.js — the twelve-note circle: SVG rendering and interaction.
 *
 * Geometry, not layout: twelve fixed angular slots, 30 degrees apart. Which
 * ring owns a slot is groupOfSlot(slot, k) — fixed forever, independent of
 * the interval sequence (SPEC.md §6). What changes when the cycle changes is
 * which pitch class sits in each slot: pitchClasses(iv, t) assigns pitch
 * classes to slots in generative order, and slot parity mod k is group
 * membership regardless of which intervals are chosen. That's why the
 * "locked" ring (group 0) never visibly moves under rotateGroup: its notes
 * and their order are invariant. Each movable ring's notes cycle rigidly
 * among their own 12/k slots — a rotation of the ring, not a re-layout.
 *
 * At k intervals there are k rings sharing the same 12 angular slots, each
 * ring only occupying every kth one, drawn at its own radius so they read as
 * concentric rather than crowding all twelve notes onto one circle (SPEC.md
 * §6). Ring 0 is always locked and static; rings 1..k-1 are movable, each
 * with its own drag/tap/keyboard handling, so which ring a pointer grabbed
 * is unambiguous even with three movable rings at k = 4.
 *
 * Ring swapping (SPEC.md's Phase 2 brief — the control that makes the full
 * cycle space reachable) lives entirely in the colour-coded swap buttons in
 * index.html now. Phase 2 tried a tap-to-arm gesture on the rings themselves,
 * but a tap is also how a note plays (SPEC.md's Phase 3 brief), and the two
 * collided: clicking through a cycle in order meant every change of ring
 * armed a swap instead of sounding the next note (SPEC.md's Phase 3.1 brief).
 * So clicking or tapping a note now only ever plays it, on every ring,
 * unconditionally — no arming, no swapping, no keyboard toggle.
 */
import * as CC from '../src/cycles.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CX = 150;
const CY = 150;
const DOT_R = 15;
const HIT_R = 20;
const TAP_THRESHOLD_PX = 6;
const ROTATE_MS = 280;
const SETTLE_MS = 180;

// Ring radii by k, innermost (locked, ring 0) first. Tuned by hand so k = 2
// matches Phase 1 exactly, and k = 3/4/6 keep even gaps as more rings have to
// share the same drawing. k = 6's six rings never collide despite the
// tighter radial spacing: each ring occupies a disjoint set of the twelve
// fixed 30-degree slots (groupOfSlot), so same-radius crowding is the only
// risk this table has to manage, not same-angle crowding between rings.
const RADII = {
  2: [86, 124],
  3: [64, 96, 128],
  4: [52, 78, 104, 130],
  6: [40, 58, 76, 94, 112, 130],
};

// Colour is keyed by ring INDEX, not by which pitch classes currently sit in
// it, so switching modes keeps the visual language stable (SPEC.md's Phase 2
// brief). Okabe-Ito, colourblind-safe — applied via the --color-ring-N
// custom properties in styles.css, the single source of truth also used by
// the dials and the swap/rotate controls in index.html.

// Each ring also gets a distinct silhouette — the redundant non-colour cue
// SPEC.md §5 requires, since journals print greyscale. Ring 0 is a circle;
// the rest are regular polygons of increasing side count. polygonPoints()
// below is generic in side count, so k = 6's two extra rings (hexagon,
// heptagon) need no new drawing code, only two more table entries.
const RING_SHAPES = {
  1: { sides: 4, rotate: -90 }, // diamond
  2: { sides: 3, rotate: -90 }, // triangle
  3: { sides: 5, rotate: -90 }, // pentagon
  4: { sides: 6, rotate: -90 }, // hexagon
  5: { sides: 7, rotate: -90 }, // heptagon
};

const svgEl = (tag, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, val] of Object.entries(attrs)) node.setAttribute(key, val);
  return node;
};

function slotPoint(slot, radius) {
  const deg = -90 + slot * 30;
  const rad = (deg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function polygonPoints(sides, radius, rotateDeg) {
  const pts = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = ((rotateDeg + (360 / sides) * i) * Math.PI) / 180;
    pts.push(`${(radius * Math.cos(angle)).toFixed(2)},${(radius * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function shapeEl(ring) {
  const spec = RING_SHAPES[ring];
  if (!spec) return svgEl('circle', { r: DOT_R, class: 'note__shape' });
  return svgEl('polygon', {
    points: polygonPoints(spec.sides, DOT_R * 1.15, spec.rotate),
    class: 'note__shape',
  });
}

export function mountCircle(root, { onRotate, onNotePlay } = {}) {
  const svg = svgEl('svg', {
    viewBox: '0 0 300 300',
    class: 'circle-svg',
  });
  root.appendChild(svg);

  let k = 0;
  let degreesPerStep = 60;
  let ringEls = [];
  let noteEls = []; // indexed by slot, rebuilt every draw()
  let animating = false;

  function draw(intervals, transposition) {
    for (const g of ringEls) g.textContent = '';
    noteEls = [];
    const pcs = CC.pitchClasses(intervals, transposition);
    const kk = intervals.length;
    for (let slot = 0; slot < 12; slot += 1) {
      const ring = CC.groupOfSlot(slot, kk);
      const radius = RADII[kk][ring];
      const { x, y } = slotPoint(slot, radius);
      const note = svgEl('g', {
        class: `note note--ring${ring} note--${ring === 0 ? 'locked' : 'movable'}`,
        transform: `translate(${x} ${y})`,
      });
      note.dataset.slot = String(slot);
      const hit = svgEl('circle', { r: HIT_R, class: 'note__hit' });
      const shape = shapeEl(ring);
      const label = svgEl('text', {
        class: 'note__label', 'text-anchor': 'middle', dy: '0.32em',
      });
      label.textContent = CC.PITCH_NAMES[pcs[slot]];
      note.append(hit, shape, label);
      if (ring === 0) {
        // The locked ring has no drag handling, so a plain click plays the
        // note. Movable rings play from the tap branch of their own pointer
        // handling instead (attachRingHandlers), since that's the one place
        // that already distinguishes a tap from a drag.
        note.addEventListener('click', () => onNotePlay?.(slot));
      }
      noteEls[slot] = note;
      ringEls[ring].appendChild(note);
    }
  }

  /** Briefly pulse the note at `slot` — used for both click feedback and play-through. */
  function highlightSlot(slot) {
    const note = noteEls[slot];
    if (!note) return;
    note.classList.remove('note--playing');
    note.getBoundingClientRect(); // force reflow so a repeated pulse restarts
    note.classList.add('note--playing');
  }

  function animateTransform(target, toTransform, ms, after) {
    animating = true;
    target.style.transition = 'none';
    target.style.transform = 'none';
    target.getBoundingClientRect(); // force reflow so the next line animates
    requestAnimationFrame(() => {
      target.style.transition = `transform ${ms}ms ease`;
      target.style.transform = toTransform;
    });
    const onEnd = (e) => {
      if (e.target !== target) return;
      target.removeEventListener('transitionend', onEnd);
      target.style.transition = 'none';
      target.style.transform = 'none';
      animating = false;
      after();
    };
    target.addEventListener('transitionend', onEnd);
  }

  function render(state, meta = {}) {
    if (meta.type === 'rotate' && meta.instant && ringEls[meta.m]) {
      // A released drag already animated this ring from wherever the
      // pointer let go to its snap position (settleRotate below) — just
      // swap in the new arrangement, don't replay the step as a second
      // animation on top of it (SPEC.md's Phase 3 brief).
      draw(state.intervals, state.transposition);
    } else if (meta.type === 'rotate' && meta.degrees && ringEls[meta.m]) {
      // meta.degrees comes from state.js's visualDegrees() — the actual
      // on-screen displacement for THIS ring, not steps * (30 * k). See
      // state.js for why the sign can't be assumed fixed.
      animateTransform(
        ringEls[meta.m],
        `rotate(${meta.degrees}deg)`,
        ROTATE_MS,
        () => draw(state.intervals, state.transposition),
      );
    } else {
      draw(state.intervals, state.transposition);
    }
  }

  // --- Drag-to-rotate / tap-to-play on a movable ring ---------------------
  const angleAt = (clientX, clientY) => {
    const rect = svg.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    return Math.atan2(dy, dx) * (180 / Math.PI);
  };

  // `visualSlots` here is always screen-space: positive means the ring was
  // dragged clockwise, full stop. It is `onRotate`'s job (rotateVisual in
  // state.js) to work out which engine step sign that corresponds to in the
  // current dial-sum family — circle.js never assumes a fixed sign itself.
  function settleRotate(m, visualSlots) {
    const ringEl = ringEls[m];
    const targetDeg = visualSlots * degreesPerStep;
    const already = ringEl.style.transform === `rotate(${targetDeg}deg)`
      || (targetDeg === 0 && (ringEl.style.transform === '' || ringEl.style.transform === 'none'));
    const finish = () => {
      ringEl.style.transition = 'none';
      ringEl.style.transform = 'none';
      animating = false;
      if (visualSlots !== 0) onRotate?.(m, visualSlots, { instant: true });
    };
    if (already) { finish(); return; }
    animating = true;
    ringEl.style.transition = `transform ${SETTLE_MS}ms ease`;
    ringEl.style.transform = `rotate(${targetDeg}deg)`;
    const onEnd = (e) => {
      if (e.target !== ringEl) return;
      ringEl.removeEventListener('transitionend', onEnd);
      finish();
    };
    ringEl.addEventListener('transitionend', onEnd);
  }

  function attachRingHandlers(m) {
    const ringEl = ringEls[m];
    let dragStart = null; // { angle, x, y, slot }

    ringEl.addEventListener('pointerdown', (e) => {
      if (animating) return;
      const noteEl = e.target.closest('.note');
      const slot = noteEl ? Number(noteEl.dataset.slot) : null;
      dragStart = {
        angle: angleAt(e.clientX, e.clientY), x: e.clientX, y: e.clientY, slot,
      };
      ringEl.setPointerCapture(e.pointerId);
      ringEl.style.transition = 'none';
      ringEl.classList.add('is-dragging');
    });
    ringEl.addEventListener('pointermove', (e) => {
      if (!dragStart) return;
      const delta = angleAt(e.clientX, e.clientY) - dragStart.angle;
      ringEl.style.transform = `rotate(${delta}deg)`;
    });
    function endDrag(e) {
      if (!dragStart) return;
      const {
        x, y, angle, slot,
      } = dragStart;
      const dist = Math.hypot(e.clientX - x, e.clientY - y);
      const delta = angleAt(e.clientX, e.clientY) - angle;
      dragStart = null;
      ringEl.classList.remove('is-dragging');
      if (dist < TAP_THRESHOLD_PX) {
        // Barely moved: a tap, not a drag. It plays the note under the
        // pointer — a tap on a movable ring's note never reaches the locked
        // ring's own click listener, so this is the only place that can.
        ringEl.style.transition = 'none';
        ringEl.style.transform = 'none';
        if (slot !== null) onNotePlay?.(slot);
        return;
      }
      settleRotate(m, Math.round(delta / degreesPerStep));
    }
    ringEl.addEventListener('pointerup', endDrag);
    ringEl.addEventListener('pointercancel', endDrag);

    ringEl.tabIndex = 0;
    ringEl.setAttribute('role', 'group');
    ringEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!animating) onRotate?.(m, -1);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!animating) onRotate?.(m, 1);
      }
    });
  }

  /** Rebuild the ring elements for a new k. Call before the first render() at that k. */
  function setMode(newK) {
    k = newK;
    degreesPerStep = 30 * k;
    svg.textContent = '';
    ringEls = [];
    for (let r = 0; r < k; r += 1) {
      const g = svgEl('g', {
        class: `ring ring--${r === 0 ? 'locked' : 'movable'}`,
      });
      if (r > 0) {
        g.setAttribute('aria-label', `Ring ${r}, movable. Drag or use arrow keys to rotate.`);
      } else {
        g.setAttribute('aria-label', 'Locked ring. Does not rotate.');
      }
      svg.appendChild(g);
      ringEls.push(g);
      if (r > 0) attachRingHandlers(r);
    }
  }

  return {
    render, setMode, highlightSlot,
  };
}
