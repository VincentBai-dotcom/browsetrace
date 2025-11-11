# BrowseTrace AI Agent Implementation

This document explains the TypeScript AI agent implementation added to the BrowseTrace project.

## Overview

The BrowseTrace AI Agent is a conversational AI assistant powered by Claude (Anthropic) that helps users analyze and understand their browsing behavior captured by the BrowseTrace browser extension and Go server.

### Key Capabilities

- **Natural Language Queries** - Ask questions about browsing history in plain English
- **Function Calling** - Uses Claude's tool calling feature to query the database
- **Pattern Analysis** - Identifies browsing habits, frequently visited sites, and workflows
- **Tab Switch Analysis** - Understands user attention patterns through tab switching
- **Privacy-First** - All processing happens locally, data never leaves your machine

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User (CLI or API)                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              BrowseTrace AI Agent (index.ts)                │
│  • CLI Interface                                            │
│  • Conversation Management                                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         Agent Core (browsetrace-agent.ts)                   │
│  • Claude Sonnet 4 Integration                             │
│  • Tool Calling / Function Execution                        │
│  • Conversation History                                     │
│  • System Prompt for Context                               │
└────────────────────────┬────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
┌─────────────────────┐   ┌──────────────────────────┐
│   API Client        │   │   6 Agent Tools          │
│   (client.ts)       │   │   (browsing-tools.ts)    │
│                     │   │                          │
│ • HTTP Requests     │   │ • get_recent_events      │
│ • Query Filtering   │   │ • get_events_by_type     │
│ • Health Checks     │   │ • analyze_patterns       │
│ • Type Safety       │   │ • search_by_url          │
└──────┬──────────────┘   │ • get_input_history      │
       │                  │ • analyze_tab_switches   │
       │                  └────────┬─────────────────┘
       │                           │
       └───────────┬───────────────┘
                   ▼
         ┌──────────────────┐
         │   Go HTTP Server │
         │   (Port 8123)    │
         │                  │
         │   SQLite DB      │
         └──────────────────┘
