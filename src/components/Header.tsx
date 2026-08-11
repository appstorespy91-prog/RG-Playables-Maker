import Logo from "./Logo";

const APP_VERSION = "1.0.0";

export default function Header() {
  return (
    <header className="flex items-center justify-between px-8 py-5 border-b border-base-border bg-base-bg/80 backdrop-blur sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <Logo size={34} />
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-bold tracking-tight text-white">PlayableForge</h1>
          <span className="text-xs font-mono text-base-muted">v{APP_VERSION}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-base-muted">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-base-panel2 border border-base-border">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          Unity WebGL → Playable Ad Converter
        </span>
      </div>
    </header>
  );
}
