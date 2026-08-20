use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

fn urlencode_str(s: &str) -> String {
    let mut encoded = String::new();
    for byte in s.bytes() {
        match byte {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            _ => {
                encoded.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    encoded
}

#[tauri::command]
async fn show_multi_monitor_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
    pet_type: String,
    theme_style: String,
    event_type: String,
    task_id: Option<String>,
) -> Result<(), String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    for (idx, monitor) in monitors.iter().enumerate() {
        let label = format!("notify-toast-{}", idx);
        if let Some(existing) = app.get_webview_window(&label) {
            let _ = existing.destroy();
        }

        let pos = monitor.position();
        let size = monitor.size();
        let scale_factor = monitor.scale_factor();

        let toast_w = 340.0;
        let toast_h = 96.0;
        let margin_x = 24.0;
        let margin_y = 36.0;

        let phys_w = (toast_w * scale_factor) as i32;
        let phys_h = (toast_h * scale_factor) as i32;
        let phys_margin_x = (margin_x * scale_factor) as i32;
        let phys_margin_y = (margin_y * scale_factor) as i32;

        let target_x = pos.x + size.width as i32 - phys_w - phys_margin_x;
        let target_y = pos.y + size.height as i32 - phys_h - phys_margin_y;

        let mut query = format!(
            "idx={}&title={}&body={}&pet={}&theme={}&type={}",
            idx,
            urlencode_str(&title),
            urlencode_str(&body),
            urlencode_str(&pet_type),
            urlencode_str(&theme_style),
            urlencode_str(&event_type),
        );
        if let Some(ref tid) = task_id {
            query.push_str(&format!("&task_id={}", urlencode_str(tid)));
        }
        let url = format!("notification-toast.html?{}", query);

        let builder = tauri::WebviewWindowBuilder::new(
            &app,
            &label,
            tauri::WebviewUrl::App(url.into()),
        )
        .title("WorkBuddy 提示")
        .inner_size(toast_w, toast_h)
        .position(target_x as f64 / scale_factor, target_y as f64 / scale_factor)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focusable(false);

        if let Ok(win) = builder.build() {
            let _ = win.set_always_on_top(true);
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            let quit_item = MenuItem::with_id(app, "quit", "退出 WorkBuddy", true, None::<&str>)?;
            let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .tooltip("WorkBuddy - 四象限任务管理")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            quit_app,
            show_multi_monitor_notification
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
