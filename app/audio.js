/**
 * audio.js — Tone.js wrapper for clicking notes and playing a cycle through.
 *
 * Tone.js loads as a plain <script> tag from a CDN (index.html), so
 * `window.Tone` may be undefined — blocked by an ad blocker, offline, or the
 * CDN having a bad day. Every export here degrades to a silent no-op rather
 * than throwing when that happens (SPEC.md's Phase 3 brief: audio failing
 * must never break the interface), and play-through still runs its visual
 * highlight callback even with no sound, so the tool stays usable muted.
 *
 * Browsers refuse to make sound before a user gesture, so the instrument is
 * built lazily on first use (ensureAudio()) rather than at module load —
 * Tone.start() must be called from inside a click handler's call stack to
 * count. The instrument is normally the Salamander Grand Piano, fetched as
 * mp3s from Tone.js's own sample CDN the first time that gesture happens;
 * onLoadingChange()/isLoading() let the UI show a brief "loading" state
 * while that fetch is in flight. If the samples fail outright, or enough of
 * them stall that the load doesn't finish within PIANO_LOAD_TIMEOUT_MS
 * (a dropped connection looks exactly like a very slow one, so a timeout is
 * the only way to tell), loadPiano() resolves to null and ensureAudio()
 * falls back to the plain synth that used to be the only option — same
 * fallback used when Tone itself is missing.
 *
 * Play-through is scheduled on Tone's own clock rather than setTimeout:
 * Transport.scheduleOnce() places each note on the audio callback's precise
 * timeline (immune to JS main-thread jitter), and Tone.Draw defers the
 * matching circle highlight to the next animation frame at that same
 * audio-clock time, so the visual stays locked to what's actually sounding.
 * Only the no-audio fallback path (Tone missing/blocked) falls back to plain
 * timers, since there is no audio clock to lock to in that case anyway.
 */

const PIANO_BASE_URL = 'https://tonejs.github.io/audio/salamander/';
const PIANO_URLS = {
  A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
  A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
  A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
  A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
  A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
  A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
  A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
  A7: 'A7.mp3', C8: 'C8.mp3',
};
const PIANO_LOAD_TIMEOUT_MS = 10000;

let instrument = null;
let transport = null;
let draw = null;
let ready = false;
let unavailable = false;
let loading = false;
const loadingListeners = new Set();

function setLoading(next) {
  if (loading === next) return;
  loading = next;
  for (const fn of loadingListeners) fn(loading);
}

/** Subscribe to piano-sample loading state. Returns an unsubscribe function. */
export function onLoadingChange(fn) {
  loadingListeners.add(fn);
  return () => loadingListeners.delete(fn);
}

/** True while the Salamander piano samples are being fetched. */
export function isLoading() {
  return loading;
}

// A soft, plucked/mallet-like tone — the pre-Sampler default, kept as the
// fallback for when the piano samples can't be used.
function buildFallbackSynth() {
  return new window.Tone.PolySynth(window.Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 0.005, decay: 0.25, sustain: 0.05, release: 0.4,
    },
  }).toDestination();
}

// Resolves to a ready Sampler, or null if the samples errored or stalled —
// never rejects, so a piano-load problem can't be mistaken by ensureAudio()
// for Tone itself being unavailable.
function loadPiano() {
  return new Promise((resolve) => {
    let settled = false;
    let sampler = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    try {
      sampler = new window.Tone.Sampler({
        urls: PIANO_URLS,
        release: 1,
        baseUrl: PIANO_BASE_URL,
        onload: () => finish(sampler),
        onerror: () => {
          if (settled) return;
          sampler.dispose();
          finish(null);
        },
      }).toDestination();
    } catch {
      finish(null);
      return;
    }
    setTimeout(() => {
      if (settled) return;
      sampler.dispose();
      finish(null);
    }, PIANO_LOAD_TIMEOUT_MS);
  });
}

async function ensureAudio() {
  if (ready) return true;
  if (unavailable) return false;
  if (typeof window.Tone === 'undefined') {
    unavailable = true;
    return false;
  }
  try {
    await window.Tone.start();
    setLoading(true);
    const piano = await loadPiano();
    setLoading(false);
    instrument = piano ?? buildFallbackSynth();
    transport = window.Tone.getTransport();
    draw = window.Tone.getDraw();
    ready = true;
    return true;
  } catch {
    setLoading(false);
    unavailable = true;
    return false;
  }
}