```

## File Structure & Responsibilities

### 1. **src/index.ts** - CLI Entry Point

**Purpose**: Interactive command-line interface for chatting with the agent

**Features**:
- Checks if Go server is running before starting
- Provides example queries on startup
- Colorized terminal output (cyan for user, magenta for AI)
- Special commands: `exit`, `quit`, `clear`
- Can also be imported programmatically

**Key Code**:
```typescript
const agent = new BrowseTraceAgent(apiKey);
const response = await agent.chat(userInput);
```

---

### 2. **src/agent/browsetrace-agent.ts** - Agent Core

**Purpose**: Main agent class that orchestrates Claude API calls and tool execution

**Key Features**:

#### System Prompt
Provides context to Claude about:
- What BrowseTrace is and what data it has access to
- Available event types (navigate, click, input, focus, visible_text)
- How to interpret timestamps and sessions
- Behavioral guidelines (helpful, concise, privacy-conscious)

#### Conversation Flow
1. User sends a message
2. Agent adds it to conversation history
3. Calls Claude API with tools available
4. If Claude wants to use a tool (stop_reason === 'tool_use'):
   - Extract tool name and parameters
   - Execute the corresponding function
   - Send result back to Claude
   - Get final response
5. Return text response to user

#### Tool Execution Loop
```typescript
while (response.stop_reason === 'tool_use') {
  const tool = findTool(toolUseBlock.name);
  const result = await tool.function(toolUseBlock.input);
  // Send result back to Claude for processing
  response = await callClaudeAgain(result);
}
```

#### Conversation History Management
- Maintains full conversation context
- Includes user messages, assistant responses, and tool results
- Can be cleared with `clearHistory()`

---

### 3. **src/api/client.ts** - API Client

**Purpose**: Type-safe HTTP client for communicating with the Go server

**Methods**:

| Method | Description |
|--------|-------------|
| `getEvents(filter)` | Query events with filters (type, time range, limit) |
| `checkHealth()` | Verify server is running |
| `deleteAllEvents()` | Delete all events from database |
| `getRecentEvents(hours, limit)` | Helper: Get last N hours of events |
| `getEventsByType(type, limit)` | Helper: Filter by event type |

**Example**:
```typescript
const api = new BrowseTraceAPI();
const events = await api.getEvents({
  type: 'navigate',
  since: Date.now() - 3600000, // Last hour
  limit: 100
});
```

---

### 4. **src/tools/browsing-tools.ts** - Agent Tools

**Purpose**: Six specialized functions that the AI can call to query and analyze browsing data

#### Tool 1: `get_recent_events`
**What it does**: Fetches events from the last N hours
**Parameters**:
- `hours` (optional, default: 24)
- `limit` (optional, default: 100)

**Returns**: Array of events with count

**Use case**: "What did I browse yesterday?"

---

#### Tool 2: `get_events_by_type`
**What it does**: Filters events by type
**Parameters**:
- `type` (required): 'navigate', 'click', 'input', 'focus', or 'visible_text'
- `limit` (optional, default: 100)

**Returns**: Filtered events with count

**Use case**: "Show me all the forms I filled out"

---

#### Tool 3: `analyze_browsing_patterns`
**What it does**: Statistical analysis of browsing behavior
**Parameters**:
- `hours` (optional, default: 24)

**Returns**:
- Total event count
- Number of unique URLs visited
- Top 10 most visited sites
- Event type distribution
- Time range covered

**Use case**: "Analyze my browsing patterns today"

**Example output**:
```json
{
  "totalEvents": 523,
  "uniqueUrls": 42,
  "mostVisitedUrls": [
    { "url": "https://github.com", "count": 87 },
    { "url": "https://reddit.com", "count": 45 }
  ],
  "eventTypeCounts": {
    "navigate": 156,
    "click": 234,
    "input": 12,
    "focus": 89,
    "visible_text": 32
  }
}
```

---

#### Tool 4: `search_by_url`
**What it does**: Case-insensitive partial URL matching
**Parameters**:
- `urlPattern` (required): Search term
- `limit` (optional, default: 100)

**Returns**: Matching events with count

**Use case**: "Find all events related to GitHub"

---

#### Tool 5: `get_input_history`
**What it does**: Retrieves form input history
**Parameters**:
- `limit` (optional, default: 50)

**Returns**: Array of inputs with:
- URL where input occurred
- CSS selector of the field
- Value entered
- Timestamp

**Use case**: "What did I search for on Google?"

**Privacy Note**: This tool can expose sensitive data. Users should be aware of what they're asking for.

---

#### Tool 6: `analyze_tab_switches`
**What it does**: Analyzes tab switching patterns (NEW!)
**Parameters**:
- `hours` (optional, default: 24)

**Returns**:
- Total number of tab switches
- List of recent tab switches (from URL → to URL)
- Most common switching patterns

**Use case**: "Which tabs do I switch between most often?"

**Technical Note**: Identifies navigation events with `session_id="tab-switch"`

**Example output**:
```json
{
  "totalSwitches": 34,
  "mostSwitchedBetween": [
    {
      "from": "https://docs.anthropic.com",
      "to": "https://github.com",
      "count": 12
    }
  ]
}
```

---

### 5. **src/types/events.ts** - Type Definitions

**Purpose**: TypeScript types matching the Go server's schema

**Key Types**:

```typescript
// Event types from the database
type EventType = 'navigate' | 'visible_text' | 'click' | 'input' | 'focus';

// Main event structure
interface Event {
  ts_utc: number;           // Unix timestamp in milliseconds
  ts_iso: string;           // ISO 8601 timestamp
  url: string;              // Page URL
  title: string | null;     // Page title
  type: EventType;          // Event type
  data: EventData;          // Type-specific data
  session_id?: string;      // Session identifier
  field_id?: string;        // For input events
}

// Event-specific data interfaces
interface NavigateEventData {
  from: string | null;      // Previous URL (or null)
  to: string;               // New URL
}

