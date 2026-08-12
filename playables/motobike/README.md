# Moto Bike Stunt Wheelie — Playable Ad

Self-contained HTML5 playable ad for **Moto Bike Stunt Wheelie Game**
(`com.gt.moto.bike.wheelie.stunt.race.game`). Pure canvas + Web Audio API,
zero external dependencies, zero image assets — everything is drawn and
synthesized at runtime.

## Files

| File | Network SDK |
| --- | --- |
| `motobike_playable_mintegral.html` | Mintegral (`mintegralGameReady` / `mintegralInstall`) |
| `motobike_playable_applovin.html` | AppLovin MAX — MRAID 2.0 (`mraid.open`) |
| `motobike_playable_google.html` | Google App Campaigns — `ExitApi` |
| `motobike_playable_tiktok.html` | TikTok / Pangle `playableSDK` |

All four share identical gameplay, art, and audio — only the ad-network
bridge (`window.gameReady` / `window.installGame`) differs, injected as a
small script block right before `</body>`.

## Gameplay

- **Hold** the screen (or `SPACE` on desktop) to lift the front wheel into
  a wheelie; release to bring it back down.
- Stay in the **green zone** of the wheelie-balance meter (top of screen)
  to build a score multiplier and fire streak.
- Over-rotate past the top of the meter and the bike flips backward —
  crash. Hit a barrier without enough wheelie angle — crash.
- Ramps and speed boosts reward a well-timed wheelie with coins and a
  burst of speed.
- Difficulty ramps with distance: sparse obstacles under 200 m, more ramps
  and speed 200–500 m, tight/fast obstacles past 500 m.
- A run ends after 30 seconds of play or on crash, then the end card
  offers **Try Again** (up to 2 attempts) and **Play Full Game** /
  **Download FREE** CTAs.

## Technical notes

- Logical canvas is 720×1280 (portrait), scaled responsively via CSS to
  fit any viewport with letterboxing — no layout thrash on resize.
- Game loop uses `requestAnimationFrame` with delta-time-based physics
  (frame-rate independent).
- Touch and mouse/keyboard input are both wired; on-canvas buttons are
  hit-tested in logical coordinates so touch and click behave identically.
- Audio (engine rev, tire screech, wind, crash, coin chime, background
  loop) is generated entirely with oscillators/noise buffers via the Web
  Audio API — no audio files.
- Each output file is ~35 KB, well under every network's 2 MB cap.
