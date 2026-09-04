# Fantasy Peak Climber

A small endless climber made as a **quick, playful experiment in AI-assisted development** — not a studio product, just a fun sprint to see how far a vanilla JS canvas game could go with an AI pair-programmer.

Charge a jump, hop shaky stone platforms, and race your high score up a fantasy peak.

## Play

**Live:** [https://aguynamedtate.github.io/Jumping-JS-Game/](https://aguynamedtate.github.io/Jumping-JS-Game/)

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

## Audio attribution

Background music: **Cathedral in the forest (ambient loop)** by [congusbongus](https://opengameart.org/users/congusbongus), from [OpenGameArt](https://opengameart.org/content/cathedral-in-the-forest-ambient-loop). License: [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
