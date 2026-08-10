/**
 * dials.js — the k interval dials.
 *
 * Each dial offers only the values candidateIntervals(k) admits at all, and
 * greys out (disables) whichever of those legalDialValues(iv, index) rules
 * out for the *current* cycle, rather than accepting a click and rejecting it
 * (SPEC.md §7). Only k-1 dials are ever independently free — setting one
 * always compensates a neighbour — so the dial the user didn't touch gets a
 * brief highlight to make that coupling visible rather than silent.
 *
 * At k = 2 legalDialValues() never restricts anything — every candidate
 * value is always reachable by compensating the other dial. At k = 3 and 4
 * that stops being true (every state has some values greyed out), which is
 * why the disabled affordance has to read as deliberate: a title explaining
 * why, not just a dimmed button that looks broken.
 *
 * Rendered as k vertical strips side by side (one per interval, in cycle
 * order) rather than k wrapped horizontal grids — a column of ascending
 * values reads as a dial, which a 4-wide wrapped grid doesn't communicate at
 * all, and it's markedly shorter at k=4 where crowding is worst (Phase 5's
 * brief: 9 rows + 1 heading vs. 12 rows + 4 headings). Every strip at a
 * given k iterates the identical candidateIntervals(k) list in the same
 * order with fixed-height buttons, so "the same interval value sits at the
 * same height across strips" falls out of plain flexbox for free — nothing
 * here has to line the rows up by hand.
 */
import * as CC from '../src/cycles.js';

const FULL_NAMES = {
  1: 'minor second', 2: 'major second', 3: 'minor third', 4: 'major third',
  5: 'perfect fourth', 6: 'augmented fourth', 7: 'perfect fifth',
  8: 'minor sixth', 9: 'major sixth', 10: 'minor seventh', 11: 'major seventh',
};

export function mountDials(root, { onSetDial } = {}) {
  let candidates = [];
  let dialRefs = [];

  /** Rebuild the k dial strips. Call before the first render() at that k. */
  function setMode(k) {
    candidates = CC.candidateIntervals(k);
    root.innerHTML = '';
    dialRefs = [];

    const grid = document.createElement('div');
    grid.className = 'dials-grid';

    for (let index = 0; index < k; index += 1) {
      const col = document.createElement('div');
      col.className = 'dial-col';
      col.dataset.dial = String(index);
      col.style.setProperty('--dial-color', `var(--color-ring-${index})`);

      const header = document.createElement('div');
      header.className = 'dial-col__header';
      header.textContent = String(index + 1);
      header.setAttribute('aria-hidden', 'true');
      col.appendChild(header);

      const options = document.createElement('div');
      options.className = 'dial-col__options';
      options.setAttribute('role', 'group');
      options.setAttribute('aria-label', `Interval ${index + 1} value`);
      col.appendChild(options);

      const buttons = new Map();
      for (const value of candidates) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dial__option';
        btn.textContent = CC.intervalName(value);
        btn.setAttribute('aria-label', FULL_NAMES[value]);
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => onSetDial?.(index, value));
        options.appendChild(btn);
        buttons.set(value, btn);
      }

      grid.appendChild(col);
      dialRefs.push(buttons);
    }

    root.appendChild(grid);
  }

  function render(state, meta = {}) {
    const iv = state.intervals;
    dialRefs.forEach((buttons, index) => {
      const legal = new Set(CC.legalDialValues(iv, index));
      const current = iv[index];
      const isCompensating = meta.type === 'dial' && meta.index !== index;
      buttons.forEach((btn, value) => {
        const isCurrent = value === current;
        const isLegal = isCurrent || legal.has(value);
        btn.classList.toggle('is-current', isCurrent);
        btn.setAttribute('aria-pressed', String(isCurrent));
        btn.disabled = !isLegal;
        btn.title = isCurrent
          ? FULL_NAMES[value]
          : isLegal
            ? FULL_NAMES[value]
            : `${FULL_NAMES[value]} — not available for the current cycle`;
        if (isCurrent && isCompensating) {
          btn.classList.remove('is-compensating');
          // eslint-disable-next-line no-void
          void btn.offsetWidth; // restart the CSS animation
          btn.classList.add('is-compensating');
        }
      });
    });
  }

  return { render, setMode };
}
