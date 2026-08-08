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

/** Rotate the one movable group (group 1) by `steps` positions of 12/k = 6. */
export function rotateMovable(steps) {
  const next = CC.rotateGroup(state.intervals, 1, steps);
  if (!next) return; // illegal rotations should not occur at k=2, but the engine is the judge
  state = { ...state, intervals: next };
  emit({ type: 'rotate', steps });
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
