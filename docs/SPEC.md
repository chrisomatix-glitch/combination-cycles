# Combination Cycles — implementation spec

Reference document for building the interactive circle-of-fifths tool.
**The engine (`cycles.js`) is frozen. Later phases consume it; they must never
reimplement the theory.** If something appears to need new theory code, it is
almost certainly already in the engine under a different name.

Author: Chris Jeffery · Site: chrisjeffery.co.za

---

## 1. What a combination cycle is

A *k*-interval combination cycle is an ordered sequence of *k* intervals which,
repeated 12/*k* times, traverses all twelve pitch classes exactly once and
returns to the start.

The twelve notes fall into *k* groups, and those groups are exactly the residue
classes mod *k*:

| *k* | Groups | Count |
|---|---|---|
| 2 | whole-tone hexachords | 2 |
| 3 | diminished quartads | 3 |
| 4 | augmented triads | 4 |
| 6 | tritone dyads | 6 |

An interval may not be ≡ 0 (mod *k*) — it would step to a note in the same
group. This is why m3 and A4 are barred at *k* = 3, and M3 and m6 at *k* = 4.
It falls out of the group structure; it is not a separate rule.

One algorithm covers every *k*. Do not special-case 2, 3 and 4.

## 2. Counts (verified, do not recompute by hand)

| *k* | Ordered forms | Genuine | Rotation classes | Ordinals | Berliner classes |
|---|---|---|---|---|---|
| 2 | 12 | 8 | 8 | 4 | 2 |
| 3 | 64 | 60 | 24 | 12 | 8 |
| 4 | 324 | 312 | 86 | 43 | 28 |
| 6 | 3840 | 3768 | 656 | 328 | 184 |

"Genuine" excludes degenerate cycles. "Ordinals" counts inversion pairs with
degenerate cycles included. Excluding degenerates gives 2 / 10 / 39 / 314 —
the figures in the presentation.

## 3. Equivalence and naming

**Rotations collapse; inversions do not.** `M6-m2` *is* the m2-M6 cycle entered
from a different note, so it gets no separate number. A cycle and its inversion
are different compositional objects, so they do.

- `k-n` — prime form, ordinal by lexicographic order of the interval sequence
- `k-nI` — its inversion
- `k-nI T7` — that cycle starting on G

No cycle at any *k* is its own inversion, so every ordinal has exactly two
members, with no exceptions to handle.

**Degenerate cycles are kept and flagged, never hidden.** `P4-P4` is the circle
of fourths wearing a two-interval costume; `m2-m2-m2-m2` is the chromatic
scale. They belong in the catalogue because the continuum from circle of fifths
to chromatic scale is the substantive claim — a gap in the ordinals would break
it. Show a badge reading e.g. "reducible to P4" rather than omitting the entry.

### Retrograde

Reading a cycle backwards is the serial retrograde. Where it lands depends on
the cycle:

| | Ordinals | R stays inside the ordinal | R lands at another ordinal |
|---|---|---|---|
| k=2 | 2 | 2 | 0 |
| k=3 | 10 | 6 | 4 |
| k=4 | 39 | 17 | 22 |

Most ordinals keep their retrograde in-house — 3-1's retrograde is 3-1I. The
right-hand column is exactly the set Berliner et al. merge. Every entry carries
`retrogradeOf`, so the interface can link between them.

The distinguishing property is whether the interval pattern is a **wrap-around
palindrome**: m2-m2-P5 read backwards is P5-m2-m2, the same cyclic pattern from
one step later, whereas m2-M3-m7 read backwards is m7-M3-m2, which is not. All
four whole-tone cycles are palindromic, which is why k=2 has no merges at all.

### Berliner concordance

Berliner, Castro, Merritt & Southard (2018), *Expanded interval cycles*,
J. Math & Music 12(1), 21–33, additionally quotient by retrograde, because
their equivalence is defined on the figure inscribed in the circle. The mapping
from our ordinals to theirs is therefore **many-to-one**: two three-interval
pairs merge (3-4 with 3-6, 3-9 with 3-10) and eleven four-interval pairs.

Carry `berliner` as a metadata field on every entry and display it. Degenerate
cycles have no Berliner id (their scheme requires an irreducible sequence).

## 3a. Serial operations — mind the space

The serial operations are defined on PITCH CLASSES. The engine's `invert`,
`retrograde` and `retrogradeInversion` take INTERVAL sequences, and the
negation changes place between the two spaces:

| | On pitch classes | On intervals |
|---|---|---|
| I | negate | negate |
| R | reverse | reverse **and** negate |
| RI | reverse and negate | reverse only |

Walking a row backwards takes every step in the opposite direction, so R picks
up a negation in interval space. RI negates the pitch classes too and the two
negations cancel, leaving the intervals merely reversed. The function names are
the standard serial ones; only the argument's space differs.

**Use `rowForms(iv, t)` for anything matrix-related** — it returns P, I, R and
RI as pitch classes, where the operations read the familiar way.

### Row-form counts

A generic twelve-tone row has 48 forms. Combination cycles collapse to 4k
(rows related by rotation counting as one, since a cycle has no beginning), and
palindromic cycles halve that again because RI stops being a new family:

| | Generic | Palindromic | How many are palindromic |
|---|---|---|---|
| Whole tone | 4 | — | 4 of 4 |
| Diminished quartad | 12 | 6 | 12 of 20 |
| Augmented triad | 16 | 8 | 34 of 78 |
| Tritone | 24 | 12 | 108 of 628 |

`rowFormCount(iv)` returns this. It is a column in the generated catalogue.

## 4. Register and notation

Octave placement carries **no information** about a cycle — a cycle is a
sequence of pitch classes. Reduction is therefore lossless and the choice is
purely presentational.

- **`bounded`** (default) — each note placed in the octave nearest a register
  centre, ties broken toward the smaller leap. Holds every cycle at every *k*
  inside about one octave, and produces the familiar alternating realisation of
  the circle of fifths automatically.
- **`literal`** — every interval ascending as written. Averages six octaves and
  reaches eleven for M7-M7, which does not fit on a piano. Keep it as a toggle,
  not a default: its use is rhetorical, for showing that these are multi-octave
  objects unlike Messiaen's one-octave modes.
- A third **manual octave-displacement** mode (drag individual notes) is worth
  adding once the first two exist.

Thirty of the eighty-six four-interval cycles contain a tritone, where up and
down are equidistant; the engine breaks that tie toward the register centre.
Two- and three-interval cycles never hit it.

**Spelling** has two modes: `fixed` (conventional, for the circle display) and
`contextual` (derived from the intervals, so a m3 is always spelled as a
third). Contextual spelling accumulates accidentals — twelve ascending fifths
from C end on B♯ — which is correct but needs watching. `maxAccidental()` is
the diagnostic.

## 5. Colour

One palette shared between circle and staff. The colour marking a rotatable
ring on the circle marks the same notes on the notation. This is the single
most useful thing the interface can do for someone who has not read the theory.

Requirements: colourblind-safe (four distinguishable hues needed at *k* = 4),
and paired with a redundant non-colour cue — notehead shape or bracket —
because journals print greyscale.

## 6. The circle model

State is **the interval sequence plus a transposition**. Everything else is a
view. Rotations, group reordering and direction are moves through the space of
valid interval sequences, not separate state.

Three degrees of freedom, and all three are required:

| Control | Reaches (*k*=4) |
|---|---|
| Group rotation only | 27 of 324 forms — **6 of 39 cycles** |
| + reverse direction | 54 of 324 |
| + group reordering | 162 of 324 — all 39 cycles |
| both | 324 of 324 |

Rotation alone is not enough. The four-interval mode would reach six of
thirty-nine cycles and look completely functional while doing it.

- **Rotation** — group *m* sits between dials *m*−1 and *m*, so rotating it
  trades semitones between exactly those two dials. Group 0 is locked;
  rotating it would only transpose.
- **Reversal** — the direction the locked group is traversed. This is the
  degree of freedom documented by the two columns of the deck's slide 8
  ("to D" vs "to B♭").
- **Reordering** — which group class sits in which ring slot.

**Ring order is not listing order.** The circle of fifths visits the augmented
triads as C–E♭–D–D♭, so ring slot 1 holds the E♭ triad, not the D♭ one. Assign
rotatable rings by slot via `groupOfSlot()`, never by the order the groups are
written down.

Geometry is exact: a diminished quartad sits 90° apart on a twelve-slot ring
and an augmented triad 120°, so each group's rotation is a rigid rotation of a
concentric ring. Draw each group on its own slightly offset ring rather than
crowding all twelve notes onto one circle.

## 7. Dials

Only *k*−1 dials are ever free. The intervals sum to a fixed value (14
semitones for two, 21 for three, 28 for four), so the last is arithmetic.

Dials are bidirectional: drag to set a value and the circle follows.
`setDial()` compensates into a neighbour; `toward: 'left' | 'right'` picks
which. Use `legalDialValues()` to grey out illegal positions rather than
letting the user select one and rejecting it.

## 8. API

```js
import * as CC from './cycles.js';

// Enumeration
CC.allCycles(k)                    // every valid ordered form
CC.rotationClasses(k, opts)        // one per rotation class
CC.isValidCycle(iv)                // full 12-note test
CC.candidateIntervals(k)           // intervals not ≡ 0 mod k
CC.reducesTo(iv) / CC.isDegenerate(iv)

// Catalogue
CC.buildCatalogue(k, opts)         // [{ id, ordinal, form, intervals, name, partner,
                                   //    retrogradeOf, degenerate, reducesTo, berliner }]
CC.identify(iv)                    // look up an arbitrary sequence
CC.berlinerClasses(k) / CC.berlinerIdFor(iv)

// Operations
CC.rotate / CC.canonical / CC.rotationIndex
CC.invert / CC.retrograde / CC.retrogradeInversion   // take INTERVALS, see 3a
CC.rowForms(iv, t)                 // { P, I, R, RI } as PITCH CLASSES
CC.rowFormCount(iv)                // 4k, halved when palindromic

// Realisation
CC.pitchClasses(iv, t)
CC.placeRegister(iv, { mode, transposition, centre, closeCycle })
CC.registerSpan(notes)
CC.spell(iv, { mode, transposition })
CC.groups(iv, t) / CC.groupOfSlot(slot, k)

// Interaction
CC.rotateGroup(iv, m, steps)       // null if illegal
CC.reverseDirection(iv)
CC.reorderGroups(iv, perm)
CC.setDial(iv, index, value, { toward })
CC.legalDialValues(iv, index)
CC.groupPositions(k)

// Permalinks
CC.serialise({ intervals, transposition })   // "k=3&i=1-4-10&t=7"
CC.parse(str)                                // null if invalid
```

Functions that can fail return `null` rather than throwing. Only genuine
programmer errors (a group index out of range, a malformed permutation) throw.

## 9. Verification

`node cycles.test.js` — 91 assertions. These are not decoration: they pin the
enumeration counts, diff the catalogue against the hand-notated tables in
`All_Intervals.pdf`, and reproduce Berliner et al.'s printed prime forms
exactly for *k* = 2 and 3. **Any change to `cycles.js` must keep them green.**

`node gen-catalogue.js` regenerates `catalogue.json` and `catalogue.csv`. The CSV is the source for the article's tables — do not retype them. It carries
`retrograde_of`, `berliner`, `row_forms`, `palindromic` and both register spans
alongside the identifiers.

## 10. Build constraints

- Vanilla JS + SVG. No framework, no build step, no npm at runtime.
- Deploys as a folder to `chrisjeffery.co.za/cycles/`. Nothing else on the
  site is touched.
- The app is loaded as ES modules (`<script type="module">`), which Chrome
  refuses to load over `file://` — opening `index.html` by double-clicking it
  shows a blank page. It needs an HTTP origin. Locally, `npx serve` (or any
  static file server) from the repo root is the way to run it; the deployed
  site already serves it over HTTP, so this only affects local development.
- Two presentations from one artifact: a bare version for `<iframe>` embedding
  and screen recording, and a wrapper carrying the site's header and nav.
- Small bundle, works offline, thumb-sized touch targets. Distance-learning
  audience on variable bandwidth.
- Tone.js and VexFlow load as plain `<script>` tags from a CDN when their
  phases arrive. Neither forces a toolchain.
- Permalinks are not a late feature. Every state needs a URL from Phase 1, or
  video viewers land on the default and have to reconstruct what was shown.
