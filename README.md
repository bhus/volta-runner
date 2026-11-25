# VOLTA RUNNER

A retro action-platformer fusing four classics: **Apple II *Lode Runner*** × **Apple II *Conan: Hall of Volta*** × **NES *Mega Man*** × **Apple II *Bolo***.

Zero dependencies — pure HTML5 Canvas, ES modules, and procedural Web Audio API chiptune SFX & music, with full keyboard and mobile multi-touch gamepad support.

## Features
- **Lode Runner**: Ladders, monkey-bar ropes, gold-stealing Guards, and diggable/regenerating brick pits (`Q`/`E` or `Z`/`C`) that trap & crush enemies.
- **Conan: Hall of Volta**: Torches, lava pits, swooping Volta Bats, pulsing Volta lightning coils, acrobatic somersault jumps, and a wall-phasing **Boomerang Axe** (`K`/`V`).
- **Mega Man**: Crisp run/jump physics with coyote time & jump buffering, **Mega Slide** (`Shift`), rapid **Mega Buster** + **Charged Plasma Shot** (hold `J`/`X`), segmented HP/Boss bars, and chiptune soundtrack.
- **Bolo**: 360° aiming **Bolo Pillbox Turrets** with lock-on telegraphs, front-armored **Bolo Patrol Tanks**, **Bolo Power Cores**, and brick-blasting **Bolo Mortars** (`L`/`B`).
- **Progression & Replayability**:
  - **Volta Forge** between chambers (draft 1 of 3 permanent upgrades per chamber across 8 build-shaping relics)
  - Live **Style Combo (`x2`–`x8`)** and **S/A/B/C Chamber Ranks**
  - **6 Persistent Feats** & High Scores saved to `localStorage`
  - **New Game+ (`VOLTA LOOP 2+`)** after defeating Lord Volta's Bolo Mech
- **Mobile Ready**: Auto-showing multi-touch virtual D-Pad + action cluster, tap-to-start/draft, and CRT scanline toggle.

## Play Locally
Run `play.bat` on Windows, or serve the directory with any static HTTP server:

```bash
python -m http.server 8765
```

Then open `http://localhost:8765` (or `http://<your-lan-ip>:8765` from a phone on the same Wi-Fi).

## Tests
```bash
node test_verify.mjs
```
