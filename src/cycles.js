/**
 * cycles.js — symmetrical twelve-note combination cycles
 * ======================================================
 *
 * Dependency-free ES module. No build step. Import with:
 *     <script type="module"> import * as CC from './cycles.js'; </script>
 *
 * THEORY
 * ------
 * A k-interval combination cycle is an ordered sequence of k intervals which,
 * repeated 12/k times, traverses all twelve pitch classes exactly once and
 * returns to the start.
 *
 * The twelve notes fall into k groups, and those groups are exactly the
 * residue classes mod k:
 *     k = 2  ->  the two whole-tone hexachords
 *     k = 3  ->  the three diminished quartads
 *     k = 4  ->  the four augmented triads
 *     k = 6  ->  the six tritone dyads
 *
 * An interval may not be congruent to 0 (mod k), since that would step to a
 * note in the same group. This is why m3 and A4 are barred at k = 3, and M3
 * and m6 at k = 4 — a fact that falls straight out of the group structure
 * rather than needing to be stipulated.
 *
 * EQUIVALENCE
 * -----------
 * Rotations of the interval sequence are NOT distinct: M6-m2 is the m2-M6
 * cycle entered from a different note. Inversions ARE distinct, because a
 * cycle and its inversion are different compositional objects.
 *
 * This is a finer partition than Berliner, Castro, Merritt & Southard (2018),
 * "Expanded interval cycles", J. Math & Music 12(1), 21-33, who additionally
 * quotient by retrograde because their equivalence is defined on the figure
 * inscribed in the circle. Their counts and ours therefore differ:
 *
 *     k        here        Berliner et al.
 *     2           2                     2
 *     3          10                     8
 *     4          39                    28
 *     6         314                   184
 *
 * (counts of genuinely-k-interval cycles; see CATALOGUE below for how
 * degenerate cycles are handled.) berlinerId() gives the concordance.
 *
 * NAMING
 * ------
 *     `k-n`   prime form,  ordinal by lexicographic order of the intervals
 *     `k-nI`  its inversion
 *
 * No cycle at any k is its own inversion, so every ordinal has exactly two
 * members. Rotations need no notation. Append a transposition index for a
 * specific pitch realisation: `3-5I T7`.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Canonical interval name per semitone count. */
export const INTERVAL_NAMES = [
  'P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7',
];

/** Letter-name advance implied by each canonical interval (for spelling). */
const LETTER_STEPS = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];

/** Conventional fixed spelling, as used on the circle display. */
export const PITCH_NAMES = [
  'C', 'D\u266D', 'D', 'E\u266D', 'E', 'F',
  'F\u266F', 'G', 'A\u266D', 'A', 'B\u266D', 'B',
];

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

/** The values of k that produce a valid cycle over twelve notes. */
export const VALID_K = [1, 2, 3, 4, 6];

export const intervalName = (semitones) => INTERVAL_NAMES[mod(semitones, 12)];
export const cycleName = (iv) => iv.map(intervalName).join('-');

const mod = (n, m) => ((n % m) + m) % m;

// ---------------------------------------------------------------------------
// Validity
// ---------------------------------------------------------------------------

/**
 * True if the interval sequence traverses all twelve pitch classes exactly
 * once and closes. This is the full test, not a shortcut: for k >= 3 the
 * per-interval rule (i !== 0 mod k) is necessary but not sufficient.
 */
export function isValidCycle(iv) {
  const k = iv.length;
  if (!VALID_K.includes(k)) return false;
  if (iv.some((x) => !Number.isInteger(x) || x < 1 || x > 11)) return false;
  const seen = new Set();
  let p = 0;
  for (let rep = 0; rep < 12 / k; rep++) {
    for (const x of iv) {
      if (seen.has(p)) return false;
      seen.add(p);
      p = mod(p + x, 12);
    }
  }
  return p === 0 && seen.size === 12;
}

