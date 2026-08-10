# Combination Cycles

Enumeration, catalogue and realisation engine for **symmetrical twelve-note
combination cycles** — twelve-note cycles built from a repeating pattern of two
or more alternating intervals, which traverse all twelve pitch classes exactly
once and return to their starting note.

This repository holds the theory engine, and the interactive circle-of-fifths
tool built on it is live at <https://chrisjeffery.co.za/cycles/>.

## The tool

Rotatable rings for two-, three- and four-interval cycles, with bidirectional
interval dials and the cycle drawn as a geometric figure on the circle of
fifths. Staff notation in bounded or literal register, matching sampled piano
playback note for note — literal shows the cycles as the multi-octave objects
they are. SVG export and permalinks for every state.

---

## What a combination cycle is

The circle of fifths and the chromatic scale are the two twelve-note cycles
that can be built from a *single* repeating interval. They work because
adjacent notes alternate between the two transpositions of the whole-tone
scale. Other intervals can also be repeated, but do not cycle through all
twelve notes. Collectively, these repeated patterns are called interval cycles.

A combination cycle is akin to an interval cycle, but instead of alternating
a single interval until the original or starting pitch recurs, two or more intervals
are cycled through in a fixed order, again until the starting pitch recurs. There are 
many combination cycles, varying from two to six intervals in length, which cycle
through any number of pitches before returning to the starting pitch. My own use of
these cycles, however, is limited to those that cycle through all twelve pitches without
repeating, and return to the original pitch on the 13th step—in other words, like a
traditional serial 12-note row, but always maintaining the fixed order of intervals.
This subset consists of a finite number of possibilities, and can be constructed out
of two, three or four intervals. Six intervals is also possible, but provides far more
possibilities and weakens the sense of order found in the two- to four-interval cycles.
This sense of order is caused by the repetition of the same interval class patterns
six, four or three times respectively.

These cycles are essentially **multi-octave modes of limited transposition** —
they have all the features of Messiaen's modes of limited transpositoin but are not
confined to a single octave.

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

The term *combination cycle* was coined by Lambert (1990). The specific use of combination
cycles as twelve-note cyclical forms, are to my knowledge first
set out in my 2017 doctoral portfolio (Jeffery 2017), *Portfolio of Original Compositions*
(DMus, South African College of Music, University of Cape Town), following an
earlier presentation to the South African Society for Research in Music in 2012, and the
North-South-South Conference in the same year.
The portfolio defines the cycles, derives the whole-tone constraint governing
two-interval forms, and traces their use across four works — from isolated
colouristic passages in *Movement for Viola and Piano* (2010) through to
*De Voortrekkers* (2016), an orchestral film score generated entirely from seven
combination cycles deployed leitmotivically, one per character or character
group.

Combination cycles in the broader sense are not new — the octatonic scale is
one, and Charles Ives, Bela Bartok, Witold Lutoslawski, Benjamin Britten and
Thomas Ades all used alternating-interval patterns,
though not (with one known exception in Bartok) the twelve-note cyclical forms.
The mathematics of the twelve-note forms was developed more rigorously by Berliner et al (2018),
who give necessary and sufficient conditions and complete enumeration tables.

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
> Lambert, P. (1990). Interval Cycles as Compositional Resources in the Music
> of Charles Ives. *Music Theory Spectrum*, 12(1), 43–82. https://doi.org/10.2307/746146

>Jeffery, C. (2017). *Portfolio of Original Compositions* [DMus portfolio].
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