/** False once Tone.js is confirmed missing, blocked, or broken. */
export function isAvailable() {
  return !unavailable;
}

/**
 * True for MIDI note numbers that exist at all (0-127 — SPEC.md's Phase 3.1
 * brief: a literal realisation can run tens of semitones past either end).
 * Callers skip these notes rather than clamping them into range, which would
 * misrepresent the interval pattern by sounding the wrong pitch.
 */
export const isPlayable = (midi) => midi >= 0 && midi <= 127;

/** Play a single MIDI note number (as placeRegister() returns) for `duration` seconds. */
export async function playMidi(midi, duration = 0.5) {
  if (!isPlayable(midi)) return;
  const ok = await ensureAudio();
  if (!ok) return;
  try {
    instrument.triggerAttackRelease(window.Tone.Frequency(midi, 'midi').toFrequency(), duration);
  } catch {
    // A single failed note should never break the interface.
  }
}

let currentRun = null; // { stopped } for the in-flight play-through, if any
let fallbackTimeouts = []; // only used when Tone is unavailable

/** Cancel any in-progress play-through. Safe to call when nothing is playing. */
export function stopSequence() {
  if (!currentRun) return;
  currentRun.stopped = true;
  currentRun = null;
  if (transport) { transport.stop(); transport.cancel(); }
  if (draw) draw.cancel();
  for (const t of fallbackTimeouts) clearTimeout(t);
  fallbackTimeouts = [];
}

export function isPlaying() {
  return currentRun !== null;
}

/**
 * Play a sequence of MIDI notes (as placeRegister() returns, one per step)
 * spaced `msPerNote` apart — one note per beat, so Transport.bpm ends up
 * exactly the tempo the slider shows. `onNote(index, midi)` fires at each
 * step — for highlighting the corresponding slot on the circle — whether or
 * not audio is actually available, so play-through stays useful muted.
 * `onDone` fires once after the last note.
 */
export async function playSequence(notes, msPerNote, { onNote, onDone } = {}) {
  stopSequence();
  // Marked before the await, not after, so isPlaying() is true as soon as
  // this is called — synchronously, from the caller's point of view — and a
  // Stop click during Tone's async startup still lands (every callback below
  // checks run.stopped before doing anything).
  const run = { stopped: false };
  currentRun = run;
  const ok = await ensureAudio();
  if (run.stopped) return; // stopped while Tone was still starting up

  const secondsPerNote = msPerNote / 1000;
  const duration = Math.min(0.6, secondsPerNote * 0.85);

  const announce = (i, midi) => {
    if (run.stopped) return;
    onNote?.(i, midi);
    if (i === notes.length - 1) {
      if (currentRun === run) currentRun = null;
      // A natural finish doesn't go through stopSequence(), so the transport
      // has to be reset here too — otherwise it keeps ticking past the end
      // of the sequence, and the next playSequence() schedules its notes at
      // transport positions already in the past.
      if (ok) { transport.stop(); transport.cancel(); }
      onDone?.();
    }
  };

  if (ok) {
    transport.bpm.value = 60 / secondsPerNote;
    notes.forEach((midi, i) => {
      transport.scheduleOnce((time) => {
        if (run.stopped) return;
        try {
          if (isPlayable(midi)) {
            instrument.triggerAttackRelease(window.Tone.Frequency(midi, 'midi').toFrequency(), duration, time);
          }
        } catch {
          // A single failed note should never break the interface.
        }
        // Deferred to the next animation frame at the note's own audio-clock
        // time, rather than fired immediately from this scheduler callback,
        // so the highlight lands in step with what's actually sounding.
        draw.schedule(() => announce(i, midi), time);
      }, i * secondsPerNote);
    });
    transport.start();
  } else {
    // No audio clock to lock to — plain timers keep play-through visually
    // functional even when Tone is blocked or missing.
    notes.forEach((midi, i) => {
      fallbackTimeouts.push(setTimeout(() => announce(i, midi), i * msPerNote));
    });
  }
}
