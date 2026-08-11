import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { revealItemInDir, openPath as openerOpenPath } from "@tauri-apps/plugin-opener";
import type { ConvertProgressEvent, ConvertSettings, FolderScanResult, NetworkId } from "../types";

/** True when running inside the Tauri desktop shell; false in a plain browser
 * preview (e.g. `npm run dev` opened directly in a browser tab). */
export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function scanFolder(path: string): Promise<FolderScanResult> {
  return invoke<FolderScanResult>("scan_folder", { path });
}

export async function browseForFolder(): Promise<string | null> {
  const selected = await openDialog({ directory: true, multiple: false, title: "Select Unity WebGL build folder" });
  if (!selected) return null;
  return Array.isArray(selected) ? selected[0] ?? null : selected;
}

export async function browseForOutputFolder(): Promise<string | null> {
  const selected = await openDialog({ directory: true, multiple: false, title: "Select output folder" });
  if (!selected) return null;
  return Array.isArray(selected) ? selected[0] ?? null : selected;
}

export interface StartConversionArgs {
  inputPath: string;
  outputFolder: string;
  networks: NetworkId[];
  settings: ConvertSettings;
}

export async function startConversion(args: StartConversionArgs): Promise<void> {
  await invoke("start_conversion", {
    job: {
      inputPath: args.inputPath,
      outputFolder: args.outputFolder,
      networks: args.networks,
      settings: args.settings,
    },
  });
}

export async function cancelConversion(): Promise<void> {
  await invoke("cancel_conversion");
}

export async function onConversionProgress(
  handler: (event: ConvertProgressEvent) => void
): Promise<() => void> {
  const unlisten = await listen<ConvertProgressEvent>("pf://progress", (e) => handler(e.payload));
  return unlisten;
}

export async function onFolderDrop(handler: (paths: string[]) => void): Promise<() => void> {
  const webview = getCurrentWebview();
  const unlisten = await webview.onDragDropEvent((event) => {
    if (event.payload.type === "drop") {
      handler(event.payload.paths);
    }
  });
  return unlisten;
}

export async function revealInFolder(path: string): Promise<void> {
  await revealItemInDir(path);
}

export async function openPath(path: string): Promise<void> {
  await openerOpenPath(path);
}
