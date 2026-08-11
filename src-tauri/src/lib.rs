mod converter;
mod scan;

use converter::{cancel_conversion, start_conversion, ConversionState};
use scan::{scan_folder as scan_folder_impl, FolderScanResult};

#[tauri::command]
fn scan_folder(path: String) -> Result<FolderScanResult, String> {
    scan_folder_impl(&path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ConversionState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            scan_folder,
            start_conversion,
            cancel_conversion
        ])
        .run(tauri::generate_context!())
        .expect("error while running PlayableForge");
}
