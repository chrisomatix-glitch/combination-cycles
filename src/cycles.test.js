/**
 * Test suite for cycles.js
 *
 * The load-bearing tests are the enumeration counts and the diff against
 * Chris's own hand-notated tables (All_Intervals.pdf) and the published
 * Berliner et al. (2018) tables. If the engine ever disagrees with either,
 * that surfaces here rather than in the interface.
 *
 * Run: node cycles.test.js
 */

import * as CC from './cycles.js';

let pass = 0; let fail = 0;
const results = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  ok ? pass++ : fail++;
  results.push({ ok, name, actual: a, expected: e });
}
function assert(name, cond, detail = '') {
  cond ? pass++ : fail++;
  results.push({ ok: !!cond, name, actual: detail, expected: 'true' });
}

// ===========================================================================
// 1. Enumeration counts
// ===========================================================================

const EXPECTED_TOTALS = { 2: 12, 3: 64, 4: 324, 6: 3840 };
const EXPECTED_GENUINE = { 2: 8, 3: 60, 4: 312, 6: 3768 };

for (const k of [2, 3, 4, 6]) {
  const all = CC.allCycles(k);
  check(`k=${k}: total ordered forms`, all.length, EXPECTED_TOTALS[k]);
  check(`k=${k}: genuinely ${k}-interval`,
    all.filter((c) => !CC.isDegenerate(c)).length, EXPECTED_GENUINE[k]);
}

// ===========================================================================
// 2. Rotation classes — these are the entries in Chris's PDF tables
// ===========================================================================

check('k=2: rotation classes, genuine only',
  CC.rotationClasses(2, { includeDegenerate: false }).length, 4);
check('k=3: rotation classes, genuine only',
  CC.rotationClasses(3, { includeDegenerate: false }).length, 20);
check('k=4: rotation classes, genuine only',
  CC.rotationClasses(4, { includeDegenerate: false }).length, 78);

check('k=2: rotation classes, degenerate included',
  CC.rotationClasses(2).length, 8);
check('k=3: rotation classes, degenerate included',
  CC.rotationClasses(3).length, 24);
check('k=4: rotation classes, degenerate included',
  CC.rotationClasses(4).length, 86);

// ===========================================================================
// 3. Catalogue — the deck's counts are these, paired under inversion
// ===========================================================================

for (const [k, genuinePairs] of [[2, 2], [3, 10], [4, 39]]) {
  const cat = CC.buildCatalogue(k, { includeDegenerate: false });
  check(`k=${k}: inversion pairs (deck figure)`, cat.length / 2, genuinePairs);
  assert(`k=${k}: every entry has a distinct partner`,
    cat.every((e) => e.partner !== e.id));
  assert(`k=${k}: no cycle is its own inversion`,
    cat.every((e) => CC.canonical(CC.invert(e.intervals)).join() !== e.intervals.join()));
}

// Full catalogue with degenerate cycles kept in and flagged
check('k=2: full catalogue size', CC.buildCatalogue(2).length, 8);
check('k=3: full catalogue size', CC.buildCatalogue(3).length, 24);
check('k=4: full catalogue size', CC.buildCatalogue(4).length, 86);

const cat2 = CC.buildCatalogue(2);
check('k=2: catalogue reads as expected',
  cat2.map((e) => `${e.id} ${e.name}`),
  ['2-1 m2-m2', '2-1I M7-M7', '2-2 m2-M6', '2-2I m3-M7',
    '2-3 m3-P5', '2-3I P4-M6', '2-4 P4-P4', '2-4I P5-P5']);

assert('k=2: degenerate cycles flagged, not hidden',
  cat2.filter((e) => e.degenerate).length === 4
  && cat2.find((e) => e.name === 'P5-P5').reducesTo === 'P5');

// ===========================================================================
// 4. Diff against All_Intervals.pdf
// ===========================================================================

const PDF_TWO_INTERVAL = [
  'm2-m2', 'm2-M6', 'm3-P5', 'm3-M7', 'P4-P4', 'P4-M6', 'P5-P5', 'M7-M7',
];
check('PDF p.1: two-interval table matches engine',
  CC.rotationClasses(2).map(CC.cycleName).sort(), [...PDF_TWO_INTERVAL].sort());

