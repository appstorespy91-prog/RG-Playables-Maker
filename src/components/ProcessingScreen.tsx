import { useEffect, useRef } from "react";
import type { LogLine } from "../types";

interface ProcessingScreenProps {
  percent: number;
  logs: LogLine[];
  onCancel: () => void;
}

const STATUS_ICON: Record<LogLine["status"], string> = {
  ok: "✓",
  warn: "⚠",
  error: "✗",
  info: "…",
};

const STATUS_COLOR: Record<LogLine["status"], string> = {
  ok: "text-ok",
  warn: "text-warn",
  error: "text-danger",
  info: "text-base-muted",
};

export default function ProcessingScreen({ percent, logs, onCancel }: ProcessingScreenProps) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [logs.length]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold text-white">Converting your playables…</h2>
        <p className="text-sm text-base-muted mt-1">
          Sit tight — building self-contained HTML for each selected network.
        </p>
      </div>

      <div className="panel p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-200">Progress</span>
          <span className="text-sm font-mono text-accent">{Math.round(percent)}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-base-panel2 border border-base-border overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-violet-400 transition-all duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-5 rounded-xl bg-black/40 border border-base-border h-72 overflow-y-auto font-mono text-xs p-4 space-y-1">
          {logs.length === 0 && <p className="text-base-muted">Waiting for conversion engine…</p>}
          {logs.map((line) => (
            <div key={line.id} className={`flex gap-2 ${STATUS_COLOR[line.status]}`}>
              <span className="w-4 shrink-0">[{STATUS_ICON[line.status]}]</span>
              <span className="text-slate-300/90">{line.message}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onCancel} className="btn-secondary px-5 py-2.5 text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
