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

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Web Page (DOM)                          │
│  User interactions: clicks, typing, focus, navigation       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Content Script (Per Tab)                       │
│  • Event Listeners (captures.ts)                            │
│  • Event Deduplication & Throttling                         │
│  • Privacy Masking (utils.ts)                               │
│  • Local Buffer (buffer.ts)                                 │
│  • Pause State Management                                   │
└────────────────────┬────────────────────────────────────────┘
                     │ Port Connection
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           Service Worker (Background)                       │
│  • Port Management (worker/index.ts)                        │
│  • Health Check Caching                                     │
│  • Batch Forwarding to Local Server                         │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP POST
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         Local HTTP Server (127.0.0.1:8123)                  │
│  • Database Storage                                         │
│  • Real-Time LLM Context Provision                          │
│  • Query Interface                                          │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### Content Script (`src/content/`)

**Purpose**: Capture user interactions in the web page context

**Key Modules**:

- `captures.ts`: Event listener registration for all interaction types
- `utils.ts`: Helper functions (emit, CSS path generation, input masking)
- `buffer.ts`: Event batching and buffering logic
- `port.ts`: Communication channel to service worker
- `config.ts`: Tunable constants

**Design Constraints**:

- Runs in isolated context per tab
- Cannot make cross-origin requests directly
- Must be lightweight (memory and CPU)
- Should handle dynamic page changes (SPAs)

#### Service Worker (`src/worker/`)

**Purpose**: Bridge between content scripts and local database

**Key Responsibilities**:

- Accept batched events from multiple tabs
- Health check the local server (cached)
- Forward events via HTTP POST
- Handle reconnection logic

**Design Constraints**:

- Manifest V3 restrictions (no persistent background)
- May be terminated at any time
- Cannot access DOM

#### Popup (`src/popup/`)

**Purpose**: User control interface

**Features**:

- Pause/Resume capture toggle
- Status indication
- Future: Statistics, configuration

## Event Taxonomy

### Core Event Types

#### 1. Navigation Events (`navigate`)

**Purpose**: Track page loads and SPA route changes

**Triggers**:

- Initial page load
- `history.pushState()` / `replaceState()`
- `popstate` events (back/forward)
- Full page navigation

**Schema**:

```typescript
{
  type: "navigate",
  from: string | null,  // Previous URL (null on initial)
  to: string,           // Current URL
}
```

**LLM Context Value**: High - establishes browsing flow and task context

#### 2. Click Events (`click`)

**Purpose**: Track interactive element engagement

**Triggers**:

- Mouse clicks on any element
- Touch taps on mobile

**Schema**:

```typescript
{
  type: "click",
  selector: string,      // CSS path to element
  text: string,          // innerText (truncated to 120 chars)
  elementType?: string,  // button, link, input, etc.
  href?: string,         // For links
}
```

**LLM Context Value**: High - reveals user intent and actions

#### 3. Input Events (`input`)

**Purpose**: Capture text entry and form interactions

**Triggers**:

- Text input in fields
- Textarea changes
- Contenteditable modifications

**Schema**:

```typescript
{
  type: "input",
  selector: string,
  value: string,         // Masked if sensitive
  inputType?: string,    // text, email, password, etc.
  fieldName?: string,    // name or aria-label
}
```

**LLM Context Value**: Very High - direct user intent expression

**Privacy Considerations**:

- Mask: passwords, emails, phone numbers, OTPs
- Preserve first 2 characters + length for LLM context
- Truncate long values (>64 chars)

#### 4. Focus Events (`focus`)

**Purpose**: Track element attention without input

**Triggers**:

- Focus on input/textarea elements

**Schema**:

```typescript
{
  type: "focus",
  selector: string,
  value: string,         // Current value (masked)
  fieldName?: string,
}
```

**LLM Context Value**: Medium - indicates user attention

## Event Payload Structure

### Standard Envelope

Every event shares this base structure:

```typescript
{
  ts_utc: number,        // Unix timestamp (ms)
  ts_iso: string,        // ISO 8601 string
  url: string,           // Current page URL
  title: string | null,  // Document title
  type: EventType,       // Event discriminator
  data: {                // Type-specific payload
    // ... event-specific fields
  },
  meta?: {               // Optional metadata
    tabId?: number,
    sessionId?: string,
    sequence?: number,
  }
}
```

### Design Rationale