const PDF_THREE_INTERVAL = [
  'm2-m2-P5', 'm2-M3-M3', 'm2-M3-m7', 'm2-P5-P5', 'm2-m7-M3', 'm2-m7-m7',
  'M2-M2-P4', 'M2-M2-M7', 'M2-P4-m6', 'M2-m6-P4', 'M2-m6-M7', 'M2-M7-m6',
  'M3-M3-P5', 'M3-P5-m7', 'M3-m7-P5',
  'P4-P4-M7', 'P4-m6-m6', 'P4-M7-M7',
  'P5-m7-m7', 'm6-m6-M7',
];
check('PDF p.2: three-interval table matches engine',
  CC.rotationClasses(3, { includeDegenerate: false }).map(CC.cycleName).sort(),
  [...PDF_THREE_INTERVAL].sort());

// ===========================================================================
// 5. Berliner et al. (2018) concordance
// ===========================================================================

const BERLINER = {
  2: [[1, 9], [3, 7]],
  3: [[1, 1, 7], [1, 4, 4], [1, 4, 10], [1, 7, 7], [1, 10, 10],
    [2, 2, 5], [2, 5, 8], [4, 4, 7]],
};
for (const k of [2, 3]) {
  check(`Berliner k=${k}: prime forms reproduced exactly`,
    CC.berlinerClasses(k).map((c) => c.intervals), BERLINER[k]);
}
check('Berliner k=4: class count', CC.berlinerClasses(4).length, 28);
check('Berliner k=6: class count', CC.berlinerClasses(6).length, 184);

// The many-to-one merges: retrograde pairs that they collapse and we do not
for (const [k, ours, theirs] of [[3, 10, 8], [4, 39, 28]]) {
  const cat = CC.buildCatalogue(k, { includeDegenerate: false });
  const primes = cat.filter((e) => e.form === 'P');
  check(`k=${k}: ${ours} ordinals map onto ${theirs} Berliner classes`,
    new Set(primes.map((e) => e.berliner)).size, theirs);
  assert(`k=${k}: every genuine cycle has a Berliner id`,
    primes.every((e) => e.berliner !== null));
}
assert('degenerate cycles carry no Berliner id',
  CC.buildCatalogue(3).filter((e) => e.degenerate).every((e) => e.berliner === null));

// ===========================================================================
// 6. Register placement
// ===========================================================================

const LITERAL_SPANS = {
  'm2-m2': 12, 'm2-M6': 60, 'm3-P5': 60, 'm3-M7': 84,
  'P4-P4': 60, 'P4-M6': 84, 'P5-P5': 84, 'M7-M7': 132,
};
for (const iv of CC.rotationClasses(2)) {
  const name = CC.cycleName(iv);
  check(`literal span of ${name}`,
    CC.registerSpan(CC.placeRegister(iv, { mode: 'literal' })), LITERAL_SPANS[name]);
}

for (const k of [2, 3, 4]) {
  const spans = CC.rotationClasses(k)
    .map((iv) => CC.registerSpan(CC.placeRegister(iv, { mode: 'bounded' })));
  assert(`k=${k}: bounded placement stays inside two octaves`,
    Math.max(...spans) <= 24, `max ${Math.max(...spans)} semitones`);
}

// Bounded placement of P5-P5 should give the familiar up-a-fifth/down-a-fourth
// Bounded placement of P5-P5 gives the familiar alternating realisation:
// a fourth down, a fifth up, repeating — never the seven-octave literal ascent.
check('P5-P5 bounded alternates fourth down / fifth up',
  CC.placeRegister([7, 7], { mode: 'bounded', centre: 60 }).slice(0, 5),
  [60, 55, 62, 57, 64]);

// Placement is lossless: pitch classes survive any register choice
for (const k of [2, 3, 4]) {
  for (const iv of CC.rotationClasses(k)) {
    for (const mode of ['bounded', 'literal']) {
      const pcs = CC.placeRegister(iv, { mode, closeCycle: false })
        .map((n) => ((n % 12) + 12) % 12);
      if (pcs.join() !== CC.pitchClasses(iv).join()) {
        fail++; results.push({ ok: false, name: `lossless ${mode} ${CC.cycleName(iv)}` });
      }
    }
  }
}
assert('register placement is lossless at every k', true);

