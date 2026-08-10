# Combination Cycles

Enumeration, catalogue and realisation engine for **symmetrical twelve-note
combination cycles** — twelve-note cycles built from a repeating pattern of two
or more alternating intervals, which traverse all twelve pitch classes exactly
once and return to their starting note.

This repository holds the theory engine. An interactive circle-of-fifths tool
built on it is in development.

---

## What a combination cycle is

The circle of fifths and the chromatic scale are the two twelve-note cycles
that can be built from a *single* repeating interval. They work because
adjacent notes alternate between the two transpositions of the whole-tone
scale.

Shift one whole-tone hexachord against the other and new cycles appear, built
from two alternating intervals — m2–M6 and m3–P5, along with their inversions.
The same logic extends: three intervals arranged symmetrically around the
diminished quartad, four around the augmented triad, six around the tritone.

The twelve notes always fall into *k* groups, and those groups are exactly the
residue classes mod *k* — whole-tone hexachords at *k* = 2, diminished quartads
at 3, augmented triads at 4, tritone dyads at 6. An interval congruent to 0
(mod *k*) is barred, since it would step to a note in the same group. This is
why the minor 3rd and augmented 4th cannot appear in three-interval cycles, and
the major 3rd and minor 6th cannot appear in four-interval ones.

These cycles are essentially **multi-octave modes of limited transposition** —
they have all the features of Messiaen's MoLTs but are not confined to a single
octave.

## Counts

| Intervals | Ordered forms | Genuine | Catalogue ordinals | Berliner classes |
|---|---|---|---|---|
| 2 | 12 | 8 | 2 | 2 |
| 3 | 64 | 60 | 10 | 8 |
| 4 | 324 | 312 | 39 | 28 |
| 6 | 3840 | 3768 | 314 | 184 |

Excluding degenerate cycles. The full catalogue keeps them, flagged.

## Naming

- `k-n` — prime form, ordinal by lexicographic order of the intervals
- `k-nI` — its inversion
- `k-nI T7` — that cycle starting on G

Rotations are not distinct: `M6-m2` *is* the m2–M6 cycle entered from a
different note. Inversions are, because a cycle and its inversion are different
compositional objects. This is a finer equivalence than Berliner et al. (below),
who additionally quotient by retrograde; every entry carries a concordance to
their numbering.

## Use

```js
import * as CC from './src/cycles.js';

CC.buildCatalogue(3);                  // the three-interval catalogue
CC.identify([1, 4, 10]);               // -> 3-4, m2-M3-m7
CC.pitchClasses([1, 9], 0);            // the m2-M6 cycle from C
CC.placeRegister([1, 9], { mode: 'bounded' });
CC.rowForms([1, 9]);                   // P, I, R, RI as pitch classes
```

```
npm test          # 91 assertions
npm run catalogue # regenerate data/catalogue.{json,csv}
```

The suite also runs automatically on every push via GitHub Actions, so a
green tick on a commit means the enumeration, the PDF diff and the Berliner
concordance all still agree.

`docs/SPEC.md` is the full implementation reference.

## Verification

The test suite is not decoration. It pins the enumeration counts, diffs the
catalogue against hand-notated tables prepared independently of the code, and
reproduces the prime forms printed by Berliner et al. exactly for *k* = 2 and 3.
Any change to `src/cycles.js` must keep it green.

## Provenance

The term *combination cycle*, and the twelve-note cyclical forms it names, are
set out in my 2017 doctoral portfolio, *Portfolio of Original Compositions*
(DMus, South African College of Music, University of Cape Town), following an
earlier presentation to the South African Society for Research in Music in 2012.
The portfolio defines the cycles, derives the whole-tone constraint governing
two-interval forms, and traces their use across four works — from isolated
colouristic passages in *Movement for Viola and Piano* (2010) through to
*De Voortrekkers* (2016), an orchestral film score generated entirely from seven
combination cycles deployed leitmotivically, one per character or character
group.

Combination cycles in the broader sense are not new — the octatonic scale is
one, and Ives, Lutoslawski and Ades all used alternating-interval patterns,
though not the twelve-note cyclical forms. The mathematics of the twelve-note
forms was developed independently, and far more rigorously, by Berliner, Castro,
Merritt and Southard in 2018, who give necessary and sufficient conditions and
complete enumeration tables. Their treatment and mine are convergent discoveries
with different emphases: theirs mathematical and general, mine compositional and
analytical. Their paper does not address inversional distinctions, the
relationship to Messiaen's modes of limited transposition, the serial
implications, or compositional application.

### The portfolio's cycles, catalogued

Every cycle named in the portfolio validates against the engine:

| Work | Cycle | ID |
|---|---|---|
| *Movement for Viola and Piano* (2010) | M6-P4 | 2-3I |
| | m3-M7 | 2-2I |
| *The Outer Edges* (2011) | M6-m2 | 2-2 |
| | P4-m2-P4-M6 | 4-15 |
| *String Quartet* II (2014-15) | m3-m3-P5-P5 | 4-40 |
| | M6-m7-M7-m7 | 4-6I |
| *De Voortrekkers* (2016) — Retief and the Boers | M2-M2-P4 | 3-8 |
| — the Portuguese | P5-m7-m7 | 3-8I |
| — Dingaan and the Zulus | M2-m3-M2-M6 | 4-28 |
| — the missionaries | M2-P5-M2-M6 | 4-36 |
| — Sobuza | M2-m3-m7-P4 | 4-31 |
| — Sobuza | M2-M7-m7-P4 | 4-9I |
| — Jan, Pretorius and the Boers | P4-A4-P5-m7 | 4-37I |

Note that Retief's cycle and the Portuguese one are 3-8 and 3-8I — the same
cycle and its inversion, assigned to opposing parties in the narrative.

## References
> Jeffery, C. (2017). *Portfolio of Original Compositions* [DMus portfolio].
> South African College of Music, University of Cape Town.
> <http://hdl.handle.net/11427/27459>

> Berliner, A. H., Castro, D., Merritt, J., & Southard, C. (2018). Expanded
> interval cycles. *Journal of Mathematics and Music*, 12(1), 21–33.
> <https://doi.org/10.1080/17459737.2018.1453950>

## Citing

See `CITATION.cff`, or use GitHub's "Cite this repository" button.

## Licence

MIT for the code; the catalogue in `data/` and the documentation in `docs/` are
released under CC BY 4.0. Reuse is welcome — attribution is not optional.
