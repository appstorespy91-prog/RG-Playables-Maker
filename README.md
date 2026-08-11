# PlayableForge

A professional, cross-platform desktop app that converts Unity WebGL builds
into single, self-contained HTML **playable ads** — pre-optimized for
Mintegral, AppLovin (MAX), Google UAC, and TikTok/Pangle.

Drop in a Unity WebGL build folder, pick your target ad networks, and get
back one ready-to-upload `.html` file per network, each with the right SDK
shim injected, an optional end-card CTA overlay, and a live size check
against that network's limit.

## Tech stack

| Layer        | Technology                                   |
| ------------ | --------------------------------------------- |
| Shell        | Tauri 2.0 (Rust)                              |
| Frontend     | React 18 + TypeScript + Vite                  |
| Styling      | Tailwind CSS                                  |
| Conversion   | Python 3 (`src-python/converter.py`), invoked as a subprocess from Rust |
| Packaging    | `.dmg` (macOS) and NSIS `.exe` (Windows) via `npm run tauri build` |

## How it works

1. **Input** — point PlayableForge at a Unity WebGL build folder
   (`index.html`, `Build/game.wasm`, `Build/game.data`,
   `Build/game.framework.js`, `Build/game.loader.js`). The app scans the
   folder and shows which required files were found.
2. **Network selection** — toggle any of the four supported networks.
   Each has its own size limit and required SDK shim.
3. **Settings** — compression level, output folder, optional end card
   (text/color/delay), and portrait/landscape export.
4. **Convert** — the Rust backend spawns `src-python/converter.py` with the
   job as JSON on stdin, and streams NDJSON progress events back to the UI
   in real time (`pf://progress`).
5. **Results** — one file card per generated `.html`, with live size vs.
   limit status (OK / caution / over), Preview, Open Folder, and Copy Path.

### Conversion pipeline (`src-python/converter.py`)

1. **Read & validate** — check all 5 required files exist, read/size them.
2. **Inline assets** — `game.wasm` and `game.data` are embedded as base64
   `data:` URIs directly into the Unity loader; `framework.js` and
   `loader.js` are inlined as `<script>` blocks. The result is one HTML
   file with zero external file references.
3. **Network SDK injection** — network-specific shims are injected into
   `<head>`:
   - **Mintegral** — `gameReady` / `gameClose` / `installGame` bridge.
   - **AppLovin** — MRAID 2.0 `ready` / `stateChange` listeners.
   - **Google UAC** — `ExitApi` install handler + resize/orientation support.
   - **TikTok/Pangle** — Pangle `playableSDK` bridge + touch optimization.
4. **End card** (optional) — a floating CTA button injected before
   `</body>`, shown after a configurable delay, wired to call whichever
   network install function is present.
5. **Compression** — HTML is minified; a gzip pass reports the
   network-transfer-equivalent size.
6. **Size validation** — each output file is classified `ok` / `caution`
   (≥90% of the limit) / `over` against the network's cap:

   | Network   | Limit |
   | --------- | ----- |
   | Mintegral | 2 MB  |
   | AppLovin  | 2 MB  |
   | Google UAC| 5 MB  |
   | TikTok    | 2 MB  |

`converter.py` can also be run standalone for scripting/CI:

```bash
python3 src-python/converter.py --job job.json
# or
cat job.json | python3 src-python/converter.py --job -
```

## Project layout

```
PlayableForge/
├─ src/                     React + TypeScript frontend
│  ├─ components/           Dashboard, network cards, settings, processing & results screens
│  ├─ lib/tauri.ts          Thin wrapper around Tauri commands/events/plugins
│  └─ types/                Shared TS types + network specs
├─ src-python/
│  └─ converter.py          Conversion engine (see above)
├─ src-tauri/                Rust/Tauri backend
│  ├─ src/
│  │  ├─ main.rs            Entry point
│  │  ├─ lib.rs             Tauri builder, command registration
│  │  ├─ converter.rs       Spawns converter.py, streams progress events, cancellation
│  │  └─ scan.rs            Validates a folder against the required WebGL file list
│  ├─ capabilities/         Tauri 2.0 permission grants
│  ├─ icons/                App icons (icon.icns / icon.ico / PNGs)
│  └─ tauri.conf.json       Window, bundle (dmg/nsis), resource config
└─ scripts/generate_icon.py Stdlib-only PNG generator used to seed the app icon
```

## Development

Requirements: Node 18+, Rust stable, Python 3, and the platform's Tauri
prerequisites (see the [Tauri docs](https://v2.tauri.app/start/prerequisites/)).

```bash
npm install
npm run tauri dev
```

## Building installers

```bash
npm run tauri build
```

This runs `npm run build` (Vite → `dist/`), bundles `src-python/` as a Tauri
resource, and produces:

- **macOS** — `src-tauri/target/release/bundle/dmg/PlayableForge_<version>_<arch>.dmg`
- **Windows** — `src-tauri/target/release/bundle/nsis/PlayableForge_<version>_<arch>-setup.exe`

Cross-compiling installers requires building on (or targeting) the
corresponding OS — build the `.dmg` on macOS and the NSIS `.exe` on Windows
(or via matching CI runners).

The app calls the system `python3` (falling back to `python`) to run the
bundled `converter.py` resource, so a Python 3 runtime must be present on
the end user's machine. For a fully self-contained installer with no
Python dependency, freeze `converter.py` with PyInstaller and point
`resolve_converter_script`/`resolve_python_bin` in
`src-tauri/src/converter.rs` at the frozen binary instead.

## License

Proprietary — internal tooling for playable ad production.
