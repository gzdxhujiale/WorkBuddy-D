# mcp-server Specification

## Purpose
Exposes personal planning entities as standard Model Context Protocol (MCP) tools and resources, enabling external AI agent environments to query and modify tasks, projects, and daily reviews with real-time client synchronization.

## Requirements

### Requirement: Standard MCP Transport and Capability Discovery
The system SHALL operate an MCP server adhering to the Model Context Protocol specifications, offering capability discovery over both Server-Sent Events (SSE) and standard I/O (stdio) communication channels.

#### Scenario: Client tool discovery handshake
- **WHEN** an MCP-compliant client initializes a connection session
- **THEN** the server returns protocol negotiation metadata, tool manifests, parameter schemas, and supported resource uri templates

### Requirement: Planning Domain Tool Operations
The MCP server SHALL expose atomic tool operations for task center, project center, and daily review entities under authenticated tenant scope.

#### Scenario: Querying and mutating task items
- **WHEN** an external agent executes the `create_task` or `update_task_status` tool with valid entity parameters
- **THEN** the system validates tenant ownership, applies the database mutation, and returns the modified task record with confirmation status

#### Scenario: Fetching daily review context and summary data
- **WHEN** an external agent executes the `get_today_summary_data` tool for a specified date
- **THEN** the server compiles completed tasks, active focus sessions, and habit check-in records into a structured JSON payload

#### Scenario: Manipulating project stages
- **WHEN** an external agent executes `create_project_stage` with target project reference and stage specifications
- **THEN** the system persists the stage record, updates parent project ordering, and returns the persisted stage entity

### Requirement: Real-Time Desktop Synchronization on MCP Mutation
The system SHALL emit entity mutation delta events with monotonic sequence identifiers whenever an MCP tool executes a write operation, synchronizing open desktop client windows.

#### Scenario: Desktop view auto-refresh upon external agent task creation
- **WHEN** an external client invokes `create_task` over MCP and the transaction commits
- **THEN** the backend broadcasts an `ENTITY_DELTA` event over the WebSocket sync hub, causing open desktop windows to invalidate matching query cache and reflect the newly created task without user reload
