import { NETWORKS, type NetworkId } from "../types";

interface NetworkGridProps {
  selected: Set<NetworkId>;
  onToggle: (id: NetworkId) => void;
}

export default function NetworkGrid({ selected, onToggle }: NetworkGridProps) {
  return (
    <section className="panel p-6">
      <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
        <span className="text-accent">2.</span> Network Selection
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {NETWORKS.map((net) => {
          const isOn = selected.has(net.id);
          return (
            <button
              key={net.id}
              type="button"
              onClick={() => onToggle(net.id)}
              className={`text-left rounded-xl border p-4 transition-all duration-150 group
                ${isOn ? "border-accent/60 bg-accent/[0.06] shadow-glow" : "border-base-border bg-base-panel2/40 hover:border-base-border/80"}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-9 w-9 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${net.color}22`, color: net.color }}
                  >
                    {net.icon}
                  </span>
                  <span className="font-semibold text-slate-100">{net.name}</span>
                </div>
                <Toggle on={isOn} />
              </div>
              <div className="text-xs text-base-muted space-y-0.5 pl-11">
                <p>
                  Max: <span className="text-slate-300 font-medium">{net.maxLabel}</span>
                </p>
                {net.specLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={`toggle-track ${on ? "bg-accent" : "bg-base-border"}`}>
      <span className={`toggle-thumb ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </span>
  );
}
