/**
 * circle.js — the twelve-note circle: SVG rendering and interaction.
 *
 * Geometry, not layout: twelve fixed angular slots, 30 degrees apart. Which
 * of the two rings owns a slot is groupOfSlot(slot, k) — fixed forever,
 * independent of the interval sequence (SPEC.md §6). What changes when the
 * cycle changes is which pitch class sits in each slot: pitchClasses(iv, t)
 * assigns pitch classes to slots in generative order, and for k = 2 every
 * candidate interval is odd, so slot parity is pitch-class parity — group 0
 * always gets one whole-tone hexachord and group 1 the other, regardless of
 * which two intervals are chosen. That's why the "locked" ring never visibly
 * moves under rotateGroup: its six pitch classes and their order are
 * invariant. The "movable" ring's six notes cycle rigidly among their own
 * six slots, 60 degrees at a time - a rotation of the ring, not a re-layout.
 *
 * Rendering therefore just places pitchClasses(iv, t)[slot] at slot's fixed
 * angle, on whichever radius groupOfSlot gives it, every time the state
 * changes - and animates the *movable* group's <g> spinning through the
 * delta, or the whole drawing mirroring left-right for direction reversal
 * (reverseDirection is exactly retrograde: reverse the traversal, which
 * reverses the cyclic order painted around both rings - the same figure,
 * mirrored, at a different catalogue entry).
 */
import * as CC from '../src/cycles.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const K = 2;
const CX = 150;
const CY = 150;
const R_LOCKED = 86;
const R_MOVABLE = 124;
const DOT_R = 17;
const HIT_R = 25;
const ROTATE_MS = 280;
const SETTLE_MS = 180;
const FLIP_MS = 320;

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

export function mountCircle(root, { onRotate }) {
  const svg = svgEl('svg', {
    viewBox: '0 0 300 300',
    class: 'circle-svg',
    'aria-hidden': 'true',
    focusable: 'false',
  });

  const lockedGroup = svgEl('g', { class: 'ring ring--locked' });
  const movableGroup = svgEl('g', { class: 'ring ring--movable' });
  svg.append(lockedGroup, movableGroup);
  root.appendChild(svg);

  let animating = false;

  function draw(intervals, transposition) {
    lockedGroup.textContent = '';
    movableGroup.textContent = '';
    const pcs = CC.pitchClasses(intervals, transposition);
    for (let slot = 0; slot < 12; slot += 1) {
      const isLocked = CC.groupOfSlot(slot, K) === 0;
      const radius = isLocked ? R_LOCKED : R_MOVABLE;
      const { x, y } = slotPoint(slot, radius);
      const note = svgEl('g', {
        class: `note note--${isLocked ? 'locked' : 'movable'}`,
        transform: `translate(${x} ${y})`,
      });
      const hit = svgEl('circle', { r: HIT_R, class: 'note__hit' });
      const shape = isLocked
        ? svgEl('circle', { r: DOT_R, class: 'note__shape' })
        : svgEl('rect', {
          x: -DOT_R * 0.82,
          y: -DOT_R * 0.82,
          width: DOT_R * 1.64,
          height: DOT_R * 1.64,
          transform: 'rotate(45)',
          class: 'note__shape',
        });
      const label = svgEl('text', {
        class: 'note__label', 'text-anchor': 'middle', dy: '0.32em',
      });
      label.textContent = CC.PITCH_NAMES[pcs[slot]];
      note.append(hit, shape, label);
      (isLocked ? lockedGroup : movableGroup).appendChild(note);
    }
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
    if (meta.type === 'rotate' && meta.steps) {
      animateTransform(
        movableGroup,
        `rotate(${meta.steps * 60}deg)`,
        ROTATE_MS,
        () => draw(state.intervals, state.transposition),
      );
    } else if (meta.type === 'reverse') {
      animateTransform(
        svg,
        'scale(-1, 1)',
        FLIP_MS,
        () => draw(state.intervals, state.transposition),
      );
    } else {
      draw(state.intervals, state.transposition);
    }
  }

  // --- Drag-to-rotate on the movable ring -----------------------------
  const angleAt = (clientX, clientY) => {
    const rect = svg.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    return Math.atan2(dy, dx) * (180 / Math.PI);
  };

  let dragStartAngle = null;

  function settleRotate(steps) {
    const targetDeg = steps * 60;
    const already = movableGroup.style.transform === `rotate(${targetDeg}deg)`
      || (targetDeg === 0 && (movableGroup.style.transform === '' || movableGroup.style.transform === 'none'));
    const finish = () => {
      movableGroup.style.transition = 'none';
      movableGroup.style.transform = 'none';
      animating = false;
      if (steps !== 0) onRotate(steps);
    };
    if (already) { finish(); return; }
    animating = true;
    movableGroup.style.transition = `transform ${SETTLE_MS}ms ease`;
    movableGroup.style.transform = `rotate(${targetDeg}deg)`;
    const onEnd = (e) => {
      if (e.target !== movableGroup) return;
      movableGroup.removeEventListener('transitionend', onEnd);
      finish();
    };
    movableGroup.addEventListener('transitionend', onEnd);
  }

  movableGroup.addEventListener('pointerdown', (e) => {
    if (animating) return;
    dragStartAngle = angleAt(e.clientX, e.clientY);
    movableGroup.setPointerCapture(e.pointerId);
    movableGroup.style.transition = 'none';
    movableGroup.classList.add('is-dragging');
  });
  movableGroup.addEventListener('pointermove', (e) => {
    if (dragStartAngle === null) return;
    const delta = angleAt(e.clientX, e.clientY) - dragStartAngle;
    movableGroup.style.transform = `rotate(${delta}deg)`;
  });
  function endDrag(e) {
    if (dragStartAngle === null) return;
    const delta = angleAt(e.clientX, e.clientY) - dragStartAngle;
    dragStartAngle = null;
    movableGroup.classList.remove('is-dragging');
    settleRotate(Math.round(delta / 60));
  }
  movableGroup.addEventListener('pointerup', endDrag);
  movableGroup.addEventListener('pointercancel', endDrag);

  return { render };
}
