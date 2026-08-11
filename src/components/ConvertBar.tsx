interface ConvertBarProps {
  disabled: boolean;
  reason?: string;
  onConvert: () => void;
}

export default function ConvertBar({ disabled, reason, onConvert }: ConvertBarProps) {
  return (
    <section className="panel p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-slate-200">Ready to export</p>
        <p className="text-xs text-base-muted mt-0.5">
          {disabled ? reason ?? "Select a WebGL folder and at least one network to continue." : "All set — build your playables."}
        </p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onConvert}
        className="btn-primary px-8 py-3.5 text-base w-full sm:w-auto"
      >
        Convert &amp; Export
      </button>
    </section>
  );
}
