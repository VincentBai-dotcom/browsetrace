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
│  (Electron)       │   │  • Poll/stream events            │
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
├── desktop/                   # Electron desktop app
│   ├── main/                 # Electron main process
│   │   ├── index.ts          # App entry point
│   │   ├── process-manager.ts # Manages Go server & Python agent
│   │   └── ipc-handlers.ts   # IPC communication handlers
│   ├── preload/              # Preload scripts
│   │   └── index.ts          # Context bridge for renderer
│   ├── renderer/             # Renderer process (React/Vue)
│   │   ├── components/       # UI components
│   │   ├── stores/           # State management
│   │   └── App.tsx
│   ├── resources/            # Platform-specific embedded binaries
│   │   ├── browsetrace-server-linux
│   │   ├── browsetrace-server-darwin
│   │   ├── browsetrace-server-darwin-arm64
│   │   ├── browsetrace-server-win.exe
│   │   ├── browsetrace-agent-linux
│   │   ├── browsetrace-agent-darwin
│   │   ├── browsetrace-agent-darwin-arm64
│   │   └── browsetrace-agent-win.exe
│   ├── electron-builder.yml  # Build configuration
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
Electron Desktop App
├── Main Process (main/)
│   ├── Process Management
│   │   ├── Launch Go server on startup
│   │   ├── Launch Python agent on demand
│   │   └── Graceful shutdown handling
│   ├── Embedded Binaries (platform-specific)
│   │   ├── browsetrace-server (Go)
│   │   └── browsetrace-agent (Python)
│   └── IPC Handlers
│       ├── startServer()
│       ├── stopServer()
│       ├── startAgent()
│       └── getServerStatus()
│
├── Preload Scripts (preload/)
│   └── Context Bridge API
│       ├── Expose safe IPC methods to renderer
│       └── Type-safe communication layer
│
└── Renderer Process (renderer/)
    ├── Server Status Dashboard
    ├── Event Visualization
    ├── Agent Controls
    ├── Settings & Configuration
    └── System Tray Integration
```

### Platform-Specific Binary Management

**Build Matrix**: Each platform requires specific binaries

| Platform | Go Server Binary | Python Agent Binary | Electron Platform |
|----------|-----------------|---------------------|-------------------|
| Linux x64 | `GOOS=linux GOARCH=amd64` | PyInstaller Linux | `linux` |
| macOS Intel | `GOOS=darwin GOARCH=amd64` | PyInstaller macOS | `darwin` |
| macOS Apple Silicon | `GOOS=darwin GOARCH=arm64` | PyInstaller macOS ARM | `darwin` (arm64) |
| Windows x64 | `GOOS=windows GOARCH=amd64` | PyInstaller Windows | `win32` |

**Binary Naming Convention**: Electron resolves binaries using platform detection:
```
browsetrace-server-{platform}[.exe]
browsetrace-agent-{platform}[.exe]
```

**Build Process**:
1. Build Go server for each platform: `go build -o resources/browsetrace-server-{platform}`
2. Build Python agent with PyInstaller: `pyinstaller --onefile --name browsetrace-agent-{platform}`
3. Place binaries in `desktop/resources/`
4. Electron Builder copies platform-specific binaries during packaging
5. Runtime: Process manager uses `process.platform` and `process.arch` to select correct binary

### Development Workflow

**Local Development**:
```bash
# Terminal 1: Run Go server directly
cd server && go run ./cmd/browsetrace-agent

# Terminal 2: Run Python agent directly
cd agent && python agent.py

# Terminal 3: Run Electron in dev mode (without embedded binaries)
cd desktop && npm run dev
```

**Building Release**:
```bash
# Build all platform binaries
./scripts/build-binaries.sh

# Build Electron app with embedded binaries
cd desktop && npm run build
```

### Distribution Strategy

**End-User Installation**:
- Single installer per platform (DMG, NSIS/MSI, AppImage/deb)
- Includes embedded Go server + Python agent
- No separate installation required
- System tray icon for background operation
- Auto-updates via electron-updater

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