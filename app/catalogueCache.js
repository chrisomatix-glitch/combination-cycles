/**
 * catalogueCache.js — lazy, memoised CC.allCycles(k) / CC.buildCatalogue(k).
 *
 * At k = 2, 3 and 4 both calls are cheap (well under a frame). At k = 6 they
 * are not: allCycles(6) enumerates 3,840 ordered forms and buildCatalogue(6)
 * walks that enumeration twice more internally (rotationClasses and
 * berlinerClasses each re-run it), together costing several hundred
 * milliseconds — a visible freeze on a phone, and the engine (frozen; see
 * CLAUDE.md) has no memoisation of its own to lean on.
 *
 * ensureCatalogue(k) builds both once per k and keeps them in memory for the
 * rest of the session, so mode switches back to a k already visited are free.
 * It never runs at module load — only when a caller actually asks for a k —
 * so a session that never opens six-interval mode never pays for it. The
 * setTimeout(0) hands control back to the browser first, so a "loading"
 * state the caller has just shown actually gets painted before the
 * synchronous engine call blocks the thread.
 */
import * as CC from '../src/cycles.js';

const cache = new Map(); // k -> { allCycles, catalogue }

/** Synchronous lookup — null if `k` hasn't been built yet this session. */
export function peekCatalogue(k) {
  return cache.get(k) || null;
}

/**
 * Build (or return the cached) { allCycles, catalogue } for `k`.
 * `onLoading(bool)` fires only around an actual build, never on a cache hit.
 */
export function ensureCatalogue(k, { onLoading } = {}) {
  const cached = cache.get(k);
  if (cached) return Promise.resolve(cached);

  onLoading?.(true);
  return new Promise((resolve) => {
    setTimeout(() => {
      const entry = { allCycles: CC.allCycles(k), catalogue: CC.buildCatalogue(k) };
      cache.set(k, entry);
      onLoading?.(false);
      resolve(entry);
    }, 0);
  });
}
