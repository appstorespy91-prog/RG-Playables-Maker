use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

pub const PROGRESS_EVENT: &str = "pf://progress";

/// Shape of the job sent to the Python converter. Kept intentionally loose
/// (settings passed through as a raw JSON value) so the frontend's settings
/// panel can evolve without needing matching Rust structs.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertJob {
    pub input_path: String,
    pub output_folder: String,
    pub networks: Vec<String>,
    pub settings: serde_json::Value,
}

#[derive(Default)]
pub struct ConversionState {
    pub child: Mutex<Option<Child>>,
}

fn resolve_python_bin() -> Result<String, String> {
    for candidate in ["python3", "python"] {
        if which::which(candidate).is_ok() {
            return Ok(candidate.to_string());
        }
    }
    Err("No Python 3 interpreter found on PATH. Please install Python 3.".into())
}

/// Locate converter.py, preferring the bundled resource copy in production
/// builds and falling back to the repo-relative path during `tauri dev`.
fn resolve_converter_script(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(resource_path) = app
        .path()
        .resolve("src-python/converter.py", tauri::path::BaseDirectory::Resource)
    {
        if resource_path.exists() {
            return Ok(resource_path);
        }
    }

    // Dev fallback: <project root>/src-python/converter.py
    let dev_path = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .join("src-python")
        .join("converter.py");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    let dev_parent_path = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .parent()
        .map(|p| p.join("src-python").join("converter.py"));
    if let Some(p) = dev_parent_path {
        if p.exists() {
            return Ok(p);
        }
    }

    Err("Could not locate the PlayableForge conversion engine (converter.py)".into())
}

#[tauri::command]
pub fn start_conversion(
    app: AppHandle,
    state: State<'_, ConversionState>,
    job: ConvertJob,
) -> Result<(), String> {
    {
        let existing = state.child.lock().map_err(|e| e.to_string())?;
        if existing.is_some() {
            return Err("A conversion is already in progress".into());
        }
    }

    let python_bin = resolve_python_bin()?;
    let script_path = resolve_converter_script(&app)?;

    let mut cmd = Command::new(python_bin);
    cmd.arg(script_path)
        .arg("--job")
        .arg("-")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to start conversion engine: {e}"))?;

    let job_json = serde_json::to_string(&job).map_err(|e| e.to_string())?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(job_json.as_bytes())
            .map_err(|e| format!("Failed to send job to conversion engine: {e}"))?;
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture conversion engine output".to_string())?;
    let stderr = child.stderr.take();

    {
        let mut guard = state.child.lock().map_err(|e| e.to_string())?;
        *guard = Some(child);
    }

    let app_for_stdout = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().map_while(Result::ok) {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            match serde_json::from_str::<serde_json::Value>(trimmed) {
                Ok(value) => {
                    let _ = app_for_stdout.emit(PROGRESS_EVENT, value);
                }
                Err(_) => {
                    let _ = app_for_stdout.emit(
                        PROGRESS_EVENT,
                        serde_json::json!({ "type": "log", "status": "info", "message": trimmed }),
                    );
                }
            }
        }
    });

    if let Some(stderr) = stderr {
        let app_for_stderr = app.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                let _ = app_for_stderr.emit(
                    PROGRESS_EVENT,
                    serde_json::json!({ "type": "log", "status": "error", "message": trimmed }),
                );
            }
        });
    }

    // Reap the child once it exits so a cancelled/finished process doesn't
    // linger as a zombie, and clear conversion state.
    let app_for_wait = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_millis(200));
        let state: State<'_, ConversionState> = app_for_wait.state();
        let mut guard = match state.child.lock() {
            Ok(g) => g,
            Err(_) => break,
        };
        if let Some(child) = guard.as_mut() {
            match child.try_wait() {
                Ok(Some(_status)) => {
                    *guard = None;
                    break;
                }
                Ok(None) => continue,
                Err(_) => {
                    *guard = None;
                    break;
                }
            }
        } else {
            break;
        }
    });

    Ok(())
}

#[tauri::command]
pub fn cancel_conversion(state: State<'_, ConversionState>) -> Result<(), String> {
    let mut guard = state.child.lock().map_err(|e| e.to_string())?;
    if let Some(child) = guard.as_mut() {
        child.kill().map_err(|e| e.to_string())?;
    }
    *guard = None;
    Ok(())
}