// ===========================================================================
// 7. Circle interaction
// ===========================================================================

// The deck's own worked example: one step from the circle of fifths gives P4-M6
check('rotating WT2 one step from P5-P5 gives P4-M6',
  CC.cycleName(CC.rotateGroup([7, 7], 1, -1)), 'P4-M6');
check('and the step after that gives m3-M7',
  CC.cycleName(CC.rotateGroup(CC.rotateGroup([7, 7], 1, -1), 1, -1)), 'm3-M7');

// Six positions, returning to the start
let state = [7, 7];
const orbit = [];
for (let n = 0; n < 6; n++) { orbit.push(CC.cycleName(state)); state = CC.rotateGroup(state, 1, -1); }
check('WT2 has six positions and closes',
  [orbit, CC.cycleName(state)],
  [['P5-P5', 'P4-M6', 'm3-M7', 'm2-m2', 'M7-m3', 'M6-P4'], 'P5-P5']);

// Every rotation of every movable group must stay valid
for (const k of [2, 3, 4]) {
  for (const iv of CC.rotationClasses(k)) {
    for (let m = 1; m < k; m++) {
      for (let s = 0; s < CC.groupPositions(k); s++) {
        if (!CC.rotateGroup(iv, m, s)) {
          fail++; results.push({ ok: false, name: `rotateGroup k=${k} ${CC.cycleName(iv)} g${m}+${s}` });
        }
      }
    }
  }
}
assert('every group rotation yields a valid cycle', true);

// Reversal and reordering, together, must reach the whole space
for (const [k, total] of [[2, 12], [3, 64], [4, 324]]) {
  const reached = new Set();
  const perms = permutations([...Array(k - 1)].map((_, j) => j + 1));
  const base = [...Array(k)].map(() => 7).map((x, j) => (j === 0 ? 7 : 7));
  for (const perm of perms) {
    for (const rev of [false, true]) {
      const rots = [...Array(CC.groupPositions(k))].map((_, i) => i);
      walk(base, 1);
      function walk(iv, m) {
        if (m === k) {
          let out = CC.reorderGroups(iv, perm);
          if (!out) return;
          if (rev) out = CC.reverseDirection(out);
          if (CC.isValidCycle(out)) reached.add(out.join(','));
          return;
        }
        for (const s of rots) {
          const nxt = CC.rotateGroup(iv, m, s);
          if (nxt) walk(nxt, m + 1);
        }
      }
    }
  }
  check(`k=${k}: rotations + reordering + reversal reach the whole space`,
    reached.size, total);
}

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  arr.forEach((x, i) => {
    for (const rest of permutations([...arr.slice(0, i), ...arr.slice(i + 1)])) out.push([x, ...rest]);
  });
  return out;
}

// Dials: only k-1 are free, and the sum is conserved
for (const k of [2, 3, 4]) {
  const sums = new Set(CC.rotationClasses(k).map((iv) => iv.reduce((a, b) => a + b, 0) % 12));
  assert(`k=${k}: interval sum takes only two values`, sums.size === 2, [...sums].join());
}
const dialed = CC.setDial([7, 7, 7], 0, 1);
check('setDial compensates into the neighbour', dialed, [1, 1, 7]);
assert('setDial refuses an illegal value', CC.setDial([7, 7, 7], 0, 3) === null);
check('legal values for dial 0 of P5-P5-P5',
  CC.legalDialValues([7, 7, 7], 0).map(CC.intervalName),
  ['m2', 'M3', 'P5', 'm7']);

// ===========================================================================
// 7a. Group-swap utilities: movableGroups, isMovableGroup, swapGroups
// ===========================================================================

for (const k of [2, 3, 4, 6]) {
  check(`k=${k}: movableGroups`,
    CC.movableGroups(k), Array.from({ length: k - 1 }, (_, j) => j + 1));
}

assert('isMovableGroup: accepts every group movableGroups(k) returns',
  [2, 3, 4, 6].every((k) => CC.movableGroups(k).every((m) => CC.isMovableGroup(m, k))));
