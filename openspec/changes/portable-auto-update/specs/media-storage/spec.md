# Spec Delta: media-storage

## Purpose

Provides an abstract media asset storage capability for rich-text editor attachments supporting local file system fallback and Cloudflare R2 S3-compatible cloud object storage with SHA-256 deduplication and CDN URL resolution.

## ADDED Requirements

### Requirement: Dual-Driver Media Storage Abstraction
The backend server SHALL provide an abstracted media storage subsystem that supports both local file system driver and Cloudflare R2 cloud object storage driver, selectable via configuration.

#### Scenario: Local storage driver selected
- **WHEN** the storage driver configuration is set to local
- **THEN** uploaded files are stored under the local media directory and served through the server asset endpoint

#### Scenario: Cloudflare R2 storage driver selected
- **WHEN** the storage driver configuration is set to r2 and credentials are valid
- **THEN** uploaded files are committed to the designated Cloudflare R2 bucket under the media prefix and resolved to public CDN URLs

### Requirement: SHA-256 Content-Addressed Media Deduplication
The media storage subsystem SHALL calculate the SHA-256 cryptographic digest of incoming file payloads and use the hexadecimal hash as the persistent file identifier.

#### Scenario: New media file upload
- **WHEN** an uploaded media payload with a unique SHA-256 digest is processed
- **THEN** the system commits the asset to the active storage driver under the hashed filename and returns its persistent access URL

#### Scenario: Duplicate media file upload
- **WHEN** an uploaded media payload matches an existing SHA-256 digest in the storage driver
- **THEN** the system avoids redundant write operations and immediately returns the existing asset access URL

### Requirement: Public CDN URL Resolution
The media storage subsystem SHALL resolve uploaded media assets to fully qualified public CDN URLs when operating with the Cloudflare R2 driver.

#### Scenario: Public URL emission for R2 storage
- **WHEN** a media upload completes successfully in R2 mode
- **THEN** the response includes a fully qualified URL prefixed with the configured public CDN domain pointing directly to the asset key