1. **Dual Timestamps**: `ts_utc` for sorting/filtering, `ts_iso` for human readability
2. **URL + Title**: Establishes page context without requiring joins
3. **Type Discriminator**: Enables type-safe parsing and processing
4. **Flat Data Structure**: Optimized for LLM consumption (no deep nesting)
5. **Optional Meta**: Future extensibility without breaking changes

## Performance Considerations

### Current Performance Bottlenecks

1. **Async `emit()` on Every Event**
   - Problem: `chrome.storage.local.get()` called for each event (~1-5ms overhead)
   - Solution: Cache `paused` state with `chrome.storage.onChanged` listener
   - Impact: Reduces overhead to <0.1ms

2. **Full Document `innerText`**
   - Problem: Can take 50-200ms on large pages
   - Solution: Use IntersectionObserver to capture only viewport text
   - Impact: Reduces to <5ms

3. **No Input Throttling**
   - Problem: Rapid typing generates excessive events
   - Solution: Throttle to 500ms or capture on blur
   - Impact: Reduces event volume by 80-90%

4. **No Deduplication**
   - Problem: Accidental double-clicks create redundant events
   - Solution: Deduplicate events within 100ms window
   - Impact: Reduces event volume by 10-20%

### Performance Budget

Target overhead per interaction:

- Click: <1ms
- Input: <2ms (throttled)
- Focus: <1ms
- Navigation: <10ms

### Optimization Strategies

#### 1. Paused State Caching

```typescript
// Cache paused state, update on change
let isPaused = false;

chrome.storage.onChanged.addListener((changes) => {
  if (changes.paused) {
    isPaused = changes.paused.newValue;
  }
});

// Synchronous check
export function emit(type: EventType, data: Record<string, unknown>) {
  if (isPaused) return; // No async call!
  // ... rest of emit logic
}
```

#### 2. Event Deduplication

```typescript
const recentEvents = new Map<string, number>();

function isDuplicate(type: string, key: string): boolean {
  const eventKey = `${type}:${key}`;
  const lastTime = recentEvents.get(eventKey);
  const now = performance.now();

  if (lastTime && now - lastTime < 100) {
    return true; // Duplicate within 100ms
  }

  recentEvents.set(eventKey, now);

  // Cleanup old entries
  if (recentEvents.size > 100) {
    const cutoff = now - 1000;
    for (const [k, t] of recentEvents) {
      if (t < cutoff) recentEvents.delete(k);
    }
  }

  return false;
}
```

#### 3. Input Throttling

```typescript
const inputTimers = new WeakMap<Element, number>();

function registerInputs() {
  addEventListener(
    "input",
    (e) => {
      const target = e.target as HTMLInputElement;

      // Clear existing timer
      const existing = inputTimers.get(target);
      if (existing) clearTimeout(existing);

      // Set new timer
      const timer = window.setTimeout(() => {
        emit("input", {
          selector: cssPath(target),
          value: maskInputValue(target),
        });
      }, 500);

      inputTimers.set(target, timer);
    },
    { capture: true },
  );

  // Also capture on blur (immediate)
  addEventListener(
    "blur",
    (e) => {
      const target = e.target as HTMLInputElement;
      const timer = inputTimers.get(target);
      if (timer) {
        clearTimeout(timer);
        emit("input", {
          /* ... */
        });
      }
    },
    { capture: true },
  );
}
```

#### 4. Efficient Visible Text Capture

```typescript
function registerVisibleText() {
  const observer = new IntersectionObserver(
    (entries) => {
      const visibleText = entries
        .filter((e) => e.isIntersecting)
        .map((e) => e.target.textContent?.trim())
        .filter(Boolean)
        .join("\n");

      if (visibleText) {
        emit("visible_text", { text: visibleText });
      }
    },
    { threshold: 0.5 }, // 50% visible
  );

  // Observe main content elements
  const observe = () => {
    document
      .querySelectorAll("article, main, p, h1, h2, h3, li")
      .forEach((el) => observer.observe(el));
  };

  if (document.readyState === "loading") {
    addEventListener("DOMContentLoaded", observe);
  } else {
    observe();
  }
}
```

## Reliability & Error Handling

### Critical Requirements

1. **No Data Loss**: Events must not be lost during page transitions
2. **Graceful Degradation**: Continue capturing even if local server is down
3. **Reconnection Logic**: Auto-reconnect to service worker on disconnect
4. **Buffer Overflow**: Handle excessive event rates without crashing

### Current Issues

