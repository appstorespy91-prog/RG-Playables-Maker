import { useCallback, useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import DropZone from "./components/DropZone";
import NetworkGrid from "./components/NetworkGrid";
import SettingsPanel from "./components/SettingsPanel";
import ConvertBar from "./components/ConvertBar";
import ProcessingScreen from "./components/ProcessingScreen";
import ResultsScreen from "./components/ResultsScreen";
import type {
  ConvertSettings,
  FolderScanResult,
  LogLine,
  NetworkId,
  OutputFile,
  Screen,
} from "./types";
import { cancelConversion, isTauri, onConversionProgress, startConversion } from "./lib/tauri";

const DEFAULT_SETTINGS: ConvertSettings = {
  compressionLevel: 6,
  outputFolder: "",
  endCard: {
    enabled: true,
    text: "Download Now",
    color: "#FF6B35",
    delaySeconds: 15,
  },
  portrait: true,
  landscape: false,
};

let logIdCounter = 0;

export default function App() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [scan, setScan] = useState<FolderScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedNetworks, setSelectedNetworks] = useState<Set<NetworkId>>(
    new Set(["mintegral", "applovin", "google", "tiktok"])
  );
  const [settings, setSettings] = useState<ConvertSettings>(DEFAULT_SETTINGS);

  const [percent, setPercent] = useState(0);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [resultFiles, setResultFiles] = useState<OutputFile[]>([]);
  const [conversionError, setConversionError] = useState<string | null>(null);

  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => () => unlistenRef.current?.(), []);

  const toggleNetwork = (id: NetworkId) => {
    setSelectedNetworks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resolvedOutputFolder =
    settings.outputFolder || (scan ? `${scan.rootPath.replace(/[/\\]+$/, "")}_playables` : "");

  const canConvert = !!scan?.allRequiredFound && selectedNetworks.size > 0 && (settings.portrait || settings.landscape);

  const disabledReason = !scan?.allRequiredFound
    ? "Select a valid Unity WebGL build folder to continue."
    : selectedNetworks.size === 0
      ? "Select at least one ad network."
      : !(settings.portrait || settings.landscape)
        ? "Enable at least one orientation in Settings."
        : undefined;

  const handleConvert = useCallback(async () => {
    if (!scan) return;
    setLogs([]);
    setPercent(0);
    setConversionError(null);
    setResultFiles([]);
    setScreen("processing");

    unlistenRef.current = await onConversionProgress((event) => {
      if (event.type === "log") {
        setLogs((prev) => [
          ...prev,
          {
            id: ++logIdCounter,
            status: event.status ?? "info",
            message: event.message ?? "",
            timestamp: Date.now(),
          },
        ]);
      } else if (event.type === "progress" && typeof event.percent === "number") {
        setPercent(event.percent);
      } else if (event.type === "done") {
        setResultFiles(event.files ?? []);
        setScreen("results");
        unlistenRef.current?.();
        unlistenRef.current = null;
      } else if (event.type === "error") {
        setConversionError(event.error ?? "Conversion failed");
        setLogs((prev) => [
          ...prev,
          {
            id: ++logIdCounter,
            status: "error",
            message: event.error ?? "Conversion failed",
            timestamp: Date.now(),
          },
        ]);
      }
    });

    try {
      if (!isTauri) {
        throw new Error("Conversion requires the PlayableForge desktop app.");
      }
      await startConversion({
        inputPath: scan.rootPath,
        outputFolder: resolvedOutputFolder,
        networks: Array.from(selectedNetworks),
        settings,
      });
    } catch (e) {
      setConversionError(String(e));
      setLogs((prev) => [...prev, { id: ++logIdCounter, status: "error", message: String(e), timestamp: Date.now() }]);
    }
  }, [scan, selectedNetworks, settings, resolvedOutputFolder]);

  const handleCancel = async () => {
    try {
      if (isTauri) await cancelConversion();
    } finally {
      unlistenRef.current?.();
      unlistenRef.current = null;
      setScreen("dashboard");
    }
  };

  const handleConvertAnother = () => {
    setScreen("dashboard");
    setResultFiles([]);
    setLogs([]);
    setPercent(0);
  };

  return (
    <div className="min-h-screen bg-base-bg">
      <Header />

      {screen === "dashboard" && (
        <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
          <DropZone scan={scan} onScan={setScan} error={scanError} onError={setScanError} />
          <NetworkGrid selected={selectedNetworks} onToggle={toggleNetwork} />
          <SettingsPanel
            settings={{ ...settings, outputFolder: resolvedOutputFolder }}
            onChange={setSettings}
          />
          <ConvertBar disabled={!canConvert} reason={disabledReason} onConvert={handleConvert} />
        </main>
      )}

      {screen === "processing" && (
        <ProcessingScreen percent={percent} logs={logs} onCancel={handleCancel} />
      )}

      {screen === "results" && !conversionError && (
        <ResultsScreen
          files={resultFiles}
          outputFolder={resolvedOutputFolder}
          onConvertAnother={handleConvertAnother}
        />
      )}

      {conversionError && screen !== "dashboard" && (
        <div className="max-w-2xl mx-auto px-6 py-16 text-center animate-fade-in">
          <div className="mx-auto h-16 w-16 rounded-full bg-danger/10 border border-danger/30 flex items-center justify-center text-3xl">
            ✗
          </div>
          <h2 className="text-xl font-bold text-white mt-4">Conversion failed</h2>
          <p className="text-sm text-base-muted mt-2 font-mono">{conversionError}</p>
          <button type="button" onClick={handleConvertAnother} className="btn-primary px-6 py-3 text-sm mt-6">
            Back to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
