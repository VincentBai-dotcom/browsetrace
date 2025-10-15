# BrowseTrace Design Document

## Project Vision

BrowseTrace is a Chrome extension that captures comprehensive user browsing behavior and interactions, storing them in a local database for real-time LLM inference of user intent. The system acts as a "memory layer" that enables AI assistants to understand what users have done and seen in their browser, providing context-aware assistance.

## Core Design Principles

1. **Comprehensiveness**: Capture all meaningful user interactions and visible content
2. **Privacy-First**: All data stays local; sensitive information is masked
3. **Performance**: Minimal impact on browsing experience (<5ms overhead per interaction)
4. **Reliability**: No data loss; graceful degradation when local server is unavailable
5. **Real-Time**: Events flow immediately to enable live LLM inference
6. **LLM-Optimized**: Event structure designed for efficient LLM consumption

## System Architecture

### Four-Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Browser Extension                          │
│  • Content Scripts: Event capture & privacy masking         │
│  • Service Worker: Batch forwarding                         │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP POST /events
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            Go HTTP Server (127.0.0.1:8123)                  │
│  • SQLite database storage                                  │
│  • POST /events  - Insert event batches                     │
│  • GET  /events  - Query events with filters                │
│  • GET  /stats   - Aggregated metrics                       │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │ HTTP GET            │ HTTP GET
          ▼                     ▼
┌───────────────────┐   ┌──────────────────────────────────┐
│  Desktop App      │   │  Python LLM Agent                │
│  (Tauri)          │   │  • Poll/stream events            │
│  • UI controls    │   │  • Intent inference              │
│  • Visualization  │   │  • AI workflows                  │
│  • Settings       │   │  • Context-aware assistance      │
│  • Manages server │   │                                  │
└───────────────────┘   └──────────────────────────────────┘
```

### Component Responsibilities

**Browser Extension**: Captures browsing events, posts to local server

**Go HTTP Server**: Central data hub with HTTP API, manages SQLite database

**Desktop App**: Optional GUI for casual users, embeds and manages server binary

**Python LLM Agent**: Independent AI workflows, queries events via HTTP API

## Monorepo Structure

The project is organized as a monorepo containing all four components, with the desktop app embedding the Go server and Python agent as platform-specific binaries.

### Directory Layout

```
browsetrace/
├── browser-extension/          # Chrome extension
│   ├── manifest.json
│   ├── content-scripts/       # Event capture & privacy masking
│   ├── service-worker/        # Batch forwarding to local server
│   └── popup/                 # Extension UI
│
├── server/                    # Go HTTP server (current browsetrace-agent)
│   ├── cmd/
│   │   └── browsetrace-agent/
│   │       └── main.go
│   ├── internal/
│   │   ├── database/         # SQLite storage layer
│   │   ├── models/           # Event & Batch structs
│   │   └── server/           # HTTP handlers
│   ├── go.mod
│   └── go.sum
│
├── agent/                     # Python LLM agent
│   ├── agent.py              # Main agent entry point
│   ├── requirements.txt      # Python dependencies
│   ├── src/
│   │   ├── intent_inference.py
│   │   ├── event_poller.py
│   │   └── workflows/
│   └── pyproject.toml
│
├── desktop/                   # Tauri desktop app
│   ├── src-tauri/            # Rust backend
│   │   ├── src/
│   │   │   └── main.rs       # Process management, IPC
│   │   ├── binaries/         # Platform-specific embedded binaries
│   │   │   ├── browsetrace-server-x86_64-unknown-linux-gnu
│   │   │   ├── browsetrace-server-x86_64-apple-darwin
│   │   │   ├── browsetrace-server-aarch64-apple-darwin
│   │   │   ├── browsetrace-server-x86_64-pc-windows-msvc.exe
│   │   │   ├── browsetrace-agent-x86_64-unknown-linux-gnu
│   │   │   ├── browsetrace-agent-x86_64-apple-darwin
│   │   │   ├── browsetrace-agent-aarch64-apple-darwin
│   │   │   └── browsetrace-agent-x86_64-pc-windows-msvc.exe
│   │   ├── tauri.conf.json
│   │   └── Cargo.toml
│   ├── src/                  # Web UI (React/Svelte/Vue)
│   │   ├── components/       # UI components
│   │   ├── stores/           # State management
│   │   └── App.tsx
│   ├── package.json
│   └── tsconfig.json
│
├── shared/                    # Shared types & schemas
│   ├── types/
│   │   └── events.ts         # TypeScript type definitions
│   └── schemas/
│       └── event.schema.json # JSON schema for validation
│
├── scripts/                   # Build & development scripts
│   ├── build-binaries.sh     # Cross-platform binary builds
│   ├── dev.sh                # Local development setup
│   └── release.sh            # Release automation
│
├── .github/
│   └── workflows/
│       ├── build.yml         # CI build matrix
│       └── release.yml       # Multi-platform release
│
├── README.md
├── DESIGN.md
└── LICENSE
```

### Desktop App Architecture

The desktop app serves as the unified distribution package, embedding both the Go server and Python agent:

```
Tauri Desktop App
├── Rust Backend (src-tauri/)
│   ├── Process Management
│   │   ├── Launch Go server on startup
│   │   ├── Launch Python agent on demand
│   │   └── Graceful shutdown handling
│   ├── Embedded Binaries (platform-specific)
│   │   ├── browsetrace-server (Go)
│   │   └── browsetrace-agent (Python)
│   └── IPC Commands
│       ├── start_server()
│       ├── stop_server()
│       ├── start_agent()
│       └── get_server_status()
│
└── Web UI (src/)
    ├── Server Status Dashboard
    ├── Event Visualization
    ├── Agent Controls
    ├── Settings & Configuration
    └── System Tray Integration
