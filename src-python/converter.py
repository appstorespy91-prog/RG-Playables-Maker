#!/usr/bin/env python3
"""
PlayableForge conversion engine.

Converts a Unity WebGL build folder into single self-contained HTML
"playable ad" files, one per selected ad network, with network-specific
SDK shims injected and an optional end card overlay.

Invocation
----------
    python3 converter.py --job job.json

`job.json` (or JSON on stdin via --job -) has the shape:

{
  "inputPath": "/path/to/webgl_build",
  "outputFolder": "/path/to/output",
  "networks": ["mintegral", "applovin", "google", "tiktok"],
  "settings": {
    "compressionLevel": 6,
    "endCard": {"enabled": true, "text": "Download Now", "color": "#FF6B35", "delaySeconds": 15},
    "portrait": true,
    "landscape": false
  }
}

Progress is streamed to stdout as newline-delimited JSON ("NDJSON"),
one event object per line, so a parent process (the Tauri/Rust backend)
can forward it live to the UI:

    {"type": "log", "status": "ok", "message": "Reading WebGL files..."}
    {"type": "progress", "percent": 42}
    {"type": "done", "files": [ ... ]}
    {"type": "error", "error": "..."}

The script never raises past main() — all failures are reported as
{"type": "error", ...} events with exit code 1.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import io
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from typing import Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Real Unity WebGL builds name their Build/ files after the project's
# *Product Name* (e.g. "demo.wasm", "MyGame.loader.js") — never literally
# "game.*". We locate each required asset by its distinguishing suffix
# inside Build/ instead of a fixed filename.
BUILD_FILE_SUFFIXES = {
    "loader_js": ".loader.js",
    "framework_js": ".framework.js",
    "wasm": ".wasm",
    "data": ".data",
}

NETWORK_LIMITS = {
    "mintegral": 2 * 1024 * 1024,
    "applovin": 2 * 1024 * 1024,
    "google": 5 * 1024 * 1024,
    "tiktok": 2 * 1024 * 1024,
}

NETWORK_NAMES = {
    "mintegral": "Mintegral",
    "applovin": "AppLovin",
    "google": "Google UAC",
    "tiktok": "TikTok/Pangle",
}

CAUTION_RATIO = 0.9  # >=90% of limit -> caution


# ---------------------------------------------------------------------------
# Progress emission
# ---------------------------------------------------------------------------

def emit(event: dict) -> None:
    """Write one NDJSON progress event to stdout and flush immediately."""
    sys.stdout.write(json.dumps(event, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def log(message: str, status: str = "info") -> None:
    emit({"type": "log", "status": status, "message": message, "ts": time.time()})


def progress(percent: float) -> None:
    emit({"type": "progress", "percent": max(0, min(100, round(percent, 1)))})


def human_size(num_bytes: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if abs(num_bytes) < 1024.0:
            return f"{num_bytes:3.1f}{unit}" if unit != "B" else f"{int(num_bytes)}B"
        num_bytes /= 1024.0
    return f"{num_bytes:.1f}TB"


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class WebGLBuild:
    root: str
    index_html: str = ""
    wasm_b64: str = ""
    data_b64: str = ""
    framework_js: str = ""
    loader_js: str = ""
    # Actual on-disk basenames (e.g. "demo.wasm"), used to recognize and
    # redirect requests the original page makes for these assets.
    wasm_name: str = ""
    data_name: str = ""
    framework_name: str = ""
    loader_name: str = ""
    wasm_original_size: int = 0
    data_original_size: int = 0
    total_original_size: int = 0


@dataclass
class OutputResult:
    network: str
    fileName: str
    path: str
    sizeBytes: int
    originalSizeBytes: int
    limitBytes: int
    status: str
    orientation: str


# ---------------------------------------------------------------------------
# Step 1 — Read & validate
# ---------------------------------------------------------------------------

def _find_build_file(build_dir: str, suffix: str) -> Optional[str]:
    """Return the single filename in build_dir ending with suffix, or None
    if zero or more than one file matches (an ambiguous build is treated
    as not found)."""
    if not os.path.isdir(build_dir):
        return None
    matches = [
        name
        for name in os.listdir(build_dir)
        if name.lower().endswith(suffix) and os.path.isfile(os.path.join(build_dir, name))
    ]
    return matches[0] if len(matches) == 1 else None


def validate_and_read(input_path: str) -> WebGLBuild:
    log("Reading WebGL files...", "info")

    build_dir = os.path.join(input_path, "Build")
    index_path = os.path.join(input_path, "index.html")

    found_names: dict[str, Optional[str]] = {"index.html": "index.html" if os.path.isfile(index_path) else None}
    for key, suffix in BUILD_FILE_SUFFIXES.items():
        found_names[key] = _find_build_file(build_dir, suffix)

    missing_labels = []
    if not found_names["index.html"]:
        missing_labels.append("index.html")
    for key, suffix in BUILD_FILE_SUFFIXES.items():
        if not found_names[key]:
            missing_labels.append(f"Build/*{suffix}")

    if missing_labels:
        for label in missing_labels:
            log(f"Missing required file: {label}", "error")
        raise RuntimeError(
            "Missing required WebGL build files: " + ", ".join(missing_labels)
        )

    sizes = {"index.html": os.path.getsize(index_path)}
    for key in BUILD_FILE_SUFFIXES:
        sizes[key] = os.path.getsize(os.path.join(build_dir, found_names[key]))

    log(f"Found index.html ({human_size(sizes['index.html'])})", "ok")
    for key, suffix in BUILD_FILE_SUFFIXES.items():
        log(f"Found Build/{found_names[key]} ({human_size(sizes[key])})", "ok")

    build = WebGLBuild(root=input_path)
    build.loader_name = found_names["loader_js"]
    build.framework_name = found_names["framework_js"]
    build.wasm_name = found_names["wasm"]
    build.data_name = found_names["data"]

    with open(index_path, "r", encoding="utf-8", errors="replace") as f:
        build.index_html = f.read()

    wasm_path = os.path.join(build_dir, build.wasm_name)
    data_path = os.path.join(build_dir, build.data_name)
    framework_path = os.path.join(build_dir, build.framework_name)
    loader_path = os.path.join(build_dir, build.loader_name)

    build.wasm_original_size = os.path.getsize(wasm_path)
    build.data_original_size = os.path.getsize(data_path)

    with open(wasm_path, "rb") as f:
        build.wasm_b64 = base64.b64encode(f.read()).decode("ascii")
    with open(data_path, "rb") as f:
        build.data_b64 = base64.b64encode(f.read()).decode("ascii")
    with open(framework_path, "r", encoding="utf-8", errors="replace") as f:
        build.framework_js = f.read()
    with open(loader_path, "r", encoding="utf-8", errors="replace") as f:
        build.loader_js = f.read()

    build.total_original_size = sum(sizes.values())
    log(f"Total source size: {human_size(build.total_original_size)}", "info")

    for net, limit in NETWORK_LIMITS.items():
        if build.total_original_size > limit:
            log(
                f"Warning: source size already exceeds {NETWORK_NAMES[net]} "
                f"limit ({human_size(limit)}) before compression",
                "warn",
            )

    return build


# ---------------------------------------------------------------------------
# Step 2 — Inline all assets into one self-contained HTML document
# ---------------------------------------------------------------------------

def build_base_html(build: WebGLBuild) -> str:
    """Turn the build into a single self-contained HTML document.

    Real Unity WebGL templates (2020.1+) don't reference their Build/
    files through static `<script src="...">` tags we can just delete —
    the page's own inline script creates a `<script>` element at runtime
    (`document.createElement("script"); script.src = loaderUrl`), and
    loader.js in turn fetches the framework/data/wasm files internally via
    `fetch()`/XHR using URLs it builds itself (e.g. `buildUrl + "/x.data"`).
    None of those URLs appear as literal strings we could regex against.

    So instead of rewriting loader.js/index.html's logic, we leave both
    completely untouched and inject a small shim at the very top of
    <head> that transparently redirects any script-element creation,
    fetch(), or XMLHttpRequest for a known Build/ asset (matched by
    filename) to an inlined base64 data: URI — before any other script
    on the page runs. This works regardless of Unity template version or
    how the loading code constructs its URLs.
    """
    log("Inlining assets to base64...", "info")

    html = build.index_html

    wasm_uri = f"data:application/wasm;base64,{build.wasm_b64}"
    data_uri = f"data:application/octet-stream;base64,{build.data_b64}"
    loader_uri = "data:text/javascript;base64," + base64.b64encode(
        build.loader_js.encode("utf-8")
    ).decode("ascii")
    framework_uri = "data:text/javascript;base64," + base64.b64encode(
        build.framework_js.encode("utf-8")
    ).decode("ascii")

    asset_map = {
        build.loader_name: loader_uri,
        build.framework_name: framework_uri,
        build.wasm_name: wasm_uri,
        build.data_name: data_uri,
    }

    interceptor = f"""
