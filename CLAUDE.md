# CLAUDE.md

Project-specific conventions for Claude Code when working in this repo.

## Shell environment

This project runs on Windows, under Git Bash. Prefer bash syntax for shell
commands, and avoid constructs that PowerShell mis-parses — `@{u}` (collides
with PowerShell hash-literal syntax), here-strings (`@'...'@`), and long
inline scripts generally. Several commands have already failed on this. If a
command needs a multi-line payload (e.g. a commit message), write it to a
temp file and reference the file (e.g. `git commit -F <file>`) rather than
inlining it.

## No inline `node -e` scripts

Don't verify things with inline `node -e "..."` (or PowerShell equivalents)
beyond a couple of lines. This repo's tool environment has a parser byte
limit that long inline commands exceed, and it fails silently/confusingly
rather than as an obvious error.

If a check is worth running, it's worth keeping — write it as a file under
`app/` or `src/` instead of a throwaway command:

- A one-off sanity check while developing → a small script under `app/` or
  `src/`, run with `node path/to/script.js`, deleted once you're done if it's
  genuinely throwaway.
- Anything that verifies a fact the interface or the spec depends on
  (an enumeration count, a reachability claim, an invariant of the figure,
  etc.) → a permanent `*.test.js` file alongside the existing ones
  (`src/cycles.test.js`, `app/state.test.js`, `app/reachability.test.js`,
  `app/figure.test.js`), wired into `package.json`'s `scripts` and into
  `.github/workflows/test.yml`. Several of these exist precisely because a
  quick inline check turned out to be worth keeping.

## `src/cycles.js` is frozen

The engine is frozen. Do not modify `src/cycles.js` — including adding new
exports — unless the user's instruction explicitly says to change the engine
(e.g. "add these functions to cycles.js"). Absent that, treat any apparent
gap in the engine's API as something to work around in `app/`, and mention
the friction in your final report rather than reaching into the engine to
fix it.

`src/cycles.test.js` is the corresponding frozen test file — same rule.
Additive changes to it (new assertions) are fine only when explicitly asked
for; the existing assertions must never be edited to make something pass.

## All suites must pass before committing

Before committing, run every test suite defined in `package.json` and
confirm they're all green:

```
npm test               # src/cycles.test.js — the frozen engine suite
npm run test:ui        # app/state.test.js
npm run test:reachability   # app/reachability.test.js
npm run test:figure    # app/figure.test.js
```

These also run in CI (`.github/workflows/test.yml`) on every push and PR. If
you add a new permanent test file, add its script to `package.json` and a
corresponding step to the workflow in the same change, not as a follow-up.

## The app needs an HTTP origin

`index.html` loads its scripts as ES modules (`<script type="module">`),
which Chrome refuses to load over `file://` — opening it by double-clicking
shows a blank page. Always serve it locally instead:

```
npx serve
```

then open the printed `http://localhost:...` URL. This is a real constraint
on `index.html`, not just a dev convenience — don't introduce anything that
assumes `file://` will work.