```

### Platform-Specific Binary Management

**Build Matrix**: Each platform requires specific binaries

| Platform | Go Server Binary | Python Agent Binary | Tauri Target |
|----------|-----------------|---------------------|--------------|
| Linux x64 | `GOOS=linux GOARCH=amd64` | PyInstaller Linux | `x86_64-unknown-linux-gnu` |
| macOS Intel | `GOOS=darwin GOARCH=amd64` | PyInstaller macOS | `x86_64-apple-darwin` |
| macOS Apple Silicon | `GOOS=darwin GOARCH=arm64` | PyInstaller macOS ARM | `aarch64-apple-darwin` |
| Windows x64 | `GOOS=windows GOARCH=amd64` | PyInstaller Windows | `x86_64-pc-windows-msvc` |

**Binary Naming Convention**: Tauri automatically selects the correct binary using platform suffixes:
```
browsetrace-server-{target}[.exe]
browsetrace-agent-{target}[.exe]
```

**Build Process**:
1. Build Go server for each platform: `go build -o binaries/browsetrace-server-{target}`
2. Build Python agent with PyInstaller: `pyinstaller --onefile --name browsetrace-agent-{target}`
3. Place binaries in `desktop/src-tauri/binaries/`
4. Tauri bundles only the matching platform binary during app build
5. Runtime: Tauri's `Command::new_sidecar()` automatically resolves to correct binary

### Development Workflow

**Local Development**:
```bash
# Terminal 1: Run Go server directly
cd server && go run ./cmd/browsetrace-agent

# Terminal 2: Run Python agent directly
cd agent && python agent.py

# Terminal 3: Run Tauri in dev mode (without embedded binaries)
cd desktop && npm run tauri dev
```

**Building Release**:
```bash
# Build all platform binaries
./scripts/build-binaries.sh

# Build Tauri app with embedded binaries
cd desktop && npm run tauri build
```

### Distribution Strategy

**End-User Installation**:
- Single installer per platform (DMG, MSI, AppImage)
- Includes embedded Go server + Python agent
- No separate installation required
- System tray icon for background operation
- Auto-updates via Tauri updater

**Developer Installation**:
- Clone monorepo
- Run components independently for development
- Use `scripts/dev.sh` for local setup

### Component Communication

All components communicate via HTTP over localhost:

```
Browser Extension → POST http://127.0.0.1:51425/events → Go Server
Desktop App UI    → GET  http://127.0.0.1:51425/events → Go Server
Python Agent      → GET  http://127.0.0.1:51425/events → Go Server
```

The HTTP API serves as the contract between components, enabling:
- Independent development and testing
- Language-agnostic integration
- Clear separation of concerns
- Easy debugging with standard HTTP tools