# Spec Delta

## Purpose

Provides authenticated REST APIs and real-time WebSocket delta synchronization for personal planning entities, eliminating high-concurrency database exhaustion.

## ADDED Requirements

### Requirement: Authenticated REST Entity Management
The backend service SHALL expose authenticated HTTP endpoints for managing notes, tasks, focus sessions, habits, and projects scoped to the authenticated user.

#### Scenario: Successful entity retrieval
- **WHEN** an authenticated client sends a GET request to an entity collection endpoint with a valid JWT
- **THEN** the system returns the collection filtered strictly by the user's identity with HTTP 200

#### Scenario: Unauthorized entity access
- **WHEN** a request is received without a valid JWT or with an expired token
- **THEN** the system rejects the request with HTTP 401 Unauthorized

### Requirement: Granular WebSocket Delta Synchronization
The backend service SHALL maintain active WebSocket connections per authenticated user and broadcast granular entity mutations to all connected windows without requiring full query invalidation.

#### Scenario: Entity update delta broadcast
- **WHEN** an entity is created, updated, or deleted via an authenticated REST endpoint
- **THEN** the backend broadcasts a typed delta payload to all other active WebSocket sessions belonging to that user containing the mutated entity ID and delta fields

#### Scenario: Client cache application without database refetch
- **WHEN** a client window receives an entity delta event over its WebSocket connection
- **THEN** the client updates its in-memory TanStack Query cache directly without dispatching refetch queries to the database

### Requirement: Database Connection Pooling and Resilience
The backend service SHALL manage a bounded PostgreSQL connection pool via `pgxpool` ensuring that multi-window concurrent desktop operations do not exceed cloud database connection quotas.

#### Scenario: High concurrency request burst
- **WHEN** multiple Webviews issue concurrent requests simultaneously
- **THEN** requests are queued and multiplexed across the bounded connection pool without throwing connection limit errors
