// Prevents console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::prelude::*;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder,
};
use tokio::sync::oneshot;
use tokio_tungstenite::{connect_async, tungstenite::Message};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
struct Config {
    #[serde(default = "default_backend_url")]
    backend_url: String,
    #[serde(default)]
    device_id: String,
    #[serde(default)]
    api_key: String,
}

fn default_backend_url() -> String {
    "http://localhost:3000".to_string()
}

fn config_path() -> std::path::PathBuf {
    let mut p = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    p.push("PushIt");
    p.push("config.json");
    p
}

fn load_config() -> Config {
    std::fs::read_to_string(config_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn persist_config(config: &Config) {
    let path = config_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(path, serde_json::to_string_pretty(config).unwrap_or_default());
}

// ---------------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------------

struct ClientState {
    config: Mutex<Config>,
    ws_cancel: Mutex<Option<oneshot::Sender<()>>>,
}

// ---------------------------------------------------------------------------
// Notification payload (matches WS message from the backend)
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct NotificationPayload {
    #[serde(default)]
    notification_id: Option<String>,
    title: String,
    body: String,
    #[serde(default = "default_category")]
    category: String,
    #[serde(default)]
    image_url: Option<String>,
    #[serde(default)]
    ttl_seconds: Option<u64>,
}

fn default_category() -> String {
    "info".to_string()
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_config(state: State<ClientState>) -> Config {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
fn save_config(config: Config, state: State<ClientState>, app: AppHandle) {
    {
        let mut cfg = state.config.lock().unwrap();
        *cfg = config;
        persist_config(&cfg);
    }
    reconnect(&state, &app);
}

#[tauri::command]
fn close_overlay(webview_window: tauri::WebviewWindow) {
    let _ = webview_window.close();
}

// ---------------------------------------------------------------------------
// Tray helpers
// ---------------------------------------------------------------------------

fn update_tray(app: &AppHandle, status: &str) {
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(&format!("PushIt – {status}")));
    }
}

fn open_setup(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("setup") {
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(app, "setup", WebviewUrl::App("setup.html".into()))
        .title("PushIt – Einstellungen")
        .inner_size(480.0, 440.0)
        .resizable(false)
        .build();
}

// ---------------------------------------------------------------------------
// WebSocket connection management
// ---------------------------------------------------------------------------

fn reconnect(state: &ClientState, app: &AppHandle) {
    if let Some(tx) = state.ws_cancel.lock().unwrap().take() {
        let _ = tx.send(());
    }

    let config = state.config.lock().unwrap().clone();
    if config.backend_url.is_empty() || config.device_id.is_empty() || config.api_key.is_empty() {
        update_tray(app, "nicht konfiguriert");
        return;
    }

    let (tx, rx) = oneshot::channel();
    *state.ws_cancel.lock().unwrap() = Some(tx);

    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        ws_loop(config, app_clone, rx).await;
    });
}

async fn ws_loop(config: Config, app: AppHandle, mut cancel: oneshot::Receiver<()>) {
    loop {
        let ws_url = format!(
            "{}/api/v1/ws?apiKey={}&deviceId={}",
            config
                .backend_url
                .replace("http://", "ws://")
                .replace("https://", "wss://"),
            urlencoding::encode(&config.api_key),
            urlencoding::encode(&config.device_id),
        );

        match connect_async(&ws_url).await {
            Ok((mut stream, _)) => {
                update_tray(&app, "verbunden");
                let mut ping_tick =
                    tokio::time::interval(tokio::time::Duration::from_secs(30));

                loop {
                    tokio::select! {
                        _ = &mut cancel => return,
                        _ = ping_tick.tick() => {
                            let ping = serde_json::json!({"type": "ping"}).to_string();
                            if stream.send(Message::Text(ping.into())).await.is_err() {
                                break;
                            }
                        }
                        msg = stream.next() => {
                            match msg {
                                Some(Ok(Message::Text(text))) => {
                                    handle_message(&app, text.as_str());
                                }
                                Some(Err(_)) | None => break,
                                _ => {}
                            }
                        }
                    }
                }
                update_tray(&app, "getrennt");
            }
            Err(_) => {
                update_tray(&app, "Verbindungsfehler");
            }
        }

        // Wait 10 s before reconnecting, but respect cancel
        tokio::select! {
            _ = &mut cancel => return,
            _ = tokio::time::sleep(tokio::time::Duration::from_secs(10)) => {}
        }
    }
}

fn handle_message(app: &AppHandle, text: &str) {
    let Ok(json) = serde_json::from_str::<serde_json::Value>(text) else {
        return;
    };
    match json["type"].as_str() {
        Some("notification") => {
            if let Ok(payload) = serde_json::from_value::<NotificationPayload>(json) {
                show_overlay(app, payload);
            }
        }
        Some("error") => {
            let msg = json["message"].as_str().unwrap_or("Fehler");
            update_tray(app, &format!("Fehler: {msg}"));
        }
        _ => {}
    }
}

// ---------------------------------------------------------------------------
// Overlay window
// ---------------------------------------------------------------------------

fn show_overlay(app: &AppHandle, notif: NotificationPayload) {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let label = format!("overlay-{ts}");

    let json = serde_json::to_string(&notif).unwrap_or_default();
    let encoded = BASE64_STANDARD.encode(json.as_bytes());
    let url = format!("overlay.html?data={encoded}");

    let ttl_ms = notif.ttl_seconds.map(|s| s * 1000).unwrap_or(30_000).min(60_000);
    let category = notif.category.clone();
    let has_image = notif.image_url.is_some();
    let app_c = app.clone();

    let _ = app.run_on_main_thread(move || {
        let (sw, sh) = app_c
            .primary_monitor()
            .ok()
            .flatten()
            .map(|m| {
                let sf = m.scale_factor();
                let sz = m.size();
                ((sz.width as f64 / sf) as u32, (sz.height as f64 / sf) as u32)
            })
            .unwrap_or((1920, 1080));

        let (ww, wh) = if category == "emergency" {
            (sw * 2 / 3, sh * 2 / 3)
        } else {
            (420u32, if has_image { 280 } else { 160 })
        };
        let wx = (sw - ww) / 2;
        let wy = (sh - wh) / 2;

        if let Ok(win) = WebviewWindowBuilder::new(
            &app_c,
            &label,
            WebviewUrl::App(url.into()),
        )
        .inner_size(ww as f64, wh as f64)
        .position(wx as f64, wy as f64)
        .decorations(false)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .build()
        {
            let win_c = win.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_millis(ttl_ms)).await;
                let _ = win_c.close();
            });
        }
    });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

fn main() {
    let state = ClientState {
        config: Mutex::new(load_config()),
        ws_cancel: Mutex::new(None),
    };

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![get_config, save_config, close_overlay])
        .setup(|app| {
            let icon_bytes = include_bytes!("../icons/icon.png");
            let icon = tauri::image::Image::from_bytes(icon_bytes)?;

            let settings =
                MenuItem::with_id(app, "settings", "Einstellungen", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&settings, &sep, &quit])?;

            TrayIconBuilder::with_id("main")
                .icon(icon)
                .menu(&menu)
                .tooltip("PushIt – getrennt")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "settings" => open_setup(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            let state = app.state::<ClientState>();
            let cfg = state.config.lock().unwrap().clone();
            let app_handle = app.handle().clone();

            if !cfg.device_id.is_empty() && !cfg.api_key.is_empty() {
                reconnect(&state, &app_handle);
            } else {
                open_setup(&app_handle);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "setup" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("Tauri-App konnte nicht gestartet werden")
        .run(|_app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}