1. **Page Unload Data Loss**
   - Problem: Events in buffer are lost when page closes
   - Solution: Use `visibilitychange` to flush buffer before unload
   - Limitation: Not guaranteed (browser may kill tab)

2. **Port Reconnection Race**
   - Problem: Multiple reconnection attempts can overlap
   - Solution: Add mutex/lock to prevent concurrent reconnects

3. **Silent Buffer Overflow**
   - Problem: Old events dropped without notification
   - Solution: Log overflow events, consider compression or sampling

### Error Handling Strategy

#### 1. Graceful Emit Failures

```typescript
export function emit(type: EventType, data: Record<string, unknown>) {
  try {
    if (isPaused) return;

    const { ts_utc, ts_iso } = getTimestamps();
    const eventPayload: EventPayload = {
      ts_utc,
      ts_iso,
      url: location.href,
      title: document.title || null,
      type,
      data,
    };

    safePush(eventPayload);
  } catch (error) {
    console.error(`Failed to emit ${type} event:`, error);
    // Don't throw - continue capturing other events
  }
}
```

#### 2. Buffer Overflow with Logging

```typescript
export function safePush(eventPayload: EventPayload) {
  if (buf.length >= MAX_BUFFER) {
    console.warn(
      `Buffer overflow: dropping ${buf.length - MAX_BUFFER + 1} old events`,
    );

    // Emit overflow event
    emit("buffer_overflow", {
      droppedCount: buf.length - MAX_BUFFER + 1,
      oldestTimestamp: buf[0].ts_iso,
    });

    buf.splice(0, buf.length - MAX_BUFFER + 1);
  }

  buf.push(eventPayload);
  scheduleFlush();
}
```

#### 3. Port Reconnection with Mutex

```typescript
let port: chrome.runtime.Port | null = null;
let reconnecting = false;

async function reconnect() {
  if (reconnecting) return;
  reconnecting = true;

  try {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    port = chrome.runtime.connect(undefined, { name: PORT_NAME });
    setupPortListeners(port);
  } catch (error) {
    console.error("Reconnection failed:", error);
  } finally {
    reconnecting = false;
  }
}
```

#### 4. Flush on Page Unload

```typescript
addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flush(); // Immediate flush
  }
});

addEventListener("pagehide", () => {
  flush(); // Last-ditch attempt
});
```

### Retry Strategy for Service Worker

```typescript
async function sendToLocalhost(
  payload: { events: EventPayload[] },
  retries = 3,
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const healthy = await checkHealth();
      if (!healthy) {
        console.log("Server not healthy, skipping send");
        return;
      }

      await fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify(payload),
        keepalive: true,
      });

      return; // Success
    } catch (error) {
      console.error(`Send attempt ${attempt} failed:`, error);

      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * attempt)); // Exponential backoff
      }
    }
  }

  console.error("Failed to send after all retries");
}
```

## Privacy & Security

### Data Masking Rules

#### Sensitive Input Types

Always mask:

- `type="password"`
- `type="email"` (partial mask: show first 2 chars)
- `type="tel"`
- `autocomplete="one-time-code"`
- Credit card fields (detect via name/autocomplete)

#### Masking Strategy

```typescript
function maskInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
): string {
  const type = (element.type || "").toLowerCase();
  const value = element.value ?? "";

  // Full mask for passwords
  if (type === "password") {
    return "*".repeat(value.length);
  }

  // Partial mask for PII
  if (
    /email|tel|number/i.test(type) ||
    element.autocomplete === "one-time-code"
  ) {
    return value.slice(0, 2) + "*".repeat(Math.max(0, value.length - 2));
  }

  // Check for credit card patterns
  if (/card|ccnum|cardnumber/i.test(element.name || element.id || "")) {
    return "**** **** **** " + value.slice(-4);
  }

  // Truncate long values
  return value.length > 64 ? value.slice(0, 61) + "..." : value;
}
```

### URL Sanitization

Strip sensitive query parameters:

```typescript
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const sensitiveParams = ["token", "key", "auth", "session", "api_key"];

    sensitiveParams.forEach((param) => {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, "[REDACTED]");
      }
    });

    return parsed.toString();
  } catch {
    return url; // Return as-is if parsing fails
  }
}
```

### Content Security

- All data stays on user's machine (localhost only)
- No external network requests from extension
- User-controlled pause/resume
- Future: Allow users to configure masking rules
- Future: Exclude specific domains/URLs from capture

