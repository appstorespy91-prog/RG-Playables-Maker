import { useState } from "react";
import { NETWORKS, type OutputFile } from "../types";
import { openPath, revealInFolder } from "../lib/tauri";

interface ResultsScreenProps {
  files: OutputFile[];
  outputFolder: string;
  onConvertAnother: () => void;
}

const STATUS_STYLES: Record<OutputFile["status"], { label: string; className: string; icon: string }> = {
  ok: { label: "OK", className: "text-ok bg-ok/10 border-ok/30", icon: "✅" },
  caution: { label: "CAUTION", className: "text-warn bg-warn/10 border-warn/30", icon: "⚠️" },
  over: { label: "OVER LIMIT", className: "text-danger bg-danger/10 border-danger/30", icon: "🚫" },
};

export default function ResultsScreen({ files, outputFolder, onConvertAnother }: ResultsScreenProps) {
  const anyOver = files.some((f) => f.status === "over");
  const anyCaution = files.some((f) => f.status === "caution");

  return (
    <div className="max-w-4xl mx-auto px-6 py-14 animate-fade-in">
      <div className="text-center mb-10">
        <div className="mx-auto h-16 w-16 rounded-full bg-ok/10 border border-ok/30 flex items-center justify-center text-3xl animate-check-pop">
          ✅
        </div>
        <h2 className="text-xl font-bold text-white mt-4">Export complete!</h2>
        <p className="text-sm text-base-muted mt-1">
          {files.length} playable{files.length === 1 ? "" : "s"} generated in{" "}
          <span className="font-mono text-slate-300">{outputFolder}</span>
        </p>
      </div>

      {(anyOver || anyCaution) && (
        <div
          className={`mb-6 rounded-xl border p-4 text-sm flex items-start gap-2 ${
            anyOver ? "border-danger/40 bg-danger/5 text-danger" : "border-warn/40 bg-warn/5 text-warn"
          }`}
        >
          <span>{anyOver ? "🚫" : "⚠️"}</span>
          <span>
            {anyOver
              ? "One or more files exceed their network's size limit. Increase compression or trim assets before uploading."
              : "One or more files are close to their network's size limit — keep an eye on future asset additions."}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {files.map((file) => (
          <FileCard key={`${file.network}-${file.orientation}`} file={file} />
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          type="button"
          onClick={() => revealInFolder(outputFolder).catch(() => {})}
          className="btn-secondary px-6 py-3 text-sm"
        >
          Open Output Folder
        </button>
        <button type="button" onClick={onConvertAnother} className="btn-primary px-6 py-3 text-sm">
          Convert Another
        </button>
      </div>
    </div>
  );
}

function FileCard({ file }: { file: OutputFile }) {
  const [copied, setCopied] = useState(false);
  const net = NETWORKS.find((n) => n.id === file.network);
  const status = STATUS_STYLES[file.status];

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(file.path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — silently ignore
    }
  };

  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-lg shrink-0">📄</span>
          <p className="font-mono text-sm text-slate-200 truncate" title={file.fileName}>
            {file.fileName}
          </p>
        </div>
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border ${status.className}`}>
          {status.icon} {status.label}
        </span>
      </div>

      <div className="text-xs text-base-muted space-y-1 mb-4">
        <p>
          Size: <span className="text-slate-300 font-medium">{formatBytes(file.sizeBytes)}</span>{" "}
          <span className="text-base-muted">(limit: {formatBytes(file.limitBytes)})</span>
        </p>
        <p>
          Network: <span className="text-slate-300">{net?.name ?? file.network}</span> ·{" "}
          <span className="capitalize text-slate-300">{file.orientation}</span>
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => openPath(file.path).catch(() => {})}
          className="btn-secondary flex-1 px-3 py-2 text-xs"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={() => revealInFolder(file.path).catch(() => {})}
          className="btn-secondary flex-1 px-3 py-2 text-xs"
        >
          Open Folder
        </button>
        <button type="button" onClick={copyPath} className="btn-secondary flex-1 px-3 py-2 text-xs">
          {copied ? "Copied!" : "Copy Path"}
        </button>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}
