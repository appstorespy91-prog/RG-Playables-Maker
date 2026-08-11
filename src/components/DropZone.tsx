import { useCallback, useEffect, useState } from "react";
import type { FolderScanResult } from "../types";
import { browseForFolder, isTauri, onFolderDrop, scanFolder } from "../lib/tauri";

interface DropZoneProps {
  scan: FolderScanResult | null;
  onScan: (scan: FolderScanResult | null) => void;
  error: string | null;
  onError: (error: string | null) => void;
}

export default function DropZone({ scan, onScan, error, onError }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  const runScan = useCallback(
    async (path: string) => {
      setLoading(true);
      onError(null);
      try {
        const result = await scanFolder(path);
        onScan(result);
        if (!result.allRequiredFound) {
          onError("Some required Unity WebGL files are missing from this folder.");
        }
      } catch (e) {
        onScan(null);
        onError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [onScan, onError]
  );

  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    onFolderDrop((paths) => {
      setDragging(false);
      if (paths[0]) runScan(paths[0]);
    }).then((fn) => (unlisten = fn));
    return () => unlisten?.();
  }, [runScan]);

  const handleBrowse = async () => {
    if (!isTauri) {
      onError("Folder browsing requires the PlayableForge desktop app.");
      return;
    }
    const path = await browseForFolder();
    if (path) await runScan(path);
  };

  return (
    <section className="panel p-6">
      <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
        <span className="text-accent">1.</span> Input — Unity WebGL Build
      </h2>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => e.preventDefault()}
        className={`relative rounded-xl border-2 border-dashed transition-colors duration-150 px-6 py-10 text-center cursor-pointer
          ${dragging ? "border-accent bg-accent/5" : "border-base-border hover:border-accent/50 hover:bg-base-panel2/50"}`}
        onClick={handleBrowse}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-base-panel2 border border-base-border flex items-center justify-center text-2xl">
            📁
          </div>
          <div>
            <p className="font-medium text-slate-200">
              {loading ? "Scanning folder…" : "Drop Unity WebGL folder here"}
            </p>
            <p className="text-sm text-base-muted mt-1">or click to browse for a folder</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleBrowse();
            }}
            className="btn-secondary px-4 py-2 text-sm mt-1"
          >
            Browse Folder
          </button>
        </div>
      </div>

      {scan && (
        <div className="mt-5 rounded-xl border border-base-border bg-base-panel2/60 p-4 animate-fade-in">
          <p className="text-xs font-mono text-base-muted mb-3 truncate" title={scan.rootPath}>
            {scan.rootPath}
          </p>
          <ul className="space-y-1.5">
            {scan.files.map((f) => (
              <li
                key={f.relativePath}
                className={`flex items-center justify-between text-sm font-mono px-3 py-1.5 rounded-lg ${
                  f.found ? "text-ok bg-ok/5" : "text-danger bg-danger/5"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{f.found ? "✅" : "❌"}</span>
                  {f.relativePath}
                </span>
                {f.found && f.size !== undefined && (
                  <span className="text-base-muted">{formatBytes(f.size)}</span>
                )}
              </li>
            ))}
          </ul>
          {scan.allRequiredFound && (
            <p className="mt-3 text-xs text-ok flex items-center gap-1.5">
              <span>✓</span> All required files found — total {formatBytes(scan.totalSize)}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-danger flex items-center gap-1.5 animate-fade-in">
          <span>⚠</span> {error}
        </p>
      )}
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
