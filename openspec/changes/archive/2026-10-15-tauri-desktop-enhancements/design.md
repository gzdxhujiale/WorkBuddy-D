# Design: Tauri 2 Desktop Native Capabilities Integration

## Architecture & Plugin Topology

### 1. Single Instance Lifecycle
- **Crate**: `tauri-plugin-single-instance = "2"`
- **Hook**: Registered on `tauri::Builder` before `run()`.
- **Behavior**: When a secondary instance launches, the closure receives `(app, _args, _cwd)`:
  - Finds the webview window with label `"main"`.
  - Executes `window.show()`, `window.unminimize()`, and `window.set_focus()`.
  - The secondary launch process exits cleanly without spawning an additional webview or process.

### 2. Window State Persistence
- **Crate**: `tauri-plugin-window-state = "2"`
- **Configuration**:
  - Registered via `tauri_plugin_window_state::Builder::default().build()`.
  - Automatically captures and restores `main` window geometry and state (position, size, maximized) in the local user app config directory.
  - Floating temporary windows (like `notify-toast-*` and `notify-center-modal`) are ephemeral and bypass state restoration.

### 3. Global Shortcut Support
- **Crate**: `tauri-plugin-global-shortcut = "2"`
- **Configuration**:
  - Registered via `tauri_plugin_global_shortcut::Builder::new().build()`.
  - Permissions added to `src-tauri/capabilities/default.json` (`"global-shortcut:allow-is-registered"`, `"global-shortcut:allow-register"`, `"global-shortcut:allow-unregister"`).
  - Can be registered in Rust setup or invoked dynamically by frontend components.

### 4. Tauri Capabilities & Permissions
- Update `src-tauri/capabilities/default.json` to grant permissions:
  - `global-shortcut:default`
  - `window-state:default`