<script>
// PlayableForge: redirect all Unity Build/ asset requests to inlined
// base64 data: URIs, so the page runs with zero external file references.
// Installed before any other script so it catches every loading path
// Unity's WebGL templates use (dynamic <script> injection, fetch, XHR).
(function() {{
  var PF_ASSETS = {json.dumps(asset_map)};
  function pfBasename(url) {{
    try {{
      url = String(url).split('?')[0].split('#')[0];
      var parts = url.split('/');
      return parts[parts.length - 1];
    }} catch (e) {{ return url; }}
  }}
  function pfResolve(url) {{
    var name = pfBasename(url);
    return Object.prototype.hasOwnProperty.call(PF_ASSETS, name) ? PF_ASSETS[name] : url;
  }}

  var pfCreateElement = document.createElement.bind(document);
  document.createElement = function(tagName) {{
    var el = pfCreateElement(tagName);
    if (String(tagName).toLowerCase() === 'script') {{
      var proto = Object.getPrototypeOf(el);
      var desc = Object.getOwnPropertyDescriptor(proto, 'src');
      if (desc && desc.set) {{
        Object.defineProperty(el, 'src', {{
          configurable: true,
          enumerable: true,
          get: function() {{ return desc.get.call(el); }},
          set: function(url) {{ desc.set.call(el, pfResolve(url)); }}
        }});
      }}
    }}
    return el;
  }};

  if (window.fetch) {{
    var pfFetch = window.fetch.bind(window);
    window.fetch = function(input, init) {{
      var url = (typeof input === 'string') ? input : (input && input.url);
      if (url) {{
        var mapped = pfResolve(url);
        if (mapped !== url) {{
          input = (typeof input === 'string') ? mapped : new Request(mapped, input);
        }}
      }}
      return pfFetch(input, init);
    }};
  }}

  var pfXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {{
    var args = Array.prototype.slice.call(arguments);
    if (typeof url === 'string') args[1] = pfResolve(url);
    return pfXhrOpen.apply(this, args);
  }};
}})();
</script>
""".strip()

    if re.search(r"<head[^>]*>", html, flags=re.IGNORECASE):
        html = re.sub(r"(<head[^>]*>)", r"\1\n" + interceptor, html, count=1, flags=re.IGNORECASE)
    else:
        html = interceptor + "\n" + html

    # Defensive fallback for older Unity templates that reference the
    # loader via a literal static <script src="Build/xxx.loader.js"> tag
    # written directly in the markup — those never go through
    # document.createElement, so patch the src attribute textually too.
    for name, uri in ((build.loader_name, loader_uri), (build.framework_name, framework_uri)):
        html = re.sub(
            r'(<script[^>]*\bsrc=["\'])([^"\']*' + re.escape(name) + r')(["\'])',
            lambda m, _uri=uri: m.group(1) + _uri + m.group(3),
            html,
            flags=re.IGNORECASE,
        )

    log("Assets inlined — HTML is now fully self-contained", "ok")
    return html


# ---------------------------------------------------------------------------
# Step 3 — Network-specific SDK injection
# ---------------------------------------------------------------------------

MINTEGRAL_SDK = """
<script>
// Mintegral Playable SDK
window.gameReady = function() {
    if(window.mintegralGameReady) {
        window.mintegralGameReady();
    }
}
window.gameClose = function() {
    if(window.mintegralGameClose) {
        window.mintegralGameClose();
    }
}
// Install button handler
window.installGame = function() {
    if(window.mintegralInstall) {
        window.mintegralInstall();
    }
}
// Auto-call gameReady when Unity loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(window.gameReady, 3000);
});
</script>
""".strip()

APPLOVIN_SDK = """
<script>
// AppLovin MRAID 2.0
var mraid = window.mraid || {};
window.mraidReady = function() {
    if(typeof mraid.addEventListener === 'function') {
        mraid.addEventListener('ready', function() {
            mraid.addEventListener('stateChange',
            function(state) {
                if(state === 'expanded' || state === 'default') {
                    // Game visible — start/resume
                }
            });
        });
    }
}
window.mraidInstall = function() {
    if(typeof mraid.open === 'function') {
        mraid.open(window.clickUrl || '');
    }
}
document.addEventListener('DOMContentLoaded', mraidReady);
</script>
""".strip()

GOOGLE_SDK = """
<script>
// Google UAC Exit API
var ExitApi = window.ExitApi || {};
window.googleInstall = function() {
    if(typeof ExitApi.exit === 'function') {
        ExitApi.exit();
    } else {
        window.open(window.clickUrl || '', '_blank');
    }
}
// Both orientations supported
window.addEventListener('resize', function() {
    var canvas = document.querySelector('canvas');
    if(canvas) {
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
    }
});
</script>
""".strip()

TIKTOK_SDK = """
<script>
// TikTok Pangle Playable SDK
window.pangleReady = function() {
    if(window.playableSDK &&
       window.playableSDK.gameReady) {
        window.playableSDK.gameReady();
    }
}
window.pangleInstall = function() {
    if(window.playableSDK &&
       window.playableSDK.openAppStore) {
        window.playableSDK.openAppStore();
    }
}
// Pangle specific touch optimization
document.addEventListener('touchstart',
    function(e) { e.preventDefault(); },
    {passive: false}
);
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(window.pangleReady, 2000);
});
</script>
""".strip()

NETWORK_SDKS = {
    "mintegral": MINTEGRAL_SDK,
    "applovin": APPLOVIN_SDK,
    "google": GOOGLE_SDK,
    "tiktok": TIKTOK_SDK,
}

NETWORK_LABELS_FOR_LOG = {
    "mintegral": "Mintegral SDK",
    "applovin": "AppLovin MRAID 2.0",
    "google": "Google UAC Exit API",
    "tiktok": "TikTok Pangle SDK",
}


def inject_network_sdk(html: str, network: str) -> str:
    sdk = NETWORK_SDKS[network]
    log(f"Injecting {NETWORK_LABELS_FOR_LOG[network]}...", "ok")
    if re.search(r"<head[^>]*>", html, flags=re.IGNORECASE):
        html = re.sub(
            r"(<head[^>]*>)", r"\1\n" + sdk, html, count=1, flags=re.IGNORECASE
        )
    else:
        html = sdk + "\n" + html
    return html


# ---------------------------------------------------------------------------
# Step 4 — End card injection
# ---------------------------------------------------------------------------

def inject_end_card(html: str, text: str, color: str, delay_seconds: int) -> str:
    safe_text = (text or "Download Now").upper()
    safe_color = color or "#FF6B35"
    delay_ms = max(0, int(delay_seconds)) * 1000

    end_card = f"""
