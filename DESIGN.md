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
          │ HTTP GET            │ stdio (MCP)
          ▼                     ▼
┌───────────────────┐   ┌──────────────────────────────────┐
│  Desktop App      │   │  MCP Server                      │
│  (Electron)       │   │  • Exposes browsing data tools   │
│  • UI controls    │   │  • Claude Desktop integration    │
│  • Visualization  │   │  • Model Context Protocol        │
│  • Settings       │   │  • LLM-powered workflows         │
│  • Embeds server  │   │                                  │
└───────────────────┘   └──────────────────────────────────┘
```

### Component Responsibilities

**Browser Extension**: Captures browsing events, posts to local server

**Go HTTP Server**: Central data hub with HTTP API, manages SQLite database

**Desktop App**: Optional GUI for data visualization

**MCP Server**: Exposes browsing data to Claude Desktop and other MCP clients via Model Context Protocol

## Monorepo Structure

The project is organized as a monorepo containing all four components. Developers typically run the Go server standalone and use the desktop app for optional data visualization.

### Directory Layout

```
browsetrace/
├── browser-extension/          # Chrome extension
│   ├── manifest.json
│   ├── content-scripts/       # Event capture & privacy masking
│   ├── service-worker/        # Batch forwarding to local server
│   └── popup/                 # Extension UI
│
├── server/                    # Go HTTP server
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
├── mcp-server/                # MCP server for Claude Desktop
│   ├── src/
│   │   ├── index.ts          # Entry point with stdio transport
│   │   ├── server.ts         # MCP server setup & tool registration
│   │   ├── api/
│   │   │   └── client.ts     # HTTP client for Go API
│   │   └── tools/            # MCP tool implementations
│   ├── package.json
│   └── tsconfig.json
│
├── desktop/                   # Electron desktop app
│   ├── main/                 # Electron main process
│   │   ├── index.ts          # App entry point
│   │   └── ipc-handlers.ts   # IPC communication handlers
│   ├── preload/              # Preload scripts
│   │   └── index.ts          # Context bridge for renderer
│   ├── renderer/             # Renderer process (React/Vue)
│   │   ├── components/       # UI components
│   │   ├── stores/           # State management
│   │   └── App.tsx
│   ├── electron-builder.yml  # Build configuration
│   ├── package.json
│   └── tsconfig.json
│
├── scripts/                   # Build & development scripts
│   ├── build-binaries.sh     # Cross-platform binary builds
│   └── dev.sh                # Local development setup
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

The desktop app provides a GUI for data visualization:

```
Electron Desktop App
├── Main Process (main/)
│   └── IPC Handlers
│       └── Communication with renderer
│
├── Preload Scripts (preload/)
│   └── Context Bridge API
│       ├── Expose safe IPC methods to renderer
│       └── Type-safe communication layer
│
└── Renderer Process (renderer/)
    ├── Event Visualization
    ├── Browse History View
    ├── Settings & Configuration
    └── Connects to Go server HTTP API (http://127.0.0.1:8123)
```

### Build Process

**Go Server**:
```bash
cd server
go build -o bin/browsetrace-server ./cmd/browsetrace-agent
```

**Desktop App**:
```bash
cd desktop
npm run build
```

The desktop app assumes the Go server is already running on `http://127.0.0.1:8123`.

### Development Workflow

**Quick Start (Recommended)**:
```bash
./dev.sh
```

This starts the Go server and desktop app together.

**Manual Development**:
```bash
# Terminal 1: Run Go server
cd server && go run ./cmd/browsetrace-agent

# Terminal 2: Run desktop app in dev mode
cd desktop && npm run dev

# Terminal 3: Run MCP server for testing
cd mcp-server && pnpm dev
```

**Building for Production**:
```bash
# Build Go server
cd server && go build -o bin/browsetrace-server ./cmd/browsetrace-agent

# Build desktop app
cd desktop && npm run build

# Build MCP server
cd mcp-server && pnpm build
```

### Distribution Strategy

**Developer Setup (Primary Audience)**:
- Clone monorepo
- Run `./dev.sh` to start Go server and desktop app
- Configure MCP server in Claude Desktop (see mcp-server/README.md)
- Build custom tooling on top of the MCP server

**Component Installation**:
- **Go Server**: Build from source or run with `go run`
- **Browser Extension**: Load unpacked extension in Chrome
- **Desktop App**: Build with Electron or run in dev mode
- **MCP Server**: Install as Node.js package and configure in Claude Desktop

### Component Communication

Components communicate via multiple protocols:

```
Browser Extension → POST http://127.0.0.1:8123/events → Go Server
Desktop App UI    → GET  http://127.0.0.1:8123/events → Go Server
MCP Server        → GET  http://127.0.0.1:8123/events → Go Server
Claude Desktop    ← stdio (MCP) ← MCP Server
```

**HTTP API**: Contract between browser extension, desktop app, MCP server, and Go server
- Independent development and testing
- Language-agnostic integration
- Clear separation of concerns
- Easy debugging with standard HTTP tools

**MCP Protocol**: Communication between Claude Desktop and MCP Server
- stdio transport for secure, sandboxed communication
- Structured tool calls and responses
- Type-safe data exchange via Zod schemas