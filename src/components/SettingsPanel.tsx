import { useState } from "react";
import type { ConvertSettings } from "../types";
import { browseForOutputFolder, isTauri } from "../lib/tauri";

interface SettingsPanelProps {
  settings: ConvertSettings;
  onChange: (settings: ConvertSettings) => void;
}

export default function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const [open, setOpen] = useState(false);

  const set = <K extends keyof ConvertSettings>(key: K, value: ConvertSettings[K]) =>
    onChange({ ...settings, [key]: value });

  const setEndCard = <K extends keyof ConvertSettings["endCard"]>(
    key: K,
    value: ConvertSettings["endCard"][K]
  ) => onChange({ ...settings, endCard: { ...settings.endCard, [key]: value } });

  const pickOutputFolder = async () => {
    if (!isTauri) return;
    const folder = await browseForOutputFolder();
    if (folder) set("outputFolder", folder);
  };

  return (
    <section className="panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-slate-300"
      >
        <span className="flex items-center gap-2">
          <span className="text-accent">3.</span> Settings
        </span>
        <span className={`text-base-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-medium text-base-muted flex justify-between mb-2">
                Compression level
                <span className="text-slate-300 font-mono">{settings.compressionLevel}</span>
              </label>
              <input
                type="range"
                min={1}
                max={9}
                value={settings.compressionLevel}
                onChange={(e) => set("compressionLevel", Number(e.target.value))}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-[10px] text-base-muted mt-1">
                <span>Fast</span>
                <span>Smallest</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-base-muted mb-2 block">Output folder</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={settings.outputFolder || "Not selected"}
                  className="flex-1 min-w-0 truncate rounded-lg bg-base-panel2 border border-base-border px-3 py-2 text-xs font-mono text-slate-300"
                />
                <button type="button" onClick={pickOutputFolder} className="btn-secondary px-3 py-2 text-xs shrink-0">
                  Choose…
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-base-border p-4 bg-base-panel2/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">Add end card</p>
                <p className="text-xs text-base-muted">Overlay a CTA button after the game plays</p>
              </div>
              <button
                type="button"
                onClick={() => setEndCard("enabled", !settings.endCard.enabled)}
                className={`toggle-track ${settings.endCard.enabled ? "bg-accent" : "bg-base-border"}`}
              >
                <span
                  className={`toggle-thumb ${settings.endCard.enabled ? "translate-x-[22px]" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {settings.endCard.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 animate-fade-in">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-base-muted mb-1.5 block">End card text</label>
                  <input
                    value={settings.endCard.text}
                    onChange={(e) => setEndCard("text", e.target.value)}
                    placeholder="Download Now"
                    className="w-full rounded-lg bg-base-panel2 border border-base-border px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-base-muted mb-1.5 block">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.endCard.color}
                      onChange={(e) => setEndCard("color", e.target.value)}
                      className="h-9 w-9 rounded-lg border border-base-border bg-transparent cursor-pointer"
                    />
                    <span className="text-xs font-mono text-base-muted">{settings.endCard.color}</span>
                  </div>
                </div>
                <div className="sm:col-span-3">
                  <label className="text-xs font-medium text-base-muted flex justify-between mb-1.5">
                    Show after
                    <span className="text-slate-300 font-mono">{settings.endCard.delaySeconds}s</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={settings.endCard.delaySeconds}
                    onChange={(e) => setEndCard("delaySeconds", Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <OrientationToggle
              label="Portrait version"
              on={settings.portrait}
              onClick={() => set("portrait", !settings.portrait)}
            />
            <OrientationToggle
              label="Landscape version"
              on={settings.landscape}
              onClick={() => set("landscape", !settings.landscape)}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function OrientationToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors
        ${on ? "border-accent/60 bg-accent/[0.06] text-slate-100" : "border-base-border bg-base-panel2/40 text-base-muted"}`}
    >
      <span className={`toggle-track ${on ? "bg-accent" : "bg-base-border"}`}>
        <span className={`toggle-thumb ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </span>
      {label}
    </button>
  );
}