<div id="end-card" style="
    display:none;
    position:fixed;
    bottom:20px;
    left:50%;
    transform:translateX(-50%);
    background: {safe_color};
    color: white;
    padding: 15px 40px;
    border-radius: 50px;
    font-size: 24px;
    font-weight: bold;
    cursor: pointer;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
">{safe_text}</div>

<script>
setTimeout(function() {{
    var el = document.getElementById('end-card');
    if (el) el.style.display = 'block';
}}, {delay_ms}); // Show after configured delay

document.addEventListener('DOMContentLoaded', function() {{
    var el = document.getElementById('end-card');
    if (!el) return;
    el.addEventListener('click', function() {{
        // Call network specific install function
        if(window.mintegralInstall) window.mintegralInstall();
        if(window.mraidInstall) window.mraidInstall();
        if(window.googleInstall) window.googleInstall();
        if(window.pangleInstall) window.pangleInstall();
        if(window.installGame) window.installGame();
    }});
}});
</script>
""".strip()

    if re.search(r"</body>", html, flags=re.IGNORECASE):
        html = re.sub(r"</body>", end_card + "\n</body>", html, count=1, flags=re.IGNORECASE)
    else:
        html += "\n" + end_card
    return html


# ---------------------------------------------------------------------------
# Orientation CSS injection
# ---------------------------------------------------------------------------

def inject_orientation_css(html: str, orientation: str) -> str:
    if orientation == "portrait":
        css = """
