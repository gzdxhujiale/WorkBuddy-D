# Tasks: Tauri 2 Desktop Native Capabilities Integration

## 1. Rust Dependencies & Capabilities Setup

- [x] 1.1 Add `tauri-plugin-single-instance = "2"`, `tauri-plugin-window-state = "2"`, and `tauri-plugin-global-shortcut = "2"` to `src-tauri/Cargo.toml`.
- [x] 1.2 Update `src-tauri/capabilities/default.json` with permissions for `global-shortcut:default` and `window-state:default`.

## 2. Plugin Initialization & Event Handling

- [x] 2.1 Update `src-tauri/src/lib.rs` to register `tauri_plugin_single_instance` with automatic window focus on second launch.
- [x] 2.2 Update `src-tauri/src/lib.rs` to register `tauri_plugin_window_state` for window geometry persistence.
- [x] 2.3 Update `src-tauri/src/lib.rs` to register `tauri_plugin_global_shortcut`.

## 3. Verification & Compilation

- [x] 3.1 Run `cargo check` in `src-tauri/` to verify Rust code compiles without errors.
- [x] 3.2 Run `pnpm build` to verify frontend compilation continues to pass.