interface InputEventData {
  selector: string;         // CSS selector
  value: string;            // Input value
}
// ... more data types
```

**Benefits**:
- Compile-time type checking
- IntelliSense autocomplete
- Prevents runtime type errors
- Matches Go server exactly

---

## How Tool Calling Works

### Claude's Function Calling Flow

1. **User asks a question**: "What did I browse today?"

2. **Agent sends to Claude** with tools available:
```json
{
  "messages": [...],
  "tools": [
    {
      "name": "get_recent_events",
      "description": "Get recent browsing events...",
      "input_schema": { ... }
    }
  ]
}
```

3. **Claude decides to use a tool**:
```json
{
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "tool_use",
      "name": "get_recent_events",
      "input": { "hours": 24, "limit": 100 }
    }
  ]
}
```

4. **Agent executes the function**:
```typescript
const result = await getRecentEvents({ hours: 24, limit: 100 });
// Returns: { events: [...], count: 87 }
```

5. **Agent sends result back to Claude**:
```json
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "...",
      "content": "{\"events\": [...], \"count\": 87}"
    }
  ]
}
```

6. **Claude generates natural language response**:
> "You've visited 87 pages today. Your top sites were GitHub (23 visits), Reddit (15 visits), and Stack Overflow (12 visits). You seem to be doing a lot of coding work today!"

### Multi-Tool Calls

Claude can call multiple tools in sequence:

**User**: "Compare my browsing patterns from today vs yesterday"

**Claude's actions**:
1. Calls `analyze_browsing_patterns({ hours: 24 })`
2. Calls `analyze_browsing_patterns({ hours: 48 })` and filters results
3. Generates comparison analysis

---

## Configuration

### Environment Variables

**`.env` file**:
```env
ANTHROPIC_API_KEY=sk-ant-api03-...    # Your Claude API key (required)
API_BASE_URL=http://127.0.0.1:8123   # Go server URL (optional)
```

### Agent Configuration

**Model Selection** (in `browsetrace-agent.ts`):
```typescript
const model = 'claude-sonnet-4-20250514'; // Latest Claude Sonnet 4
```

**Max Tokens**:
```typescript
max_tokens: 4096  // Maximum response length
```

**System Prompt**: Located in `getSystemPrompt()` method

---

## Usage Examples

### CLI Mode

```bash
$ pnpm dev

╔══════════════════════════════════════════════════════════╗
║          BrowseTrace AI - Browsing Analytics Agent       ║
╚══════════════════════════════════════════════════════════╝

Connected to BrowseTrace server ✓
Claude AI initialized ✓

You: What websites did I visit in the last 2 hours?

[Tool Call] get_recent_events
[Input] { "hours": 2, "limit": 100 }
[Result] { "events": [...], "count": 45 }...

BrowseTrace AI: You visited 45 pages in the last 2 hours. Here are the most
frequently visited sites:
1. GitHub (12 visits)
2. Stack Overflow (8 visits)
3. Reddit (6 visits)
...
```

### Programmatic Usage

```typescript
import { BrowseTraceAgent } from './src/index.js';

// Initialize agent
const agent = new BrowseTraceAgent(process.env.ANTHROPIC_API_KEY!);

// Single question
const response1 = await agent.chat('What did I browse today?');
console.log(response1);

// Follow-up (conversation context preserved)
const response2 = await agent.chat('Which sites did I spend the most time on?');
console.log(response2);

// Clear history and start fresh
agent.clearHistory();
```

### API Client Usage (Without Agent)

```typescript
import { BrowseTraceAPI } from './src/api/client.js';

const api = new BrowseTraceAPI();

// Get all navigation events from last hour
const navEvents = await api.getEventsByType('navigate', 100);

// Get events from specific time range
const events = await api.getEvents({
  since: Date.now() - 7200000,  // 2 hours ago
  until: Date.now(),
  limit: 500
});

// Health check
const healthy = await api.checkHealth();
if (healthy) {
  console.log('Server is running!');
}
```

---

## Technical Details

### TypeScript Configuration

**`tsconfig.json`**:
- **Target**: ES2022 (modern JavaScript)
- **Module**: ESNext with `"type": "module"` in package.json
- **Module Resolution**: bundler (for Node.js)
- **Strict mode**: Enabled (full type checking)
- **Source maps**: Enabled for debugging

### Dependencies

**Runtime**:
- `@anthropic-ai/sdk` - Claude API client
- `dotenv` - Environment variable loading

**Development**:
- `typescript` - TypeScript compiler
- `tsx` - TypeScript executor for development
- `@types/node` - Node.js type definitions

### Build System

```bash
# Development (no build, runs TypeScript directly)
pnpm dev        # Uses tsx to run src/index.ts