/** Intervals that may legally appear anywhere in a k-interval cycle. */
export function candidateIntervals(k) {
  const out = [];
  for (let i = 1; i <= 11; i++) if (mod(i, k) !== 0) out.push(i);
  return out;
}

/**
 * True if the cycle is a shorter cycle repeated — the chromatic scale dressed
 * as m2-m2-m2-m2, say. These are kept in the catalogue but flagged, because
 * the continuum from the circle of fifths through to the chromatic scale is
 * the point; hiding them would leave a hole in it.
 */
export function reducesTo(iv) {
  const k = iv.length;
  for (const d of [1, 2, 3, 4, 6]) {
    if (d >= k || k % d !== 0) continue;
    if (iv.every((x, j) => x === iv[j % d])) return iv.slice(0, d);
  }
  return null;
}

export const isDegenerate = (iv) => reducesTo(iv) !== null;

// ---------------------------------------------------------------------------
// Operations on interval sequences
// ---------------------------------------------------------------------------

export const rotate = (iv, n) => iv.map((_, j) => iv[mod(j + n, iv.length)]);

/**
 * The serial operations. CAUTION: these take INTERVAL sequences, and the
 * reversal and the negation swap places between pitch-class space and interval
 * space. The names are the standard serial ones; the behaviour looks inverted
 * only because of which space the argument lives in.
 *
 *                 on pitch classes      on intervals (what these functions do)
 *   invert  (I)   negate                negate
 *   retro   (R)   reverse               reverse AND negate
 *   retroI  (RI)  reverse and negate    reverse only
 *
 * Why: walking a row backwards takes every step in the opposite direction, so
 * R picks up a negation in interval space. RI negates the pitch classes as
 * well, and the two negations cancel, leaving the intervals merely reversed.
 * Use rowForms() to work in pitch-class space instead, where the operations
 * read the familiar way.
 *
 * For a cycle specifically: R traverses the identical figure, since a closed
 * loop read anticlockwise connects the same twelve edges. That is Berliner's
 * Phi; RI is their tau. I and RI are reflections.
 *
 * R = I(RI), so the four forms fall into two inversion pairs: {P, I} and
 * {RI, R}. Each pair is one of our ordinals, which is why R and RI need no
 * suffix of their own — they already occupy another ordinal's P and I slots.
 */
export const invert = (iv) => iv.map((x) => mod(12 - x, 12));
export const retrograde = (iv) => [...iv].reverse().map((x) => mod(12 - x, 12));
export const retrogradeInversion = (iv) => [...iv].reverse();

const lexLess = (a, b) => {
  for (let j = 0; j < a.length; j++) if (a[j] !== b[j]) return a[j] < b[j];
  return false;
};

/** The lexicographically smallest rotation — our canonical form. */
export function canonical(iv) {
  let best = iv;
  for (let n = 1; n < iv.length; n++) {
    const r = rotate(iv, n);
    if (lexLess(r, best)) best = r;
  }
  return best;
}

