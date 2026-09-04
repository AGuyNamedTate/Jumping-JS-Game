# Fantasy Peak Climber

A small endless climber made as a **quick, playful experiment in AI-assisted development** — not a studio product, just a fun sprint to see how far a vanilla JS canvas game could go with an AI pair-programmer.

Charge a jump, hop shaky stone platforms, and race your high score up a fantasy peak.

## Play

**Live:** [https://aguynamedtate.github.io/Jumping-JS-Game/](https://aguynamedtate.github.io/Jumping-JS-Game/)

## Run locally

ES modules need a local HTTP server (`file://` will not load scripts).

```bash
npm install
npm run serve
```

Or without npm:

```bash
npx serve .
# or: python -m http.server 8000
```

Open the URL shown (typically `http://localhost:3000`).

## Tests & CI

```bash
npm test          # Vitest unit tests
npm run test:e2e  # Playwright smoke (loads the game in a browser)
npm run ci        # both
```

Push or open a PR → GitHub Actions runs those checks.  
Push to `main` (and pass) → Actions deploys the static site to **GitHub Pages**.

## Project layout

| Path | Role |
|------|------|
| `index.html` | Canvas + DOM overlays (menu, history, store, HUD, continue, game over) |
| `css/styles.css` | Fantasy palette UI |
| `js/` | Game modules (boot, loop, player, platforms, audio, store, …) |
| `assets/` | Optional sprites / audio (procedural fallbacks if missing) |
| `.github/workflows/` | CI + Pages deploy |

## Stack

Vanilla JavaScript (ES modules), HTML5 Canvas, Web Audio. No framework, no bundler — static files only.