# Production
pnpm build      # Compiles TypeScript → dist/
pnpm start      # Runs compiled dist/index.js
```

### Error Handling

The agent includes comprehensive error handling:

1. **Server health check on startup** - Fails gracefully if server is down
2. **API key validation** - Checks environment variable exists
3. **Tool execution errors** - Caught and reported to user
4. **Network errors** - Try-catch blocks around all HTTP requests
5. **Type safety** - TypeScript prevents many runtime errors

---

## Integration with Existing BrowseTrace Components

### Data Flow

```
Browser Extension (TypeScript)
    ↓ (WebSocket/Port)
Service Worker (TypeScript)
    ↓ (HTTP POST)
Go Server (SQLite)
    ↓ (HTTP GET)
AI Agent (TypeScript)
    ↓ (Claude API)
User Insights
```

### Event Types Compatibility

The agent's type definitions (`src/types/events.ts`) exactly match:
- **Go Server**: `server/internal/models/models.go`
- **Browser Extension**: `browser-extension/src/shared/types.ts`

This ensures type safety across the entire stack.

### Session ID Handling

The agent understands two types of sessions:
1. **Content Script Sessions**: UUID per page load (for input deduplication)
2. **Tab Switch Sessions**: Hardcoded `"tab-switch"` string (for attention tracking)

The `analyze_tab_switches` tool specifically filters for the latter.

---

## Future Enhancements

### Potential Tool Additions

1. **Time-on-site Analysis** - Calculate time spent on each domain
2. **Workflow Detection** - Identify repeated browsing patterns
3. **Productivity Scoring** - Categorize sites as productive/distracting
4. **Export to Calendar** - Generate timeline of browsing activity
5. **Smart Summaries** - LLM-generated summaries of browsing sessions

### Agent Improvements

1. **Streaming Responses** - Use Claude's streaming API for real-time responses
2. **Multi-turn Planning** - Agent creates plan before executing tools
3. **Caching** - Cache tool results for repeated queries
4. **Web Interface** - Build a web UI instead of CLI
5. **Voice Input** - Add speech-to-text for queries

### Integration Ideas

1. **Desktop App Integration** - Embed agent in Electron app
2. **Chrome Extension Integration** - Query history from extension popup
3. **API Server Mode** - Run agent as HTTP server for other apps
4. **Webhook Notifications** - Proactive insights based on patterns

---

## Troubleshooting

### "Server is not running" Error

**Problem**: Agent can't connect to Go server
**Solution**:
```bash
cd server
go run ./cmd/browsetrace-agent
```

### "ANTHROPIC_API_KEY not set" Error

**Problem**: Missing API key
**Solution**: Add to `.env` file:
```env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### TypeScript Compilation Errors

**Problem**: Type mismatches
**Solution**:
```bash
# Clean and rebuild
rm -rf dist/
pnpm build
```

### "No events found" Responses

**Problem**: Database is empty
**Solution**: Use browser extension to generate some events first

---

## Performance Considerations

### API Costs

Each conversation turn costs:
- **Input tokens**: ~500-1000 tokens (system prompt + conversation history)
- **Output tokens**: ~200-500 tokens (response)
- **Tool results**: Variable (can be large for events array)

**Cost estimate**: ~$0.01-0.05 per conversation turn with Claude Sonnet

### Optimization Tips

1. **Limit event queries** - Use smaller `limit` parameters
2. **Time range filters** - Query only necessary time ranges
3. **Clear history periodically** - Reduces context size
4. **Batch queries** - Ask multiple questions at once

### Database Performance

The Go server handles queries efficiently, but for very large datasets:
- Consider adding indexes to SQLite (already has indexes on ts_utc, type, url)
- Use time range filters aggressively
- Implement pagination for large result sets

---

## Summary

The BrowseTrace AI Agent adds a natural language interface to your browsing data. Key achievements:

✅ **6 specialized tools** for querying and analyzing events
✅ **Type-safe** end-to-end from database to AI
✅ **Interactive CLI** with conversation history
✅ **Tab switch analysis** integrated with new feature
✅ **Privacy-focused** - all processing happens locally
✅ **Extensible** - easy to add new tools and capabilities

The agent leverages Claude's function calling to intelligently select and chain tool usage, providing insightful answers to natural language questions about browsing behavior.
