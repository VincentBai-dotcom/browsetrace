# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BrowserTrace Agent is a **browser activity tracking agent** written in Go. It:
- Stores browsing events (clicks, navigation, text input, scrolls, focus) in a SQLite database
- Exposes an HTTP API to receive batches of events from browser extensions
- Runs as a local server (default: `127.0.0.1:51425`)
- Supports graceful shutdown and cross-platform file paths

## Architecture

The codebase follows Go project layout conventions with clear separation of concerns:

### Package Structure

- **`cmd/browsetrace-agent/main.go`**: Entry point. Initializes database, creates server, handles platform-specific application directories
- **`internal/database/`**: Database layer handling SQLite connections, table creation, event validation, and transactional inserts
- **`internal/models/`**: Data models (`Event` and `Batch` structs) with JSON tags
- **`internal/server/`**: HTTP server with two endpoints (`/healthz` and `/events`), request handling, and graceful shutdown

### Key Design Patterns

1. **Platform-specific data storage**: Uses OS-appropriate paths for database storage:
   - macOS: `~/Library/Application Support/BrowserTrace/`
   - Windows: `~/AppData/Roaming/BrowserTrace/`
   - Linux: `~/.local/share/BrowserTrace/`

2. **Database layer (`internal/database/database.go`)**:
   - Uses CGO-free SQLite driver (`modernc.org/sqlite`)
   - Configured with WAL mode and busy timeout to prevent lock contention
   - Validates events before insertion (both Go-level and database constraints)
   - Uses transactions for atomic batch inserts
   - Stores arbitrary JSON data in `data_json` column with validation
   - Implements upsert logic for `input` and `visible_text` events to prevent duplicates within a session

3. **Server layer (`internal/server/server.go`)**:
   - Standard library HTTP server with timeouts (5s read/write)
   - Graceful shutdown via signal handling (SIGINT/SIGTERM)
   - `/events` endpoint supports both POST (to insert events) and GET (to retrieve events with filters)
   - Returns appropriate HTTP status codes (200, 204, 400, 405, 500)

4. **Event validation**: Two-layer validation (Go validation in database layer + SQLite CHECK constraints)

### Event Types

Valid event types are: `navigate`, `visible_text`, `click`, `input`, `focus`

## Common Development Commands

### Build
```bash
go build -o bin/browsetrace-agent ./cmd/browsetrace-agent
```

### Run
```bash
# Default (127.0.0.1:51425)
go run ./cmd/browsetrace-agent

# Custom address
BROWSETRACE_ADDRESS="0.0.0.0:8080" go run ./cmd/browsetrace-agent
```

### Test
```bash
# All tests
go test ./...

# With coverage
go test -cover ./...

# Verbose
go test -v ./...

# Single package
go test ./internal/database
go test ./internal/server
go test ./internal/models
```

### Linting
```bash
go fmt ./...
go vet ./...
```

## Testing the API

### Health check
```bash
curl http://127.0.0.1:51425/healthz
```

### Post events
```bash
curl -X POST http://127.0.0.1:51425/events \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "ts_utc": 1696704000000,
      "ts_iso": "2025-10-07T12:00:00Z",
      "url": "https://example.com",
      "title": "Example Page",
      "type": "navigate",
      "data": {"foo": "bar"}
    }]
  }'
```

### Get events
```bash
# Get all events (default limit: 100)
curl http://127.0.0.1:51425/events

# Get events of a specific type
curl "http://127.0.0.1:51425/events?type=click"

# Get events from the last 24 hours
curl "http://127.0.0.1:51425/events?since=$(($(date +%s)*1000 - 86400000))"

# Get events within a time range
curl "http://127.0.0.1:51425/events?since=1696704000000&until=1696790400000"

# Combine filters and set custom limit
curl "http://127.0.0.1:51425/events?type=navigate&since=1696704000000&limit=50"
```

**Query Parameters:**
- `type`: Filter by event type (navigate, visible_text, click, input, focus)
- `since`: Unix timestamp in milliseconds (inclusive lower bound)
- `until`: Unix timestamp in milliseconds (inclusive upper bound)
- `limit`: Maximum number of events to return (default: 100)

## Database Schema

The SQLite database has a single `events` table:
- `id`: INTEGER PRIMARY KEY (auto-increment)
- `ts_utc`: INTEGER (Unix timestamp in milliseconds)
- `ts_iso`: TEXT (ISO 8601 timestamp)
- `url`: TEXT (page URL)
- `title`: TEXT (nullable page title)
- `type`: TEXT (constrained to valid event types)
- `data_json`: TEXT (validated JSON)
- `session_id`: TEXT (nullable, used for input and visible_text event deduplication)
- `field_id`: TEXT (nullable, used for input event deduplication)

Indexes exist for query performance:
- `idx_events_ts`: Index on `ts_utc` for time-based queries
- `idx_events_type`: Index on `type` for event type filtering
- `idx_events_url`: Index on `url` for URL-based queries
- `idx_input_field_session`: Unique composite index on `(url, field_id, session_id)` for input event deduplication
- `idx_input_lookup`: Partial index on `(session_id, field_id) WHERE type = 'input'` for faster input event lookups
- `idx_visible_text_session`: Unique partial index on `(url, session_id) WHERE type = 'visible_text'` for visible_text event deduplication

**Event Deduplication:**
- **Input events**: Deduplicated by `(url, field_id, session_id)`. Multiple input events to the same field on the same page within a session will update the existing record (upsert behavior).
- **Visible_text events**: Deduplicated by `(url, session_id)`. Multiple visible_text captures on the same page within a session will update the existing record with the latest timestamp and text content.

## Error Handling

The codebase follows Go's explicit error handling pattern:
- All errors are wrapped with context using `fmt.Errorf(..., %w, err)`
- Database errors trigger transaction rollbacks
- HTTP handlers return appropriate status codes and log detailed errors internally
- Server uses timeouts to prevent slowloris attacks