<style id="pf-orientation">
  html, body { margin:0; padding:0; overflow:hidden; height:100%; width:100%; }
  canvas { width:100vw !important; height:100vh !important; object-fit:contain; }
</style>
""".strip()
    else:
        css = """
<style id="pf-orientation">
  html, body { margin:0; padding:0; overflow:hidden; height:100%; width:100%; }
  canvas { width:100vw !important; height:100vh !important; object-fit:contain; }
</style>
""".strip()
    if re.search(r"</head>", html, flags=re.IGNORECASE):
        html = re.sub(r"</head>", css + "\n</head>", html, count=1, flags=re.IGNORECASE)
    else:
        html = css + "\n" + html
    return html


# ---------------------------------------------------------------------------
# Step 5 — Compression
# ---------------------------------------------------------------------------

def minify_html(html: str) -> str:
    """Light, safe whitespace minification (does not touch <script>/<pre> bodies)."""
    # Collapse runs of whitespace between tags outside of script/style blocks.
    parts = re.split(r"(<script[\s\S]*?</script>|<style[\s\S]*?</style>)", html, flags=re.IGNORECASE)
    for i, part in enumerate(parts):
        if part.lower().startswith("<script") or part.lower().startswith("<style"):
            continue
        part = re.sub(r">\s+<", "><", part)
        part = re.sub(r"[ \t]{2,}", " ", part)
        parts[i] = part
    return "".join(parts)


def gzip_report(html: str, level: int) -> tuple[int, int]:
    """Return (raw_size, gzip_size) for reporting purposes. The HTML file
    itself is written uncompressed (ad networks require raw .html), but we
    report the gzip-equivalent size since networks generally serve/measure
    playables gzip-compressed over the wire."""
    raw_bytes = html.encode("utf-8")
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=level) as gz:
        gz.write(raw_bytes)
    return len(raw_bytes), len(buf.getvalue())


# ---------------------------------------------------------------------------
# Step 6 — Size validation
# ---------------------------------------------------------------------------

def classify_size(size_bytes: int, limit_bytes: int) -> str:
    if size_bytes > limit_bytes:
        return "over"
    if size_bytes >= limit_bytes * CAUTION_RATIO:
        return "caution"
    return "ok"


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def convert_webgl(input_path: str, output_folder: str, networks: list[str], settings: dict) -> list[OutputResult]:
    os.makedirs(output_folder, exist_ok=True)

    compression_level = int(settings.get("compressionLevel", 6))
    compression_level = max(1, min(9, compression_level))
    end_card_cfg = settings.get("endCard", {}) or {}
    end_card_enabled = bool(end_card_cfg.get("enabled", False))
    end_card_text = end_card_cfg.get("text", "Download Now")
    end_card_color = end_card_cfg.get("color", "#FF6B35")
    end_card_delay = int(end_card_cfg.get("delaySeconds", 15))

    orientations: list[str] = []
    if settings.get("portrait", True):
        orientations.append("portrait")
    if settings.get("landscape", False):
        orientations.append("landscape")
    if not orientations:
        orientations = ["portrait"]

    build = validate_and_read(input_path)
    progress(15)

    base_html = build_base_html(build)
    progress(30)

    results: list[OutputResult] = []
    total_steps = max(1, len(networks) * len(orientations))
    step = 0

    for network in networks:
        if network not in NETWORK_SDKS:
            log(f"Unknown network '{network}', skipping", "warn")
            continue
        limit = NETWORK_LIMITS[network]

        for orientation in orientations:
            html = base_html
            html = inject_network_sdk(html, network)
            html = inject_orientation_css(html, orientation)

            if end_card_enabled:
                html = inject_end_card(html, end_card_text, end_card_color, end_card_delay)
                log("End card injected", "ok")

            log(f"Building {NETWORK_NAMES[network]} HTML ({orientation})...", "info")
            html = minify_html(html)

            raw_size, gz_size = gzip_report(html, compression_level)
            reduction_pct = 0.0 if raw_size == 0 else (1 - gz_size / raw_size) * 100
            log(
                f"Compressing output for {NETWORK_NAMES[network]}... "
                f"({human_size(raw_size)} → {human_size(gz_size)} gzip-equivalent, "
                f"-{reduction_pct:.0f}%)",
                "ok",
            )

            suffix = "" if len(orientations) == 1 else f"_{orientation}"
            file_name = f"playable_{network}{suffix}.html"
            out_path = os.path.join(output_folder, file_name)
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(html)

            final_size = os.path.getsize(out_path)
            status = classify_size(final_size, limit)

            if status == "over":
                log(
                    f"{NETWORK_NAMES[network]}: {human_size(final_size)} "
                    f"EXCEEDS {human_size(limit)} limit",
                    "warn",
                )
            elif status == "caution":
                log(
                    f"{NETWORK_NAMES[network]}: {human_size(final_size)} "
                    f"(under {human_size(limit)} limit, close to cap)",
                    "warn",
                )
            else:
                log(
                    f"{NETWORK_NAMES[network]}: {human_size(final_size)} "
                    f"(under {human_size(limit)} limit ✅)",
                    "ok",
                )

            results.append(
                OutputResult(
                    network=network,
                    fileName=file_name,
                    path=out_path,
                    sizeBytes=final_size,
                    originalSizeBytes=build.total_original_size,
                    limitBytes=limit,
                    status=status,
                    orientation=orientation,
                )
            )

            step += 1
            progress(30 + (step / total_steps) * 60)

    log("Validating file sizes...", "info")
    any_over = any(r.status == "over" for r in results)
    if any_over:
        log("One or more files exceed their network's size limit", "warn")
    else:
        log("All files within limits!", "ok")

    progress(95)
    log("Export complete!", "ok")
    progress(100)
    return results


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="PlayableForge conversion engine")
    parser.add_argument("--job", required=True, help="Path to job JSON file, or '-' for stdin")
    args = parser.parse_args()

    try:
        if args.job == "-":
            job = json.load(sys.stdin)
        else:
            with open(args.job, "r", encoding="utf-8") as f:
                job = json.load(f)

        input_path = job["inputPath"]
        output_folder = job["outputFolder"]
        networks = job.get("networks", [])
        settings = job.get("settings", {})

        if not networks:
            raise RuntimeError("No networks selected")

        results = convert_webgl(input_path, output_folder, networks, settings)
        emit({"type": "done", "files": [r.__dict__ for r in results]})
        return 0
    except Exception as exc:  # noqa: BLE001 - top level guard, reported to caller
        emit({"type": "error", "error": str(exc)})
        return 1


if __name__ == "__main__":
    sys.exit(main())