## CSS Selector Generation

### Current Implementation Issues

1. **Unreliable IDs**: Assumes IDs are unique (often not true in SPAs)
2. **Limited Depth**: Max 5 levels may be insufficient
3. **No Attribute Support**: Misses data-testid, role, etc.
4. **Fragile to DOM Changes**: Classes can change frequently

### Improved Implementation

```typescript
export function cssPath(element: Element): string {
  // Priority 1: Unique ID
  if (element.id && document.querySelectorAll(`#${element.id}`).length === 1) {
    return `#${element.id}`;
  }

  // Priority 2: Semantic attributes
  const testId = element.getAttribute("data-testid");
  if (testId) {
    const selector = `[data-testid="${testId}"]`;
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }

  // Priority 3: ARIA role + accessible name
  const role = element.getAttribute("role");
  const label = element.getAttribute("aria-label");
  if (role && label) {
    const selector = `[role="${role}"][aria-label="${label}"]`;
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }

  // Priority 4: Build path with classes
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && parts.length < 8) {
    let part = current.tagName.toLowerCase();

    // Add nth-child if needed for uniqueness
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName,
      );

      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        part += `:nth-of-type(${index})`;
      }
    }

    // Add stable classes (avoid dynamic ones)
    if (current.classList.length) {
      const stableClasses = [...current.classList]
        .filter((c) => !/(active|selected|hover|focus|open)/i.test(c))
        .slice(0, 2);

      if (stableClasses.length) {
        part += "." + stableClasses.join(".");
      }
    }

    parts.unshift(part);
    current = parent;
  }

  return parts.join(" > ");
}
```

### Selector Stability Score

Track selector reliability:

```typescript
interface SelectorMetadata {
  selector: string;
  stability: number; // 0-1 score
  lastSeen: number;
  matchCount: number;
}

// Test selector uniqueness
function getSelectorStability(selector: string): number {
  try {
    const matches = document.querySelectorAll(selector);

    if (matches.length === 0) return 0;
    if (matches.length === 1) return 1;

    return 1 / matches.length; // Penalty for ambiguity
  } catch {
    return 0; // Invalid selector
  }
}
```

## LLM Integration Design

### Query Patterns

The local database should support these LLM query patterns:

#### 1. Intent Inference

"What is the user trying to accomplish?"

**Relevant Events**:

- Recent navigation sequence
- Search queries (input events on search fields)
- Clicked links/buttons
- Form submissions

**Query Example**:

```sql
SELECT * FROM events
WHERE ts_utc > NOW() - 5 * 60 * 1000  -- Last 5 minutes
ORDER BY ts_utc DESC
LIMIT 50
```

#### 2. Context Reconstruction

"What has the user seen?"

**Relevant Events**:

- Page titles and URLs
- Navigation history
- Time spent on page (from navigation timestamps)
- Clicked elements (text content provides context)

#### 3. Action History

"What did the user do?"

**Relevant Events**:

- Clicks (with text/href)
- Form inputs (masked)
- Submissions
- Copy/paste events

#### 4. Session Analysis

"What is the user's workflow?"

**Relevant Events**:

- Tab switching (visibility)
- Multi-tab coordination
- Time on page
- Interaction density

### Event Preprocessing for LLMs

**Compression Strategies**:

1. **Event Summarization**: Merge rapid sequential events
   - Typing sequence → "entered text in email field"
   - Multiple clicks on same area → "explored navigation menu"

2. **Contextual Grouping**: Bundle related events
   - Navigation + first clicks → page visit summary
   - Multiple clicks in same area → interaction cluster

3. **Semantic Extraction**: Convert to natural language

   ```
   Raw: {"type": "click", "selector": "button.submit", "text": "Sign In"}
   LLM: "User clicked 'Sign In' button"
   ```

4. **Relevance Filtering**: Drop low-signal events
   - Filter out bot-like behavior
   - Remove duplicate events within short time windows
   - Ignore accidental rapid clicks

### Event Storage Schema

**Recommended Database Structure**:

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_utc INTEGER NOT NULL,
  ts_iso TEXT NOT NULL,
  session_id TEXT,
  tab_id INTEGER,
  url TEXT NOT NULL,
  title TEXT,
  type TEXT NOT NULL,
  data JSON NOT NULL,

  -- LLM optimization
  summary TEXT,           -- Human-readable event description
  embedding BLOB,         -- Optional: vector embedding for semantic search
  relevance_score REAL,   -- Computed importance (0-1)

  -- Indexes
  INDEX idx_ts (ts_utc),
  INDEX idx_session (session_id),
  INDEX idx_type (type),
  INDEX idx_url (url)
);

-- Session table for context
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  start_time INTEGER,
  end_time INTEGER,
  tab_count INTEGER,
  event_count INTEGER,
  primary_domain TEXT,
  inferred_intent TEXT    -- LLM-generated summary
);
```

