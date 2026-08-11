use serde::{Deserialize, Serialize};
use std::path::Path;

/// Real Unity WebGL builds name their Build/ files after the project's
/// *Product Name* (e.g. `demo.wasm`, `MyGame.loader.js`), not literally
/// "game.*". So instead of a hardcoded filename we match each required
/// asset by its distinguishing suffix within Build/.
const BUILD_SUFFIXES: [(&str, &str); 4] = [
    (".loader.js", "Build/*.loader.js (Unity loader script)"),
    (".framework.js", "Build/*.framework.js (Unity framework)"),
    (".wasm", "Build/*.wasm (WebAssembly code)"),
    (".data", "Build/*.data (game data)"),
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

/// Find the single file directly inside `dir` whose name ends with `suffix`
/// (case-insensitive). Returns `None` if zero or more than one match — an
/// ambiguous build folder is treated the same as a missing file.
fn find_by_suffix(dir: &Path, suffix: &str) -> Option<(String, u64)> {
    let entries = std::fs::read_dir(dir).ok()?;
    let mut matches = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path.file_name()?.to_string_lossy().to_string();
        if name.to_lowercase().ends_with(suffix) {
            if let Ok(meta) = entry.metadata() {
                matches.push((name, meta.len()));
            }
        }
    }
    if matches.len() == 1 {
        matches.pop()
    } else {
        None
    }
}

/// Scan a candidate Unity WebGL build folder and report which of the
/// required files are present, along with their sizes.
pub fn scan_folder(root: &str) -> Result<FolderScanResult, String> {
    let root_path = Path::new(root);
    if !root_path.is_dir() {
        return Err(format!("'{}' is not a valid directory", root));
    }

    let mut files = Vec::with_capacity(5);
    let mut all_found = true;
    let mut total_size: u64 = 0;

    // index.html at the build root
    let index_path = root_path.join("index.html");
    match std::fs::metadata(&index_path) {
        Ok(meta) if meta.is_file() => {
            total_size += meta.len();
            files.push(RequiredFileCheck {
                label: "index.html".to_string(),
                relative_path: "index.html".to_string(),
                found: true,
                size: Some(meta.len()),
            });
        }
        _ => {
            all_found = false;
            files.push(RequiredFileCheck {
                label: "index.html".to_string(),
                relative_path: "index.html".to_string(),
                found: false,
                size: None,
            });
        }
    }

    let build_dir = root_path.join("Build");
    for (suffix, label) in BUILD_SUFFIXES.iter() {
        match find_by_suffix(&build_dir, suffix) {
            Some((name, size)) => {
                total_size += size;
                files.push(RequiredFileCheck {
                    label: label.to_string(),
                    relative_path: format!("Build/{name}"),
                    found: true,
                    size: Some(size),
                });
            }
            None => {
                all_found = false;
                files.push(RequiredFileCheck {
                    label: label.to_string(),
                    relative_path: label.to_string(),
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
