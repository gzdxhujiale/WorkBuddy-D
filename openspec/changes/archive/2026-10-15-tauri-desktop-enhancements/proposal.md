# Proposal: Tauri 2 Desktop Native Capabilities Integration

## Summary

Integrate key desktop capabilities into WorkBuddy-D's Tauri 2 runtime to elevate user experience from a generic web container to a native, professional desktop application:
1. **Single Instance (`tauri-plugin-single-instance`)**: Ensure only one process instance runs. When a user tries to launch the app again or clicks the app icon, focus and restore the existing main window instead of creating duplicate processes.
2. **Window State Persistence (`tauri-plugin-window-state`)**: Persist and restore the main window's size, position, and maximized state across application reboots and reloads.
3. **Global Shortcut Management (`tauri-plugin-global-shortcut`)**: Equip the desktop shell with global hotkey support (e.g. quick toggle of main window / focus mode) and expose capabilities to both Rust runtime and frontend capabilities.

## Motivation & Benefits

- **Prevent process duplication & resource contention**: Without single-instance protection, multiple WorkBuddy processes can run simultaneously, creating database connection spikes, conflicting WebSocket connections, and confusing multiple tray icons.
- **Desktop UX polish**: Remembering window coordinates and size is a core expectation for desktop productivity tools.
- **Productivity boost**: Global hotkeys allow summoning or hiding the application instantly from anywhere in the OS without Alt+Tabbing or clicking tray icons.

## Scope

- In Scope:
  - Add Tauri v2 plugin dependencies (`tauri-plugin-single-instance`, `tauri-plugin-window-state`, `tauri-plugin-global-shortcut`) to `src-tauri/Cargo.toml`.
  - Register and initialize plugins in `src-tauri/src/lib.rs`.
  - Configure single-instance callback to unminimize and focus the `"main"` window on second launch.
  - Configure window-state persistence for the main window.
  - Update `src-tauri/capabilities/default.json` with necessary plugin permissions.
  - Validate with `cargo check` and `pnpm build`.
- Out of Scope:
  - Non-desktop platforms (mobile targets are untouched).
  - Business logic changes in task or habit management.
