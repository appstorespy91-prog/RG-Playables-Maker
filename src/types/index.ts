export type NetworkId = "mintegral" | "applovin" | "google" | "tiktok";

export interface NetworkSpec {
  id: NetworkId;
  name: string;
  icon: string;
  maxBytes: number;
  maxLabel: string;
  specLines: string[];
  color: string;
}

export const NETWORKS: NetworkSpec[] = [
  {
    id: "mintegral",
    name: "Mintegral",
    icon: "\u{1F3AF}",
    maxBytes: 2 * 1024 * 1024,
    maxLabel: "2MB",
    specLines: ["MRAID: No", "Single HTML"],
    color: "#f97316",
  },
  {
    id: "applovin",
    name: "AppLovin (MAX)",
    icon: "⚡",
    maxBytes: 2 * 1024 * 1024,
    maxLabel: "2MB",
    specLines: ["MRAID: 2.0", "Single HTML"],
    color: "#3b82f6",
  },
  {
    id: "google",
    name: "Google UAC",
    icon: "\u{1F535}",
    maxBytes: 5 * 1024 * 1024,
    maxLabel: "5MB",
    specLines: ["ZIP supported", "Landscape + Portrait"],
    color: "#22c55e",
  },
  {
    id: "tiktok",
    name: "TikTok / Pangle",
    icon: "\u{1F3B5}",
    maxBytes: 2 * 1024 * 1024,
    maxLabel: "2MB",
    specLines: ["Pangle SDK", "Touch events"],
    color: "#ec4899",
  },
];

export interface RequiredFileCheck {
  label: string;
  relativePath: string;
  found: boolean;
  size?: number;
}

export interface FolderScanResult {
  rootPath: string;
  files: RequiredFileCheck[];
  allRequiredFound: boolean;
  totalSize: number;
}

export interface EndCardSettings {
  enabled: boolean;
  text: string;
  color: string;
  delaySeconds: number;
}

export interface ConvertSettings {
  compressionLevel: number; // 1-9
  outputFolder: string;
  endCard: EndCardSettings;
  portrait: boolean;
  landscape: boolean;
}

export interface LogLine {
  id: number;
  status: "ok" | "warn" | "error" | "info";
  message: string;
  timestamp: number;
}

export type SizeStatus = "ok" | "caution" | "over";

export interface OutputFile {
  network: NetworkId;
  fileName: string;
  path: string;
  sizeBytes: number;
  originalSizeBytes: number;
  limitBytes: number;
  status: SizeStatus;
  orientation: "portrait" | "landscape";
}

export interface ConvertProgressEvent {
  type: "log" | "progress" | "done" | "error";
  message?: string;
  status?: "ok" | "warn" | "error" | "info";
  percent?: number;
  files?: OutputFile[];
  error?: string;
}

export type Screen = "dashboard" | "processing" | "results";
