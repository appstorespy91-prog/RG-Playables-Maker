use serde::{Deserialize, Serialize};
use std::path::Path;

/// The five files a valid Unity WebGL build must contain, relative to the
/// selected build root, paired with the friendly label shown in the UI.
pub const REQUIRED_FILES: [(&str, &str); 5] = [
    ("index.html", "index.html"),
    ("Build/game.wasm", "Build/game.wasm"),
    ("Build/game.data", "Build/game.data"),
    ("Build/game.framework.js", "Build/game.framework.js"),
    ("Build/game.loader.js", "Build/game.loader.js"),
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequiredFileCheck {
    pub label: String,
    pub relative_path: String,
    pub found: bool,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderScanResult {
    pub root_path: String,
    pub files: Vec<RequiredFileCheck>,
    pub all_required_found: bool,
    pub total_size: u64,
}

/// Scan a candidate Unity WebGL build folder and report which of the
/// required files are present, along with their sizes.
pub fn scan_folder(root: &str) -> Result<FolderScanResult, String> {
    let root_path = Path::new(root);
    if !root_path.is_dir() {
        return Err(format!("'{}' is not a valid directory", root));
    }

    let mut files = Vec::with_capacity(REQUIRED_FILES.len());
    let mut all_found = true;
    let mut total_size: u64 = 0;

    for (rel, label) in REQUIRED_FILES.iter() {
        let full = root_path.join(rel);
        match std::fs::metadata(&full) {
            Ok(meta) if meta.is_file() => {
                total_size += meta.len();
                files.push(RequiredFileCheck {
                    label: label.to_string(),
                    relative_path: rel.to_string(),
                    found: true,
                    size: Some(meta.len()),
                });
            }
            _ => {
                all_found = false;
                files.push(RequiredFileCheck {
                    label: label.to_string(),
                    relative_path: rel.to_string(),
                    found: false,
                    size: None,
                });
            }
        }
    }

    Ok(FolderScanResult {
        root_path: root.to_string(),
        files,
        all_required_found: all_found,
        total_size,
    })
}