## Configuration & Tuning

### Tunable Constants

Located in `src/content/config.ts`:

```typescript
// Batching
export const BATCH_SIZE = 100; // Events per batch
export const BATCH_MS = 2000; // Max time before flush (ms)
export const MAX_BUFFER = 2000; // Max events in buffer

// Throttling
export const INPUT_THROTTLE_MS = 500;
export const RESIZE_THROTTLE_MS = 1000;

// Deduplication
export const DEDUP_WINDOW_MS = 100; // Ignore duplicates within window
export const DEDUP_CACHE_SIZE = 100; // Max recent events to track

// Text Capture
export const MAX_TEXT_LENGTH = 10000; // Max chars per visible_text event
export const MAX_INNER_TEXT = 120; // Max chars for click text

// Performance
export const MAX_SELECTOR_DEPTH = 8; // Max CSS path depth
export const EVENT_EMIT_TIMEOUT = 50; // Max time for emit() (ms)
```

### Environment-Based Tuning

```typescript
// Adjust based on page complexity
const pageComplexity = document.querySelectorAll("*").length;

export const BATCH_SIZE = pageComplexity > 5000 ? 50 : 100;
export const INPUT_THROTTLE_MS = pageComplexity > 5000 ? 1000 : 500;
```

### User Preferences

Future: Allow users to configure via popup UI:

```typescript
interface UserConfig {
  captureClicks: boolean;
  captureInputs: boolean;
  captureFocus: boolean;
  captureVisibleText: boolean;

  maskingSensitivity: "strict" | "balanced" | "minimal";
  eventBatchSize: number;

  excludedDomains: string[]; // Never capture on these domains
  excludedUrls: RegExp[]; // Never capture matching URLs
}
```

## Testing Strategy

### Unit Tests

Test individual capture functions:

```typescript
describe("registerClicks", () => {
  it("should emit click events with correct selector", () => {
    const button = document.createElement("button");
    button.id = "test-btn";
    button.textContent = "Click me";
    document.body.appendChild(button);

    const emitSpy = jest.spyOn(utils, "emit");

    button.click();

    expect(emitSpy).toHaveBeenCalledWith("click", {
      selector: "#test-btn",
      text: "Click me",
    });
  });

  it("should not emit when paused", async () => {
    await chrome.storage.local.set({ paused: true });

    const emitSpy = jest.spyOn(utils, "emit");
    const button = document.createElement("button");
    button.click();

    expect(emitSpy).not.toHaveBeenCalled();
  });
});
```

### Integration Tests

Test end-to-end event flow:

