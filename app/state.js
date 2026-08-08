/**
 * state.js — application state and URL serialisation for the two-interval mode.
 *
 * State is exactly what the engine says it is: the interval sequence plus a
 * transposition (SPEC.md §6). Phase 1 fixes the transposition at 0 — a
 * cycle's catalogue identity does not depend on it, and no control here needs
 * to change it — so it never appears as a UI control, only as the fixed
 * third field the engine's serialise()/parse() pair expects.
 */
import * as CC from '../src/cycles.js';

const K = 2;
const DEFAULT_INTERVALS = [7, 7]; // P5-P5: the circle-of-fifths position, degenerate by design
const TRANSPOSITION = 0;
const MOVABLE_GROUP = 1; // k=2's only movable group

let state = null;
const listeners = new Set();

function fromLocation() {
  const raw = window.location.search || window.location.hash;
  const parsed = raw ? CC.parse(raw) : null;
  if (parsed && parsed.intervals.length === K) return parsed;
  return { intervals: [...DEFAULT_INTERVALS], transposition: TRANSPOSITION };
}

function syncUrl() {
  window.history.replaceState(null, '', `?${CC.serialise(state)}`);
}

function emit(meta) {
  syncUrl();
  for (const fn of listeners) fn(state, meta);
}

/** Read the initial state from the URL, or fall back to the default. */
export function initState() {
  state = fromLocation();
  syncUrl();
  return state;
}

export function getState() {
  return state;
}

/** Called on every state change, with the new state and a description of what changed. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * How many degrees the ring for group `m` visually turns on screen for a
 * given engine step count, derived from the engine rather than assumed.
 *
 * rotateGroup's `steps` argument is a step count in *interval-sequence*
 * space, not screen space: the circle draws pitchClasses(iv, 0)[slot] at a
 * fixed angular slot, so the actual on-screen displacement depends on where
 * the note that ends up at slot `m` came from. Because the circle's layout
 * mirrors between the two dial-sum families (SPEC.md's reverseDirection
 * mirrors the whole figure - see circle.js), the same `steps` sign spins the
 * ring opposite ways in the two families. This is the ground truth; nothing
 * upstream should assume 60deg-per-step or a fixed sign.
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

/** The engine step count that produces `visualSteps` of on-screen rotation (positive = clockwise). */
export function engineStepsFor(intervals, m, visualSteps) {
  const sign = visualDegrees(intervals, m, 1) > 0 ? 1 : -1;
  return visualSteps * sign;
}

/**
 * Rotate the movable ring by `visualSteps` positions of 12/k = 6, where
 * positive is always clockwise on screen regardless of which dial-sum
 * family the current cycle is in.
 */
export function rotateVisual(visualSteps) {
  const prev = state.intervals;
  const steps = engineStepsFor(prev, MOVABLE_GROUP, visualSteps);
  const next = CC.rotateGroup(prev, MOVABLE_GROUP, steps);
  if (!next) return; // illegal rotations should not occur at k=2, but the engine is the judge
  state = { ...state, intervals: next };
  emit({ type: 'rotate', steps, from: prev, degrees: visualDegrees(prev, MOVABLE_GROUP, steps) });
}

/** Reverse the direction the locked group is traversed. */
export function reverse() {
  state = { ...state, intervals: CC.reverseDirection(state.intervals) };
  emit({ type: 'reverse' });
}

/** Set dial `index` to `value`, compensating into the other dial. */
export function setDialValue(index, value) {
  const next = CC.setDial(state.intervals, index, value);
  if (!next) return; // dials.js only offers legal values, but the engine is the judge
  state = { ...state, intervals: next };
  emit({ type: 'dial', index, value });
}

/** Re-read state from the URL (e.g. on popstate) and notify listeners. */
export function reloadFromLocation() {
  state = fromLocation();
  emit({ type: 'init' });
  return state;
}
