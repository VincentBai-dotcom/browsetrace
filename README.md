# BrowseTrace

A Chrome extension that captures comprehensive browsing behavior and interactions, storing them locally for LLM-powered workflows via the Model Context Protocol (MCP). All data stays local and private.

## Architecture

BrowseTrace consists of four components:

- **Browser Extension**: Captures user interactions (clicks, inputs, scrolls, navigation, visible text)
- **Go HTTP Server**: Local API server with SQLite storage (`127.0.0.1:8123`)
- **MCP Server**: Model Context Protocol server that exposes browsing data to Claude Desktop and other MCP clients
- **Desktop App (Electron)**: Optional GUI for data visualization

## Quick Start

### Recommended: Use the Dev Script

The fastest way to get everything running:

```bash
./dev.sh
```

This starts the Go HTTP server and desktop app. Then:

1. Install the browser extension (see below)
2. Configure the MCP server for Claude Desktop (see `mcp-server/README.md`)

### Manual Setup

**1. Start Go Server:**
```bash
cd server
go run ./cmd/browsetrace-agent

# API endpoints:
# POST /events - Insert event batches
# GET  /events - Query events with filters
# GET  /stats  - Aggregated metrics
```

**2. Install Browser Extension:**
```bash
cd browser-extension
pnpm install
pnpm dev          # Development mode with auto-rebuild
pnpm build        # Production build

# Load dist/ as unpacked extension in Chrome
```

**3. (Optional) Start Desktop App for Visualization:**
```bash
cd desktop
pnpm install
pnpm start
```

**4. Set up MCP Server for Claude Desktop:**
```bash
cd mcp-server
pnpm install
pnpm build

# Configure Claude Desktop (see mcp-server/README.md)
```

## Design Principles

- **Comprehensiveness**: Capture all meaningful interactions
- **Privacy-First**: Local storage only, sensitive data masked
- **Performance**: <5ms overhead per interaction
- **MCP-Native**: Expose data through Model Context Protocol for seamless LLM integration
- **LLM-Optimized**: Event structure designed for efficient AI consumption

## Monorepo Structure

```
browsetrace/
├── browser-extension/  # Chrome extension (TypeScript, React)
├── server/             # Go HTTP server with SQLite
├── mcp-server/         # MCP server for Claude Desktop integration
├── desktop/            # Electron desktop app for data visualization
└── scripts/            # Build and development scripts
```

See [DESIGN.md](DESIGN.md) for detailed architecture and component documentation.
