# BrowseTrace AI Agent

An intelligent AI agent built with Claude that analyzes your browsing behavior captured by BrowseTrace.

## Features

- 🔍 **Query browsing history** - Search and filter events by type, time, URL
- 📊 **Analyze patterns** - Understand browsing habits, frequently visited sites, tab switching
- 💬 **Natural language** - Ask questions in plain English
- 🛠️ **Multiple tools** - 6 specialized tools for different types of analysis
- 🔒 **Privacy-first** - All data stays local, processed on your machine

## Prerequisites

- Node.js 18+ (for running the agent)
- BrowseTrace server running (Go server at `http://127.0.0.1:8123`)
- Anthropic API key (Claude)

## Installation

```bash
# Install dependencies
pnpm install

# Or use npm
npm install
```

## Configuration

Create a `.env` file in the `agent/` directory:

```env
ANTHROPIC_API_KEY=your_api_key_here
API_BASE_URL=http://127.0.0.1:8123  # Optional, defaults to this
```

## Usage

### Interactive CLI Mode

```bash
# Development mode (with auto-reload)
pnpm dev

# Or build and run
pnpm build
pnpm start
```

### Example Queries

```
You: What websites did I visit in the last 2 hours?

You: Analyze my browsing patterns today

You: Show me my tab switching behavior

You: What forms did I fill out recently?

You: Find all events related to GitHub
```

### Programmatic Usage

```typescript
import { BrowseTraceAgent, BrowseTraceAPI } from './src/index.js';

// Create an agent instance
const agent = new BrowseTraceAgent(process.env.ANTHROPIC_API_KEY!);

// Chat with the agent
const response = await agent.chat('What did I browse today?');
console.log(response);

// Or use the API directly
const api = new BrowseTraceAPI();
const events = await api.getRecentEvents(24, 100);
console.log(`Found ${events.length} events`);
```

## Available Tools

The agent has access to 6 specialized tools:

1. **get_recent_events** - Get events from the last N hours
2. **get_events_by_type** - Filter by event type (navigate, click, input, etc.)
3. **analyze_browsing_patterns** - Get statistics and insights
4. **search_by_url** - Search for specific websites or URL patterns
5. **get_input_history** - See form inputs and text entered
6. **analyze_tab_switches** - Understand tab switching behavior

## Project Structure

```
agent/
├── src/
│   ├── agent/
│   │   └── browsetrace-agent.ts    # Main agent implementation
│   ├── api/
│   │   └── client.ts                # API client for Go server
│   ├── tools/
│   │   └── browsing-tools.ts        # Agent tools/functions
│   ├── types/
│   │   └── events.ts                # TypeScript types
│   └── index.ts                     # CLI entry point
├── dist/                            # Compiled JavaScript
├── package.json
├── tsconfig.json
└── .env
```

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode (auto-reload)
pnpm dev

# Build TypeScript to JavaScript
pnpm build

# Run compiled version
pnpm start

# Watch mode (recompile on changes)
pnpm watch
```

## Event Types

The agent can analyze these event types:

- **navigate** - Page visits and tab switches
- **visible_text** - Page content captured
- **click** - Elements clicked
- **input** - Form fields and text entered
- **focus** - Elements focused

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   User      │◄────►│  AI Agent    │◄────►│  Go Server  │
│  (CLI/API)  │      │  (Claude)    │      │ (SQLite DB) │
└─────────────┘      └──────────────┘      └─────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Tools      │
                     │  (6 tools)   │
                     └──────────────┘
```

## License

ISC
