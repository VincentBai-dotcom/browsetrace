# BrowseTrace

A Chrome extension that captures comprehensive browsing behavior and interactions, storing them locally for LLM-powered workflows. All data stays local and private.

## Architecture

BrowseTrace consists of four components:

- **Browser Extension**: Captures user interactions (clicks, inputs, scrolls, navigation, visible text)
- **Go HTTP Server**: Local API server with SQLite storage (`127.0.0.1:8123`)
- **Desktop App (Tauri)**: Optional GUI with embedded server and agent binaries
- **Python LLM Agent**: Analyzes browsing events for intent inference and context-aware assistance

## Quick Start

### Development Mode (Recommended)

Start both the Go server and desktop app together:

```bash
./dev.sh
```

This will:
- Start the Go HTTP server on `http://127.0.0.1:51425`
- Start the Electron desktop app
- Handle graceful shutdown on Ctrl+C

Press `Ctrl+C` to stop all processes.

### Manual Component Startup

If you prefer to run components separately:

**Go Server:**
```bash
cd server
go run ./cmd/browsetrace-agent

# API endpoints:
# POST /events - Insert event batches
# GET  /events - Query events with filters
# GET  /stats  - Aggregated metrics
```

**Desktop App:**
```bash
cd desktop
pnpm install
pnpm start
```

**Browser Extension:**
```bash
cd browser-extension
pnpm install
pnpm dev          # Development mode with auto-rebuild
pnpm build        # Production build

# Load dist/ as unpacked extension in Chrome
```

**Python Agent:**
```bash
cd agent
pip install -r requirements.txt
python agent.py
```

## Design Principles

- **Comprehensiveness**: Capture all meaningful interactions
- **Privacy-First**: Local storage only, sensitive data masked
- **Performance**: <5ms overhead per interaction
- **Real-Time**: Immediate event flow for live LLM inference
- **LLM-Optimized**: Event structure designed for efficient AI consumption

## Monorepo Structure

```
browsetrace/
├── browser-extension/  # Chrome extension (TypeScript, React)
├── server/             # Go HTTP server with SQLite
├── agent/              # Python LLM agent
├── desktop/            # Tauri desktop app (Rust + Web UI)
├── shared/             # Shared types and schemas
└── scripts/            # Build and release automation
```

See [DESIGN.md](DESIGN.md) for detailed architecture and component documentation.

## License

See [LICENSE](LICENSE) for details.