assert('isMovableGroup: rejects the locked group (0) at every k',
  [2, 3, 4, 6].every((k) => !CC.isMovableGroup(0, k)));
assert('isMovableGroup: rejects k and beyond at every k',
  [2, 3, 4, 6].every((k) => !CC.isMovableGroup(k, k) && !CC.isMovableGroup(k + 1, k)));
assert('isMovableGroup: rejects non-integers',
  !CC.isMovableGroup(1.5, 3) && !CC.isMovableGroup(NaN, 4));

// Exhaustive: every (cycle, pair-of-movable-groups) combination at k = 2, 3,
// 4, 6 — including a === b — agrees with the equivalent reorderGroups() call,
// is always a valid cycle, and is its own inverse. 99,184 swaps total.
let swapsChecked = 0;
for (const k of [2, 3, 4, 6]) {
  const groups = CC.movableGroups(k);
  let allAgree = true;
  let allValid = true;
  let allInvolutions = true;
  let checked = 0;
  for (const iv of CC.allCycles(k)) {
    for (const a of groups) {
      for (const b of groups) {
        checked++;
        const swapped = CC.swapGroups(iv, a, b);
        const perm = groups.map((m) => (m === a ? b : m === b ? a : m));
        const viaReorder = a === b ? [...iv] : CC.reorderGroups(iv, perm);
        if (swapped.join(',') !== viaReorder.join(',')) allAgree = false;
        if (!CC.isValidCycle(swapped)) allValid = false;
        if (CC.swapGroups(swapped, a, b).join(',') !== iv.join(',')) allInvolutions = false;
      }
    }
  }
  swapsChecked += checked;
  assert(`k=${k}: swapGroups agrees with reorderGroups (${checked} combinations)`, allAgree);
  assert(`k=${k}: swapGroups always returns a valid cycle (${checked} combinations)`, allValid);
  assert(`k=${k}: swapGroups is its own inverse (${checked} combinations)`, allInvolutions);
}
assert('swapGroups: exhaustively checked across k=2,3,4,6',
  swapsChecked === 99184, `checked ${swapsChecked} swaps`);

const throws = (fn) => { try { fn(); return false; } catch (e) { return e instanceof RangeError; } };
assert('swapGroups: throws on the locked group',
  throws(() => CC.swapGroups([1, 9], 0, 1)));
assert('swapGroups: throws on an out-of-range group',
  throws(() => CC.swapGroups([1, 4, 10], 1, 3)));

// ===========================================================================
// 8. Groups, spelling, serialisation
// ===========================================================================

check('k=2 groups are the two whole-tone hexachords',
  CC.groups([7, 7]).map((g) => g.sort((a, b) => a - b)),
  [[0, 2, 4, 6, 8, 10], [1, 3, 5, 7, 9, 11]]);
check('k=3 groups are the three diminished quartads',
  CC.groups([7, 7, 7]).map((g) => g.sort((a, b) => a - b)),
  [[0, 3, 6, 9], [1, 4, 7, 10], [2, 5, 8, 11]]);
// Note the ring order: the circle of fifths visits the augmented triads as
// C-Eb-D-Db, not C-Db-D-Eb. Ring slot 1 is the Eb triad. The UI must assign
// rotatable rings by slot, not by the order the triads are listed.
check('k=4 groups are the four augmented triads, in ring order',
  CC.groups([7, 7, 7, 7]).map((g) => g.sort((a, b) => a - b)),
  [[0, 4, 8], [3, 7, 11], [2, 6, 10], [1, 5, 9]]);

check('fixed spelling of the circle of fifths',
  CC.spell([7, 7], { mode: 'fixed' }).join(' '),
  'C G D A E B F\u266F D\u266D A\u266D E\u266D B\u266D F');

const round = CC.parse(CC.serialise({ intervals: [1, 4, 10], transposition: 7 }));
check('permalink round-trips', round, { intervals: [1, 4, 10], transposition: 7 });
assert('permalink rejects an invalid cycle', CC.parse('k=3&i=1-2-3&t=0') === null);

// ===========================================================================

// ===========================================================================
// 9. Serial operations behave as they do for a row, on a cyclic object
// ===========================================================================

