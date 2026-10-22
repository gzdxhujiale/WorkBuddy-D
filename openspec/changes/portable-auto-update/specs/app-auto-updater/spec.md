# Spec Delta: app-auto-updater

## Purpose

Provides portable Windows desktop client auto-update capabilities using in-place file replacement alongside Cloudflare R2 object storage distribution, version synchronization, and release packaging automation.

## ADDED Requirements

### Requirement: Release Manifest Verification and Update Detection
The desktop application SHALL query the remote release manifest endpoint on Cloudflare R2 via custom CDN domain to compare current client semantic version with the remote target release.

#### Scenario: Update available detected
- **WHEN** the remote manifest version is strictly greater than the current application version
- **THEN** the system marks update availability as true, exposing the new version string, release date, change log, and download URL

#### Scenario: Client already up to date
- **WHEN** the remote manifest version is less than or equal to the current version
- **THEN** the system reports up-to-date status without triggering download flows

#### Scenario: Remote manifest unreachable
- **WHEN** the network request to the release endpoint fails or times out
- **THEN** the system logs the connectivity diagnostic and retains normal application workflow without blocking user operations

### Requirement: Silent Download with R2 CDN Acceleration and Integrity Check
The desktop updater engine SHALL download the portable update binary from Cloudflare R2 CDN into a temporary staged file and verify its cryptographic SHA-256 hash against the manifest declaration.

#### Scenario: Download and hash validation succeeds
- **WHEN** the binary finishes downloading from Cloudflare R2 CDN and its calculated SHA-256 matches the manifest digest
- **THEN** the staged binary is verified and transitioned to the ready-for-swap state

#### Scenario: Hash mismatch detection
- **WHEN** the calculated SHA-256 digest differs from the declared manifest digest
- **THEN** the system discards the corrupted temporary download and reports an integrity verification error

### Requirement: In-Place Rename Hot Swap and Relaunch
The application SHALL apply the staged update binary to the current portable executable path using Windows in-place file renaming and support immediate process relaunch.

#### Scenario: In-place rename execution
- **WHEN** the user triggers immediate restart or the application prepares to close
- **THEN** the system renames the running executable to a backup `.old.exe` file and moves the staged new binary into the active executable path

#### Scenario: Process relaunch
- **WHEN** in-place file swap completes and restart is requested
- **THEN** the host spawns the updated executable process and terminates the current instance cleanly

#### Scenario: Startup cleanup of backup executable
- **WHEN** the application starts up and detects a residual `.old.exe` file in its working directory
- **THEN** the system removes the legacy backup file silently

### Requirement: Release Tooling and R2 Distribution Configuration
The project workspace SHALL provide an automated release script for version bump synchronization alongside Cloudflare R2 release manifest generation.

#### Scenario: Version bump synchronization
- **WHEN** the maintainer executes the release script with a valid target version
- **THEN** the script updates version values across `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` consistently

#### Scenario: Release manifest generation
- **WHEN** release build artifacts are generated
- **THEN** the script calculates the binary SHA-256 digest, file byte size, and emits a structured `latest.json` release manifest referencing the Cloudflare R2 assets domain