```typescript
describe("Event Pipeline", () => {
  it("should buffer and flush events to service worker", async () => {
    const portSpy = jest.spyOn(chrome.runtime, "connect");

    // Generate events
    for (let i = 0; i < 101; i++) {
      emit("click", { selector: `#btn-${i}` });
    }

    // Should trigger flush at BATCH_SIZE
    await waitFor(() => {
      expect(portSpy).toHaveBeenCalled();
    });
  });
});
```

### Performance Tests

Measure overhead:

```typescript
describe("Performance", () => {
  it("emit() should complete in <1ms", () => {
    const start = performance.now();

    for (let i = 0; i < 1000; i++) {
      emit("click", { selector: "#test" });
    }

    const elapsed = performance.now() - start;
    const avgTime = elapsed / 1000;

    expect(avgTime).toBeLessThan(1);
  });
});
```

### Manual Testing Checklist

- [ ] Click tracking on various element types
- [ ] Input tracking with masking
- [ ] Navigation tracking (full page + SPA)
- [ ] Focus/blur tracking
- [ ] Pause/resume functionality
- [ ] Buffer overflow handling
- [ ] Port reconnection on service worker restart
- [ ] Health check with server down
- [ ] Page unload event flushing
- [ ] Multi-tab event isolation

## Implementation Guidelines

### Code Style

1. **Type Safety**: Use TypeScript strictly
   - No `any` types (use `unknown` if needed)
   - Exhaustive type checking for event types
   - Proper null handling

2. **Error Handling**: Defensive programming
   - Try-catch in all event listeners
   - Graceful degradation
   - Comprehensive logging

3. **Performance**: Optimize critical path
   - Minimize allocations in hot paths
   - Use WeakMap for element associations
   - Profile with Chrome DevTools

4. **Testing**: High coverage
   - Unit tests for utilities
   - Integration tests for event flow
   - Performance benchmarks

### Code Organization

```
src/
├── content/
│   ├── index.ts              # Entry point
│   ├── captures/             # Event capture modules (split by type)
│   │   ├── navigation.ts
│   │   ├── clicks.ts
│   │   ├── inputs.ts
│   │   ├── focus.ts
│   │   ├── visibility.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── emit.ts           # Event emission
│   │   ├── selectors.ts      # CSS path generation
│   │   ├── masking.ts        # Privacy functions
│   │   ├── dedup.ts          # Deduplication
│   │   └── index.ts
│   ├── buffer.ts             # Event buffering
│   ├── port.ts               # Service worker connection
│   └── config.ts             # Constants
├── worker/
│   ├── index.ts              # Service worker entry
│   ├── health.ts             # Health check logic
│   └── sender.ts             # HTTP sending
├── popup/
│   ├── App.tsx               # React root
│   ├── components/
│   └── index.tsx
└── shared/
    ├── types.ts              # Shared types
    └── constants.ts          # Shared constants
```

### Git Workflow

1. **Feature Branches**: One feature per branch
   - `feature/input-throttling`
   - `feature/form-submission`
   - `fix/port-reconnection`

2. **Commit Messages**: Conventional commits
   - `feat: add input throttling`
   - `fix: prevent port reconnection race`
   - `perf: cache paused state`

3. **Pull Requests**: Comprehensive reviews
   - Include performance impact
   - Add tests
   - Update this DESIGN.md if architecture changes

### Performance Monitoring

Add instrumentation:

```typescript
const perfMetrics = {
  emitCount: 0,
  emitTotalTime: 0,
  bufferFlushCount: 0,
  portReconnectCount: 0,
};

export function recordEmitTime(duration: number) {
  perfMetrics.emitCount++;
  perfMetrics.emitTotalTime += duration;

  // Log every 100 events
  if (perfMetrics.emitCount % 100 === 0) {
    const avg = perfMetrics.emitTotalTime / perfMetrics.emitCount;
    console.log(`Emit avg time: ${avg.toFixed(2)}ms`);
  }
}
```

## Decision Log

### Why Manifest V3?

- Required for new Chrome extensions
- Service workers instead of persistent background pages
- More secure and resource-efficient

### Why Port Connection vs Message Passing?

- Long-lived connection reduces overhead
- Supports streaming events
- Auto-reconnect is essential for reliability

### Why `no-cors` Mode?

- Simplifies local server setup (no CORS headers needed)
- Opaque responses are fine (we don't need to read them)
- Reduces friction for users

### Why Local-First Storage?

- Privacy: user data never leaves their machine
- Performance: no network latency
- Reliability: works offline
- Control: user owns their data

### Why Batching Instead of Real-Time?

- Reduces overhead (100 events → 1 message)
- Smooths out bursts
- Better for battery/performance
- 2-second delay is acceptable for LLM use case

### Why Mask Instead of Drop Sensitive Data?

- LLMs benefit from structure ("user entered password, 8 chars")
- Length/pattern can indicate intent
- Partial mask preserves some context
- User can audit what's captured

## Glossary

- **Content Script**: JavaScript running in web page context
- **Service Worker**: Background script (Manifest V3)
- **Port**: Long-lived message channel
- **Emit**: Generate an event
- **Buffer**: Temporary event storage before flush
- **Batch**: Group of events sent together
- **Flush**: Send buffered events to service worker
- **Throttle**: Limit event rate by time
- **Debounce**: Delay event until quiet period
- **Deduplicate**: Remove redundant events
- **Mask**: Hide sensitive parts of data
- **CSS Path**: Selector string identifying DOM element
- **SPA**: Single-page application (client-side routing)

## References

- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Service Workers](https://developer.chrome.com/docs/extensions/mv3/service_workers/)
- [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-11
**Maintained By**: BrowseTrace Team

For implementation questions, refer to this design document. All architectural decisions should be documented here.
