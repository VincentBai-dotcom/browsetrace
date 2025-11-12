# BrowseTrace MCP Server

Model Context Protocol (MCP) server that exposes BrowseTrace browsing data to Claude Desktop and other MCP clients.

## Overview

This MCP server wraps the BrowseTrace Go HTTP API server (running on `http://127.0.0.1:8123`) and provides 6 tools for analyzing browsing behavior:

### Data Retrieval Tools

- **get_recent_events**: Get browsing events from the last N hours
- **get_events_by_type**: Filter events by type (navigate, visible_text, click, input, focus)
- **search_by_url**: Search for events by URL pattern (case-insensitive)
- **get_input_history**: Get form input history (⚠️ may contain sensitive data)

### Analytics Tools

- **analyze_browsing_patterns**: Statistical analysis of browsing behavior
- **analyze_tab_switches**: Analyze tab switching patterns

## Prerequisites

- Node.js 18+ or compatible runtime
- pnpm package manager
- BrowseTrace Go server running on `http://127.0.0.1:8123`

## Installation

```bash
# Install dependencies
pnpm install

# Build the MCP server
pnpm build
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# BrowseTrace Go API Server URL (default: http://127.0.0.1:8123)
API_BASE_URL=http://127.0.0.1:8123
```

### Claude Desktop Configuration

Add the MCP server to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "browsetrace": {
      "command": "node",
      "args": [
        "/absolute/path/to/browsetrace/mcp-server/dist/index.js"
      ],
      "env": {
        "API_BASE_URL": "http://127.0.0.1:8123"
      }
    }
  }
}
```

Replace `/absolute/path/to/browsetrace` with your actual project path.

## Development

```bash
# Development mode with auto-reload
pnpm dev

# Watch mode (rebuild on changes)
pnpm watch

# Build for production
pnpm build

# Run production build
pnpm start
```

## Usage with Claude Desktop

Once configured, restart Claude Desktop. You can now ask Claude questions about your browsing data:

- "What websites did I visit in the last 2 hours?"
- "Analyze my browsing patterns today"
- "Show me my tab switching behavior"
- "What forms did I fill out recently?"
- "Find all events related to GitHub"

Claude will automatically use the appropriate MCP tools to answer your questions.

## Testing

### Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

### Manual Testing

```bash
# List available tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js

# Call a tool
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_recent_events","arguments":{"hours":1}}}' | node dist/index.js
```

## Architecture

```
mcp-server/
├── src/
│   ├── index.ts              # Entry point with stdio transport
│   ├── server.ts             # MCP server setup & tool registration
│   ├── api/
│   │   └── client.ts         # HTTP client for Go API
│   ├── tools/
│   │   ├── index.ts          # Tool exports
│   │   ├── data-tools.ts     # Data retrieval tools
│   │   └── analysis-tools.ts # Analytics tools
│   └── types/
│       └── events.ts         # TypeScript type definitions
└── dist/                      # Compiled JavaScript (after build)
```

## Available Tools

### get_recent_events

Get recent browsing events from the last N hours.

**Parameters:**
- `hours` (number, optional): Number of hours to look back (default: 24)
- `limit` (number, optional): Maximum number of events (default: 100)

**Returns:**
```json
{
  "events": [...],
  "count": 42
}
```

### get_events_by_type

Filter events by type.

**Parameters:**
- `type` (string, required): Event type (navigate, visible_text, click, input, focus)
- `limit` (number, optional): Maximum number of events (default: 100)

**Returns:**
```json
{
  "events": [...],
  "count": 15
}
```

### search_by_url

Search for events by URL pattern (case-insensitive substring match).

**Parameters:**
- `urlPattern` (string, required): URL pattern to search for (e.g., "github.com")
- `limit` (number, optional): Maximum number of events (default: 100)

**Returns:**
```json
{
  "events": [...],
  "count": 8
}
```

### get_input_history

Get form input history. ⚠️ **Warning**: May contain sensitive data like passwords.

**Parameters:**
- `limit` (number, optional): Maximum number of input events (default: 50)

**Returns:**
```json
{
  "inputs": [
    {
      "url": "https://example.com",
      "selector": "#username",
      "value": "user@example.com",
      "timestamp": "2025-01-15T12:34:56Z"
    }
  ],
  "count": 5
}
```

### analyze_browsing_patterns

Analyze browsing patterns with statistics.

**Parameters:**
- `hours` (number, optional): Number of hours to analyze (default: 24)

**Returns:**
```json
{
  "totalEvents": 234,
  "uniqueUrls": 45,
  "mostVisitedUrls": [...],
  "eventTypeCounts": {...},
  "timeRange": {...}
}
```

### analyze_tab_switches

Analyze tab switching behavior.

**Parameters:**
- `hours` (number, optional): Number of hours to analyze (default: 24)

**Returns:**
```json
{
  "totalSwitches": 12,
  "tabSwitchEvents": [...],
  "mostSwitchedBetween": [...]
}
```

## Security Considerations

- The MCP server only communicates via stdio (no network exposure)
- Browsing data remains local to your machine
- `get_input_history` tool may expose sensitive form data - use with caution
- The Go API server runs on localhost only by default

## Troubleshooting

### MCP server not showing in Claude Desktop

1. Check that the path in `claude_desktop_config.json` is absolute and correct
2. Ensure the build completed successfully (`pnpm build`)
3. Verify the entry point has execute permissions: `chmod +x dist/index.js`
4. Restart Claude Desktop completely

### "BrowseTrace server not running" error

1. Start the Go server: `cd server && go run ./cmd/browsetrace-agent`
2. Verify it's running: `curl http://127.0.0.1:8123/healthz`
3. Check the `API_BASE_URL` environment variable

### No events returned

1. Ensure the browser extension is installed and capturing events
2. Check that events are being stored: `curl http://127.0.0.1:8123/events`
3. Try increasing the `hours` or `limit` parameters

## License

ISC

## Related Projects

- **browser-extension**: Chrome extension that captures browsing events
- **server**: Go HTTP API server that stores events
- **agent**: CLI AI agent for querying browsing data (alternative to MCP)
- **desktop**: Electron app for viewing browsing data
