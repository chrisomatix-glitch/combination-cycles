/**
 * dials.js — the two interval dials.
 *
 * Each dial offers only the values candidateIntervals(k) admits at all, and
 * greys out (disables) whichever of those legalDialValues(iv, index) rules
 * out for the *current* cycle, rather than accepting a click and rejecting it
 * (SPEC.md §7). Only one dial is ever independently free — setting one always
 * compensates the other — so the dial the user didn't touch gets a brief
 * highlight to make that coupling visible rather than silent.
 */
import * as CC from '../src/cycles.js';

const K = 2;
const CANDIDATES = CC.candidateIntervals(K);

const FULL_NAMES = {
  1: 'minor second', 2: 'major second', 3: 'minor third', 4: 'major third',
  5: 'perfect fourth', 6: 'augmented fourth', 7: 'perfect fifth',
  8: 'minor sixth', 9: 'major sixth', 10: 'minor seventh', 11: 'major seventh',
};

export function mountDials(root, { onSetDial }) {
  root.innerHTML = '';
  const dialRefs = [];

  for (let index = 0; index < K; index += 1) {
    const wrap = document.createElement('div');
    wrap.className = 'dial';
    wrap.dataset.dial = String(index);

    const heading = document.createElement('h2');
    heading.className = 'dial__label';
    heading.textContent = `Interval ${index + 1}`;
    wrap.appendChild(heading);

    const options = document.createElement('div');
    options.className = 'dial__options';
    options.setAttribute('role', 'group');
    options.setAttribute('aria-label', `Interval ${index + 1} value`);
    wrap.appendChild(options);

    const buttons = new Map();
    for (const value of CANDIDATES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dial__option';
      btn.textContent = CC.intervalName(value);
      btn.title = FULL_NAMES[value];
      btn.setAttribute('aria-label', FULL_NAMES[value]);
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => onSetDial(index, value));
      options.appendChild(btn);
      buttons.set(value, btn);
    }

    root.appendChild(wrap);
    dialRefs.push(buttons);
  }

  function render(state, meta = {}) {
    const iv = state.intervals;
    dialRefs.forEach((buttons, index) => {
      const legal = new Set(CC.legalDialValues(iv, index));
      const current = iv[index];
      const isCompensating = meta.type === 'dial' && meta.index !== index;
      buttons.forEach((btn, value) => {
        const isCurrent = value === current;
        btn.classList.toggle('is-current', isCurrent);
        btn.setAttribute('aria-pressed', String(isCurrent));
        btn.disabled = !(isCurrent || legal.has(value));
        if (isCurrent && isCompensating) {
          btn.classList.remove('is-compensating');
          // eslint-disable-next-line no-void
          void btn.offsetWidth; // restart the CSS animation
          btn.classList.add('is-compensating');
        }
      });
    });
  }

  return { render };
}
