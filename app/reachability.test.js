/**
 * Reachability test (SPEC.md's Phase 2 acceptance criterion 1, carried
 * forward by Phase 3's criterion 2): proves against the engine, not by hand,
 * that rotation + invert + pairwise ring swaps from the circle-of-fifths
 * position reach every ordered form — 12 at k = 2, 64 at k = 3, 324 at k = 4,
 * 3,840 at k = 6 — and that permalinks round-trip at every k. Pairwise swaps
 * are sufficient rather than needing a full permutation picker because
 * transpositions generate the whole symmetric group; this test is the proof,
 * not just an assertion of it.
 *
 * Phase 3 replaced the interface's "reverse direction" control (reverseDirection,
 * the serial retrograde) with "invert" (invert, the serial inversion) — a
 * better fit, since it lands exactly on the cycle's catalogue partner. That
 * swap is why this file uses CC.invert() below rather than
 * CC.reverseDirection(): the reachability claim has to be proved for the
 * control the interface actually offers.
 *
 * Run: node app/reachability.test.js
 */
import * as CC from '../src/cycles.js';

let pass = 0; let fail = 0;
const results = [];
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  ok ? pass++ : fail++;
  results.push({ ok, name, detail: ok ? '' : `got ${a}, expected ${e}` });
}
function assert(name, cond, detail = '') {
  cond ? pass++ : fail++;
  results.push({ ok: !!cond, name, detail });
}

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  for (let i = 0; i < arr.length; i += 1) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) out.push([arr[i], ...p]);
  }
  return out;
}

const range = (n) => Array.from({ length: n }, (_, i) => i);
const cartesian = (arrays) => arrays.reduce(
  (acc, arr) => acc.flatMap((prefix) => arr.map((v) => [...prefix, v])),
  [[]],
);

/**
 * Every ordered form reachable from the circle-of-fifths position via
 * inversion, group reordering (through reorderGroups, standing in for
 * composed pairwise swaps — reorderGroups' perm argument can express any
 * permutation a sequence of pairwise swaps can reach) and independent
 * rotation of every movable ring. This is rotation + swaps + invert, the
 * three controls the interface actually offers as of Phase 3.
 */
function reachableForms(k) {
  const base = Array(k).fill(7);
  const groups = Array.from({ length: k - 1 }, (_, i) => i + 1); // [1 .. k-1]
  const perms = permutations(groups);
  const positions = 12 / k;
  const combos = cartesian(groups.map(() => range(positions)));
  const out = new Set();

  for (const inverted of [false, true]) {
    const start = inverted ? CC.invert(base) : base;
    for (const perm of perms) {
      const isIdentity = perm.every((v, i) => v === groups[i]);
      const reordered = isIdentity ? start : CC.reorderGroups(start, perm);
      if (!reordered) continue;
      for (const combo of combos) {
        let iv = reordered;
        let ok = true;
        for (let i = 0; i < groups.length; i += 1) {
          if (combo[i] === 0) continue;
          iv = CC.rotateGroup(iv, groups[i], combo[i]);
          if (!iv) { ok = false; break; }
        }
        if (ok) out.add(iv.join(','));
      }
    }
  }
  return out;
}

const EXPECTED = {
  2: 12, 3: 64, 4: 324, 6: 3840,
};

for (const k of [2, 3, 4, 6]) {
  const reachable = reachableForms(k);
  const all = new Set(CC.allCycles(k).map((iv) => iv.join(',')));
  check(`k=${k}: reachable-form count`, reachable.size, EXPECTED[k]);
  assert(
    `k=${k}: reachable set is exactly every ordered form the engine enumerates`,
    reachable.size === all.size && [...reachable].every((s) => all.has(s)),
    `reachable ${reachable.size}, engine ${all.size}`,
  );
}

// --- Permalink round-trip at every k (acceptance criterion 5) --------------

for (const k of [2, 3, 4, 6]) {
  for (const iv of CC.allCycles(k)) {
    for (const t of [0, 5, 11]) {
      const str = CC.serialise({ intervals: iv, transposition: t });
      const parsed = CC.parse(str);
      assert(
        `k=${k}: permalink round-trips for [${iv}] t=${t}`,
        !!parsed && parsed.intervals.join(',') === iv.join(',') && parsed.transposition === t,
        parsed ? `got [${parsed.intervals}] t=${parsed.transposition}` : 'parse returned null',
      );
    }
  }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  for (const f of failed) console.log(`  FAIL  ${f.name}\n        ${f.detail}`);
  process.exit(1);
} else {
  console.log('  Every ordered form is reachable at every k, and permalinks round-trip.\n');
}
