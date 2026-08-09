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
 * Browsers refuse to make sound before a user gesture, so the synth is built
 * lazily on first use (ensureAudio()) rather than at module load — Tone.start()
 * must be called from inside a click handler's call stack to count.
 *
 * Play-through is scheduled on Tone's own clock rather than setTimeout:
 * Transport.scheduleOnce() places each note on the audio callback's precise
 * timeline (immune to JS main-thread jitter), and Tone.Draw defers the
 * matching circle highlight to the next animation frame at that same
 * audio-clock time, so the visual stays locked to what's actually sounding.
 * Only the no-audio fallback path (Tone missing/blocked) falls back to plain
 * timers, since there is no audio clock to lock to in that case anyway.
 */

let synth = null;
let transport = null;
let draw = null;
let ready = false;
let unavailable = false;

async function ensureAudio() {
  if (ready) return true;
  if (unavailable) return false;
  if (typeof window.Tone === 'undefined') {
    unavailable = true;
    return false;
  }
  try {
    await window.Tone.start();
    // A soft, plucked/mallet-like tone — clear enough to hear an interval
    // pattern without the harmonic clutter a piano sample would add.
    synth = new window.Tone.PolySynth(window.Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.005, decay: 0.25, sustain: 0.05, release: 0.4,
      },
    }).toDestination();
    transport = window.Tone.getTransport();
    draw = window.Tone.getDraw();
    ready = true;
    return true;
  } catch {
    unavailable = true;
    return false;
  }
}

/** False once Tone.js is confirmed missing, blocked, or broken. */
export function isAvailable() {
  return !unavailable;
}

/** Play a single MIDI note number (as placeRegister() returns) for `duration` seconds. */
export async function playMidi(midi, duration = 0.5) {
  const ok = await ensureAudio();
  if (!ok) return;
  try {
    synth.triggerAttackRelease(window.Tone.Frequency(midi, 'midi').toFrequency(), duration);
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
          synth.triggerAttackRelease(window.Tone.Frequency(midi, 'midi').toFrequency(), duration, time);
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
