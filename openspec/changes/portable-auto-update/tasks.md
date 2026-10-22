# Tasks

## 1. Release Tooling & R2 Scripting

- [x] 1.1 Implement `scripts/release.cjs` to validate semver input, synchronize versions across `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`, and generate release `latest.json` pointing to Cloudflare R2 assets domain; register `pnpm release` script in `package.json`.
- [x] 1.2 Retain `deploy/cloudflare-worker-updater.js` as an edge caching proxy and document Cloudflare R2 bucket binding instructions.

## 2. Go Backend Cloudflare R2 Media Storage

- [x] 2.1 Add AWS S3 SDK v2 dependencies to `server/go.mod` and run `go mod tidy`.
- [x] 2.2 Implement `server/internal/storage/` with `StorageDriver` interface, `LocalStorageDriver`, and `R2StorageDriver`, including unit tests.
- [x] 2.3 Integrate storage driver into `server/internal/config/config.go` and `server/internal/handler/media_handler.go`, and verify backend test suite passes cleanly.

## 3. Rust Portable Updater Engine (In-Place Rename)

- [x] 3.1 Verify `src-tauri/src/updater.rs` aligns default check endpoint with Cloudflare R2 release manifest domain, retaining In-place Rename hot swap and verify via `cargo check`.

## 4. Frontend Interaction & Status Presentation

- [x] 4.1 Verify `src/lib/portableUpdater.ts` and `SettingsDialog.tsx` correctly expose updater lifecycle states.

## 5. Verification & Validation

- [x] 5.1 Run `pnpm build` and `pnpm lint:boundaries` to verify zero frontend errors.
- [x] 5.2 Run `go -C server test ./...` and `go -C server build ./cmd/server` to verify backend build and test pass.
- [x] 5.3 Run `cargo check` inside `src-tauri/` to verify zero Rust compilation errors.
- [x] 5.4 Run `openspec validate portable-auto-update` to verify artifact conformance.