const A = [1, 4, 10];
check('I negates in place', CC.cycleName(CC.invert(A)), 'M7-m6-M2');
check('R reverses and negates', CC.cycleName(CC.retrograde(A)), 'M2-m6-M7');
check('RI reverses only', CC.cycleName(CC.retrogradeInversion(A)), 'm7-M3-m2');
assert('R = I(RI)',
  CC.retrograde(A).join() === CC.invert(CC.retrogradeInversion(A)).join());

// Reading a cycle backwards traverses the identical figure
const edges = (iv) => {
  let p = 0; const e = new Set();
  for (let r = 0; r < 12 / iv.length; r++) {
    for (const x of iv) { const q = (p + x) % 12; e.add([p, q].sort((u, v) => u - v).join('-')); p = q; }
  }
  return [...e].sort().join(' ');
};
for (const k of [2, 3, 4]) {
  for (const iv of CC.rotationClasses(k)) {
    if (edges(iv) !== edges(CC.retrograde(iv))) {
      fail++; results.push({ ok: false, name: `R draws same figure: ${CC.cycleName(iv)}` });
    }
  }
}
assert('R always draws the identical figure', true);

// The four serial forms occupy two ordinals: {P, I} and {RI, R}
for (const [k, merges] of [[3, 2], [4, 11]]) {
  const cat = CC.buildCatalogue(k, { includeDegenerate: false });
  const primes = cat.filter((e) => e.form === 'P');
  const otherOrdinal = primes.filter((e) => {
    const o = cat.find((c) => c.id === e.retrogradeOf);
    return o && o.ordinal !== e.ordinal;
  });
  check(`k=${k}: ordinals whose retrograde lands at a different ordinal`,
    otherOrdinal.length, merges * 2);
  assert(`k=${k}: those are exactly the pairs Berliner merges`,
    otherOrdinal.every((e) => {
      const other = cat.find((c) => c.id === e.retrogradeOf);
      return other.berliner === e.berliner;
    }));
}

// ===========================================================================
// 10. Pitch-class space vs interval space
// ===========================================================================

// The operations read the familiar way on pitch classes...
const R3 = CC.rowForms([1, 9]);
check('R reverses the pitch classes', R3.R, [...R3.P].reverse());
check('I negates the pitch classes', R3.I, R3.P.map((x) => (12 - x) % 12));
check('RI does both', R3.RI, [...R3.P].reverse().map((x) => (12 - x) % 12));

// ...and the interval-space functions agree with them, up to rotation.
const ivOf = (row) => row.map((_, j) => (row[(j + 1) % 12] - row[j] + 12) % 12).slice(0, 2);
check('interval-space I matches pitch-class I',
  CC.canonical(CC.invert([1, 9])), CC.canonical(ivOf(R3.I)));
check('interval-space R matches pitch-class R',
  CC.canonical(CC.retrograde([1, 9])), CC.canonical(ivOf(R3.R)));
check('interval-space RI matches pitch-class RI',
  CC.canonical(CC.retrogradeInversion([1, 9])), CC.canonical(ivOf(R3.RI)));

// Row-form counts (deck slide 22: 4, 12, 16 and 24)
check('whole-tone cycle row forms', CC.rowFormCount([1, 9]), 4);
check('diminished-quartad cycle row forms', CC.rowFormCount([1, 4, 10]), 12);
check('augmented-triad cycle row forms', CC.rowFormCount([1, 1, 5, 9]), 16);
check('tritone cycle row forms', CC.rowFormCount([1, 1, 1, 2, 5, 8]), 24);

// 4k is the generic figure, but cycles whose retrograde-inversion is a
// rotation of themselves give half. Slide 22 quotes the generic case.
check('RI-symmetric four-interval cycle halves to 8', CC.rowFormCount([1, 2, 3, 2]), 8);

// ===========================================================================

const failed = results.filter((r) => !r.ok);
console.log(`\n${pass} passed, ${fail} failed\n`);
if (failed.length) {
  for (const f of failed.slice(0, 20)) {
    console.log(`  FAIL  ${f.name}\n        got      ${f.actual}\n        expected ${f.expected}`);
  }
  process.exit(1);
} else {
  console.log('  All enumeration counts, PDF tables and Berliner concordance agree.\n');
}