/** How far `iv` has been rotated from its canonical form. */
export function rotationIndex(iv) {
  const c = canonical(iv);
  for (let n = 0; n < iv.length; n++) {
    if (rotate(iv, n).every((x, j) => x === c[j])) return n;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Enumeration
// ---------------------------------------------------------------------------

/** Every valid ordered k-interval cycle. */
export function allCycles(k) {
  const cand = candidateIntervals(k);
  const out = [];
  const build = (acc) => {
    if (acc.length === k) {
      if (isValidCycle(acc)) out.push([...acc]);
      return;
    }
    for (const x of cand) build([...acc, x]);
  };
  build([]);
  return out;
}

/** One representative per rotation class, lexicographically ordered. */
export function rotationClasses(k, { includeDegenerate = true } = {}) {
  const seen = new Set();
  const reps = [];
  for (const c of allCycles(k)) {
    if (!includeDegenerate && isDegenerate(c)) continue;
    const key = canonical(c).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    reps.push(canonical(c));
  }
  reps.sort((a, b) => (lexLess(a, b) ? -1 : 1));
  return reps;
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

/**
 * The catalogue for a given k: one ordinal per inversion pair, each with a
 * prime form (`k-n`) and an inversion (`k-nI`).
 */
export function buildCatalogue(k, opts = {}) {
  const reps = rotationClasses(k, opts);
  const berliner = berlinerClasses(k);
  const used = new Set();
  const entries = [];
  let ordinal = 0;

  for (const p of reps) {
    if (used.has(p.join(','))) continue;
    const i = canonical(invert(p));
    used.add(p.join(','));
    used.add(i.join(','));
    ordinal++;
    for (const [form, iv] of [['P', p], ['I', i]]) {
      const red = reducesTo(iv);
      entries.push({
        id: `${k}-${ordinal}${form === 'I' ? 'I' : ''}`,
        k,
        ordinal,
        form,
        intervals: iv,
        name: cycleName(iv),
        partner: `${k}-${ordinal}${form === 'I' ? '' : 'I'}`,
        degenerate: red !== null,
        reducesTo: red ? cycleName(red) : null,
        berliner: berlinerIdFor(iv, berliner),
        retrogradeOf: null, // filled in below, once all ordinals exist
      });
    }
  }

  // Cross-link retrogrades. Reading a cycle backwards lands in another
  // ordinal's slot rather than needing a label of its own, and those are
  // exactly the pairs Berliner et al. merge into one class.
  const byIntervals = new Map(entries.map((e) => [e.intervals.join(','), e]));
  for (const e of entries) {
    const r = byIntervals.get(canonical(retrograde(e.intervals)).join(','));
    e.retrogradeOf = r && r.id !== e.id ? r.id : null;
  }
  return entries;
}

/** Look an arbitrary interval sequence up in the catalogue. */
export function identify(iv, catalogue = null) {
  const cat = catalogue || buildCatalogue(iv.length);
  const c = canonical(iv).join(',');
  return cat.find((e) => e.intervals.join(',') === c) || null;
}

// ---------------------------------------------------------------------------
// Berliner et al. concordance
// ---------------------------------------------------------------------------

/**
 * Their equivalence adds retrograde to ours, so the mapping from our ordinals
 * to theirs is many-to-one: two of our three-interval cycles and eleven of our
 * four-interval cycles collapse into one of theirs. Their representative is the
 * lexicographically smallest member of the larger class, matching their tables.
 * Degenerate cycles are excluded, since they require an irreducible sequence.
 */
export function berlinerClasses(k) {
  const seen = new Set();
  const reps = [];
  for (const c of allCycles(k)) {
    if (isDegenerate(c)) continue;
    const orbit = [];
    for (const f of [c, invert(c), retrograde(c), retrogradeInversion(c)]) {
      for (let n = 0; n < k; n++) orbit.push(rotate(f, n));
    }
    const keys = orbit.map((o) => o.join(','));
    if (keys.some((key) => seen.has(key))) continue;
    keys.forEach((key) => seen.add(key));
    orbit.sort((a, b) => (lexLess(a, b) ? -1 : 1));
    reps.push(orbit[0]);
  }
  reps.sort((a, b) => (lexLess(a, b) ? -1 : 1));
  return reps.map((intervals, n) => ({
    id: `${k}-${n + 1}`, intervals, name: cycleName(intervals),
  }));
}

export function berlinerIdFor(iv, classes = null) {
  const cls = classes || berlinerClasses(iv.length);
  const k = iv.length;
  const orbit = new Set();
  for (const f of [iv, invert(iv), retrograde(iv), retrogradeInversion(iv)]) {
    for (let n = 0; n < k; n++) orbit.add(rotate(f, n).join(','));
  }
  const hit = cls.find((c) => orbit.has(c.intervals.join(',')));
  return hit ? hit.id : null;
}

// ---------------------------------------------------------------------------
// Realisation: pitch classes and register
// ---------------------------------------------------------------------------

/**
 * The four serial row forms of a cycle, as PITCH CLASSES — where the
 * operations read the familiar way: I negates, R reverses, RI does both.
 * This is the form the row matrix needs.
 */
export function rowForms(iv, transposition = 0) {
  const P = pitchClasses(iv, transposition);
  const neg = (r) => r.map((x) => mod(-x, 12));
  const rev = (r) => [...r].reverse();
  return { P, I: neg(P), R: rev(P), RI: neg(rev(P)) };
}

/**
 * How many distinct row forms a cycle admits. A generic twelve-tone row has
 * 48 (twelve transpositions x four operations); the symmetry of a combination
 * cycle collapses that sharply, which is what makes these limiting in a serial
 * context. Rows related by rotation count as one, since a cycle has no
 * beginning. Yields 4k for k >= 3; at k = 2, R and RI coincide with
 * transpositions of I and P, halving it to 4.
 */
export function rowFormCount(iv) {
  const canonRow = (r) => {
    let best = null;
    for (let n = 0; n < 12; n++) {
      const key = r.map((_, j) => r[mod(j + n, 12)]).join(',');
      if (best === null || key < best) best = key;
    }
    return best;
  };
  const seen = new Set();
  const forms = rowForms(iv, 0);
  for (let t = 0; t < 12; t++) {
    for (const r of Object.values(forms)) seen.add(canonRow(r.map((x) => mod(x + t, 12))));
  }
  return seen.size;
}

/** The twelve pitch classes of the cycle, starting from `transposition`. */
export function pitchClasses(iv, transposition = 0) {
  const out = [];
  let p = mod(transposition, 12);
  for (let rep = 0; rep < 12 / iv.length; rep++) {
    for (const x of iv) {
      out.push(p);
      p = mod(p + x, 12);
    }
  }
  return out;
}

/**
 * Place the cycle in register.
 *
 *   'literal'  — every interval taken ascending, as written. Faithful to the
 *                interval names but spans six octaves on average and eleven at
 *                worst (M7-M7), so it is a rhetorical device rather than a
 *                house style. Useful for showing that these are multi-octave
 *                objects, unlike Messiaen's one-octave modes.
 *
 *   'bounded'  — each note placed in the octave nearest a register centre,
 *                ties broken toward the smaller leap. Holds every cycle at
 *                every k inside about one octave, and yields the familiar
 *                up-a-fifth/down-a-fourth realisation of the circle of fifths
 *                for free. Naive nearest-note does NOT work: P4-P4 and P5-P5
 *                accumulate and still span five octaves.
 *
 * Octave placement carries no information about the cycle — a cycle is a
 * sequence of pitch classes — so reduction is lossless and the choice is
 * purely presentational.
 *
 * Returns MIDI-style numbers with `centre` (default 60) as the anchor.
 */
export function placeRegister(iv, {
  mode = 'bounded', transposition = 0, centre = 60, closeCycle = true,
} = {}) {
  const pcs = pitchClasses(iv, transposition);
  if (closeCycle) pcs.push(pcs[0]);
  const out = [centre + mod(pcs[0] - centre, 12) - (mod(pcs[0] - centre, 12) > 6 ? 12 : 0)];

  for (let j = 1; j < pcs.length; j++) {
    const step = mod(pcs[j] - pcs[j - 1], 12);
    if (mode === 'literal') {
      out.push(out[j - 1] + step);
    } else {
      const up = out[j - 1] + step;
      const down = out[j - 1] + step - 12;
      // Nearest the centre; on a tie (tritone) take the smaller leap.
      const du = Math.abs(up - centre);
      const dd = Math.abs(down - centre);
      out.push(du !== dd ? (du < dd ? up : down) : (step <= 6 ? up : down));
    }
  }
  return out;
}

export const registerSpan = (notes) => Math.max(...notes) - Math.min(...notes);

// ---------------------------------------------------------------------------
// Spelling
// ---------------------------------------------------------------------------

/**
 * Note names for a realisation.
 *
 *   'fixed'       — the conventional circle-of-fifths spelling. Stable, and
 *                   what the circle display should use.
 *   'contextual'  — derived from the interval sequence, so that a m3 is always
 *                   spelled as a third. Accidentals accumulate across twelve
 *                   notes (twelve ascending fifths from C end on B#), which is
 *                   correct but needs watching in notation output.
 */
export function spell(iv, { mode = 'fixed', transposition = 0, notes = null } = {}) {
  const pcs = pitchClasses(iv, transposition);
  if (mode === 'fixed') return pcs.map((p) => PITCH_NAMES[p]);

  let letter = LETTERS.indexOf(PITCH_NAMES[mod(transposition, 12)][0]);
  const names = [];
  const midi = notes || placeRegister(iv, { transposition });

  for (let j = 0; j < pcs.length; j++) {
    if (j > 0) {
      const step = mod(pcs[j] - pcs[j - 1], 12);
      const ascending = midi[j] > midi[j - 1];
      letter = mod(letter + (ascending ? LETTER_STEPS[step] : -LETTER_STEPS[mod(12 - step, 12)]), 7);
    }
    const alter = wrapAlter(pcs[j] - LETTER_PC[letter]);
    names.push(LETTERS[letter] + accidental(alter));
  }
  return names;
}

const wrapAlter = (d) => (d > 6 ? d - 12 : d < -6 ? d + 12 : d);
const accidental = (a) => (
  a === 0 ? '' : a === 1 ? '\u266F' : a === -1 ? '\u266D'
    : a === 2 ? '\u00D7' : a === -2 ? '\u266D\u266D' : (a > 0 ? `+${a}` : `${a}`)
);

/** Largest accidental in a spelling — a diagnostic for notation output. */
export function maxAccidental(iv, opts = {}) {
  return Math.max(...spell(iv, { ...opts, mode: 'contextual' }).map((n) => {
    const s = n.slice(1);
    if (s === '\u00D7') return 2;
    if (s === '\u266D\u266D') return 2;
    return s === '' ? 0 : 1;
  }));
}

// ---------------------------------------------------------------------------
// Circle model and interaction
// ---------------------------------------------------------------------------

/**
 * Which group a ring slot belongs to. Groups are residue classes mod k, and
 * the circle of fifths visits them in strict rotation, so slot j holds a note
 * of group (j mod k). Use this for colouring: one palette shared between the
 * circle and the staff makes the relationship between the two self-explaining.
 */
export const groupOfSlot = (slot, k) => mod(slot, k);

/** Pitch classes grouped by ring group, for colouring. */
export function groups(iv, transposition = 0) {
  const pcs = pitchClasses(iv, transposition);
  const k = iv.length;
  const out = Array.from({ length: k }, () => []);
  pcs.forEach((p, j) => out[mod(j, k)].push(p));
  return out;
}

/**
 * Rotate movable group m (1 .. k-1) by `steps` positions.
 *
 * Group m sits between intervals m-1 and m, so rotating it trades semitones
 * between exactly those two dials — the generalisation of "the first dial
 * decreases by a major 2nd, the second increases by a major 2nd". Group 0 is
 * locked; rotating it would only transpose the whole cycle.
 */
export function rotateGroup(iv, m, steps = 1) {
  const k = iv.length;
  if (m < 1 || m > k - 1) throw new RangeError(`group ${m} is not movable for k=${k}`);
  const out = [...iv];
  out[m - 1] = mod(out[m - 1] + k * steps, 12);
  out[m] = mod(out[m] - k * steps, 12);
  return isValidCycle(out) ? out : null;
}

/** How many distinct positions a movable group has. */
export const groupPositions = (k) => 12 / k;

/**
 * Reverse the direction the locked group is traversed — i.e. read the circle
 * anticlockwise. That is the serial retrograde (reverse and negate), so it
 * traverses the identical figure while yielding a different interval sequence,
 * and therefore a different catalogue ordinal. This is the degree of freedom
 * documented by the two columns of the deck's slide 8 ("to D" vs "to Bb"),
 * and without it half the space is unreachable.
 */
export const reverseDirection = (iv) => retrograde(iv);

/**
 * Reassign which group class sits in which ring slot. `perm` is a permutation
 * of [1 .. k-1]. This is the control the original spec was missing: rotation
 * alone reaches only 6 of 39 four-interval cycles, and adding this reaches all
 * 39.
 */
export function reorderGroups(iv, perm) {
  const k = iv.length;
  const slots = [0, ...perm];
  if (new Set(slots).size !== k || slots.some((s) => s < 0 || s > k - 1)) {
    throw new RangeError('perm must be a permutation of 1..k-1');
  }
  const pcs = pitchClasses(iv);
  const byGroup = Array.from({ length: k }, (_, g) => pcs.filter((_, j) => mod(j, k) === g));
  const ring = [];
  for (let j = 0; j < 12; j++) ring.push(byGroup[slots[mod(j, k)]][Math.floor(j / k)]);
  const out = [];
  for (let j = 0; j < k; j++) out.push(mod(ring[(j + 1) % 12] - ring[j], 12));
  return isValidCycle(out) ? out : null;
}

/**
 * The group indices that can be rotated, for a given k. Group 0 is locked —
 * rotating it would only transpose the whole cycle.
 */
export const movableGroups = (k) => Array.from({ length: k - 1 }, (_, j) => j + 1);

export const isMovableGroup = (m, k) => Number.isInteger(m) && m >= 1 && m <= k - 1;

/**
 * Swap two movable groups. This is the interface primitive — swapping any two
 * rings always yields a valid cycle, and rotation plus pairwise swaps plus
 * reversal reaches the whole space at every k, so no permutation picker is
 * needed. A thin wrapper over reorderGroups().
 */
export function swapGroups(iv, a, b) {
  const k = iv.length;
  if (!isMovableGroup(a, k) || !isMovableGroup(b, k)) {
    throw new RangeError(`groups ${a} and ${b} are not both movable for k=${k}`);
  }
  if (a === b) return [...iv];
  return reorderGroups(iv, movableGroups(k).map((m) => (m === a ? b : m === b ? a : m)));
}

/**
 * Set dial `index` to `value`, compensating into a neighbouring dial.
 *
 * Only k-1 of the k dials are ever free: the intervals of a cycle sum to a
 * fixed value (14 semitones for two intervals, 21 for three, 28 for four), so
 * the last is arithmetic. `toward` picks which neighbour absorbs the change;
 * where only one direction is legal the other is refused.
 *
 * Returns null if no legal cycle results — the caller should grey the value out.
 */
export function setDial(iv, index, value, { toward = 'right' } = {}) {
  const k = iv.length;
  const delta = mod(value - iv[index], 12);
  if (delta === 0) return [...iv];
  const other = toward === 'right' ? mod(index + 1, k) : mod(index - 1, k);
  if (other === index) return null;
  const out = [...iv];
  out[index] = mod(value, 12);
  out[other] = mod(out[other] - delta, 12);
  return isValidCycle(out) ? out : null;
}

/** Every value dial `index` can legally take. For greying out the dial face. */
export function legalDialValues(iv, index, opts = {}) {
  const out = [];
  for (let v = 1; v <= 11; v++) if (setDial(iv, index, v, opts)) out.push(v);
  return out;
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

/** Compact permalink state, e.g. "k=3&i=1-4-10&t=7". */
export function serialise({ intervals, transposition = 0 }) {
  return `k=${intervals.length}&i=${intervals.join('-')}&t=${mod(transposition, 12)}`;
}

export function parse(str) {
  const q = new URLSearchParams(str.replace(/^[?#]/, ''));
  const intervals = (q.get('i') || '').split('-').filter(Boolean).map(Number);
  if (!isValidCycle(intervals)) return null;
  return { intervals, transposition: mod(Number(q.get('t') || 0), 12) };
}
