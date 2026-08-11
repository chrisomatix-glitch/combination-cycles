/**
 * state.js — application state and URL serialisation.
 *
 * State is exactly what the engine says it is: the interval sequence plus a
 * transposition (SPEC.md §6). Phase 1 fixed the transposition at 0 — a
 * cycle's catalogue identity does not depend on it, and no control here needs
 * to change it — and Phase 2 carries that forward unchanged, so it never
 * appears as a UI control, only as the fixed third field the engine's
 * serialise()/parse() pair expects.
 *
 * k is not stored separately: it is always state.intervals.length, and the
 * permalink already carries it (i= lists k numbers), so switching modes needs
 * no new serialisation (SPEC.md's Phase 2 brief).
 */
import * as CC from '../src/cycles.js';
import { peekCatalogue } from './catalogueCache.js';

export const MODES = [2, 3, 4, 6];
const TRANSPOSITION = 0;

let state = null;
const listeners = new Set();

/** The circle-of-fifths position for k intervals: all perfect fifths, degenerate by design. */
const defaultIntervals = (k) => Array(k).fill(7);

function fromLocation() {
  const raw = window.location.search || window.location.hash;
  const parsed = raw ? CC.parse(raw) : null;
  if (parsed && MODES.includes(parsed.intervals.length)) return parsed;
  return { intervals: defaultIntervals(2), transposition: TRANSPOSITION };
}

function syncUrl() {
  window.history.replaceState(null, '', `?${CC.serialise(state)}`);
}

function emit(meta) {
  syncUrl();
  for (const fn of listeners) fn(state, meta);
}

/** Read the initial state from the URL, or fall back to the k=2 default. */
export function initState() {
  state = fromLocation();
  syncUrl();
  return state;
}

export function getState() {
  return state;
}

/** The current number of intervals — always state.intervals.length. */
export function getK() {
  return state.intervals.length;
}

/** Called on every state change, with the new state and a description of what changed. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Switch to k intervals, resetting to that family's circle-of-fifths
 * position — all perfect fifths, the natural home position and, at every k,
 * a degenerate cycle (SPEC.md's Phase 2 brief).
 */
export function setMode(k) {
  if (!MODES.includes(k)) throw new RangeError(`unsupported mode k=${k}`);
  state = { intervals: defaultIntervals(k), transposition: TRANSPOSITION };
  emit({ type: 'mode', k });
}

/**
 * How many degrees the ring for group `m` visually turns on screen for a
 * given engine step count, derived from the engine rather than assumed.
 *
 * rotateGroup's `steps` argument is a step count in *interval-sequence*
 * space, not screen space: the circle draws pitchClasses(iv, 0)[slot] at a
 * fixed angular slot, so the actual on-screen displacement depends on where
 * the note that ends up at slot `m` came from. The cycle's dial-sum can be
 * one of two complementary families (moving between them is exactly what
 * CC.reverseDirection or CC.invert do), and the same `steps` sign can spin a
 * ring opposite ways depending on which family the current cycle is in. This
 * is the ground truth; nothing upstream should assume a fixed degrees-per-step
 * sign. It works unchanged for any k and any movable group m — only the
 * caller varies.
 */
export function visualDegrees(intervals, m, steps) {
  const next = CC.rotateGroup(intervals, m, steps);
  if (!next) return 0;
  const before = CC.pitchClasses(intervals, 0);
  const after = CC.pitchClasses(next, 0);
  const from = before.indexOf(after[m]);
  let slots = (m - from + 12) % 12;
  if (slots > 6) slots -= 12;
  return slots * 30;
}

/** The engine step count that produces `visualSteps` of on-screen rotation of ring `m` (positive = clockwise). */
export function engineStepsFor(intervals, m, visualSteps) {
  const sign = visualDegrees(intervals, m, 1) > 0 ? 1 : -1;
  return visualSteps * sign;
}

/**
 * Rotate movable ring `m` by `visualSteps` positions of 12/k, where positive
 * is always clockwise on screen regardless of which dial-sum family the
 * current cycle is in.
 *
 * `instant` marks a rotation that arrives already visually settled — a
 * released drag, which circle.js has already animated from wherever the
 * pointer let go to the nearest snap position — so the renderer should just
 * redraw rather than replay the full step animation on top of it (SPEC.md's
 * Phase 3 brief). Button and keyboard rotation leave it false, where the full
 * animation is correct because the ring starts at rest.
 */
export function rotateVisual(m, visualSteps, { instant = false } = {}) {
  const prev = state.intervals;
  const steps = engineStepsFor(prev, m, visualSteps);
  const next = CC.rotateGroup(prev, m, steps);
  if (!next) return; // illegal rotations should not occur, but the engine is the judge
  state = { ...state, intervals: next };
  emit({
    type: 'rotate', m, steps, from: prev, degrees: visualDegrees(prev, m, steps), instant,
  });
}

/**
 * Invert the cycle. `invert()` lands exactly on the catalogue partner every
 * time — k-n becomes k-nI and back — and is its own inverse, so pressing it
 * twice returns the exact starting state. Rotation plus pairwise swaps plus
 * invert still reaches every ordered form, exactly as rotation plus swaps
 * plus reverseDirection did (SPEC.md's Phase 3 brief).
 */
export function invert() {
  state = { ...state, intervals: CC.invert(state.intervals) };
  emit({ type: 'invert' });
}

/** Set dial `index` to `value`, compensating into a neighbouring dial. */
export function setDialValue(index, value) {
  const next = CC.setDial(state.intervals, index, value);
  if (!next) return; // dials.js only offers legal values, but the engine is the judge
  state = { ...state, intervals: next };
  emit({ type: 'dial', index, value });
}

/**
 * Swap movable rings `m1` and `m2` — the control that makes the full space
 * reachable (SPEC.md's Phase 2 brief, and CC.reorderGroups' own comment: 6 of
 * 39 four-interval cycles are reachable by rotation alone).
 */
export function swapRings(m1, m2) {
  const k = state.intervals.length;
  if (m1 === m2 || !CC.isMovableGroup(m1, k) || !CC.isMovableGroup(m2, k)) return;
  const next = CC.swapGroups(state.intervals, m1, m2);
  if (!next) return; // every pairwise swap is verified legal, but the engine is the judge
  state = { ...state, intervals: next };
  emit({ type: 'swap', m1, m2 });
}

/**
 * Jump to a uniformly random cycle at the current k. Degenerate cycles are
 * excluded by default — otherwise this keeps landing on the chromatic scale
 * or the circle of fifths, which is a much smaller and less interesting set
 * than it looks (SPEC.md's Phase 3.1 brief). The genuine-cycle count is never
 * zero at any k (8/60/312/3768 — SPEC.md §2), so the pool is never empty.
 *
 * Uses catalogueCache's memoised CC.allCycles(k) when it's already been
 * built (always true at k = 6 by the time this can be called — the mode
 * switch awaits ensureCatalogue() first) and falls back to calling the
 * engine directly otherwise, so this stays correct even if something calls
 * randomise() for a k that was never explicitly warmed.
 */
export function randomise({ includeDegenerate = false } = {}) {
  const k = state.intervals.length;
  const all = peekCatalogue(k)?.allCycles || CC.allCycles(k);
  const pool = all.filter((iv) => includeDegenerate || !CC.isDegenerate(iv));
  const choice = pool[Math.floor(Math.random() * pool.length)];
  state = { ...state, intervals: choice };
  emit({ type: 'randomise' });
}

/** Re-read state from the URL (e.g. on popstate) and notify listeners. */
export function reloadFromLocation() {
  state = fromLocation();
  emit({ type: 'init' });
  return state;
}
