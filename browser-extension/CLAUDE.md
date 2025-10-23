# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BrowseTrace is a Chrome extension that captures user browsing activity and interactions, storing them locally for LLM-powered workflows. It tracks navigation, clicks, inputs, scrolling, focus events, and visible text content.

## Development Commands

```bash
# Install dependencies
pnpm install

# Development mode (auto-rebuilds on changes)
pnpm dev

# Production build
pnpm build

# Preview build
pnpm preview
```

The build process:

- Runs prettier to format code
- Runs eslint to check for errors
- Builds with Vite to `dist/` directory

## Architecture

### Three-Part Extension Structure

1. **Content Script** (`src/content/`)
   - Runs in every web page context
   - Registers event handlers for user interactions (clicks, inputs, scrolls, focus, navigation)
   - Buffers events locally before sending to service worker
   - Uses `emit()` function in `utils.ts` which checks `paused` state from chrome.storage before capturing

2. **Service Worker** (`src/worker/`)
   - Background script (Manifest V3)
   - Receives batched events from content scripts via long-lived port connection
   - Forwards events to local HTTP endpoint (`http://127.0.0.1:8123/events`)
   - Uses `no-cors` mode for simple localhost communication

3. **Popup** (`src/popup/`)
   - React-based UI (React 19)
   - Controls pause/resume state via chrome.storage.local
   - Simple toggle interface for capturing control

### Event Flow

```
User Action → Content Script Handler → emit() [checks paused state] →
Buffer (batched) → Port Message → Service Worker → Local HTTP Server
```

### Key Modules

- **`content/captures.ts`**: Registers all DOM event listeners (navigation, clicks, inputs, focus, visible text)
- **`content/buffer.ts`**: Batches events before sending (configurable size/time in `config.ts`)
- **`content/port.ts`**: Manages long-lived connection to service worker with auto-reconnect
- **`content/utils.ts`**:
  - `emit()` - Central event emission with pause state check
  - `cssPath()` - Generates CSS selectors for DOM elements
  - `maskInputValue()` - Masks sensitive input values (passwords, emails, etc.)
- **`shared/types.ts`**: Type definitions for events shared across modules

### Paused State Mechanism

The extension respects a `paused` boolean stored in `chrome.storage.local`:

- Popup UI toggles this value
- Content script's `emit()` function checks this value before recording any event
- Event handlers remain registered but don't capture when paused

### Build Configuration

Vite builds three separate entry points:

- `src/worker/index.ts` → `dist/worker.js` (service worker)
- `src/content/index.ts` → `dist/content.js` (content script)
- `src/popup/index.tsx` → `dist/popup.js` (popup UI with React)

The `public/` directory contains:

- `manifest.json` - Chrome extension configuration
- `hello.html` - Popup HTML shell that loads React
- `icons/` - Extension icons

### ESLint Configuration

Uses flat config format with:

- TypeScript ESLint
- React plugin for JSX/React rules
- React Hooks plugin for hooks rules
- Prettier config to avoid conflicts

Note: `eslint-plugin-react-hooks` has incomplete type definitions, so a `@ts-expect-error` comment is used on the import.

## Local Development Setup

1. Build the extension with `pnpm dev` (watch mode) or `pnpm build`
2. Load `dist/` as an unpacked extension in Chrome (chrome://extensions, enable Developer mode)
3. Run a local HTTP server on port 8123 to receive events (endpoint: `POST /events`)
4. The service worker will forward all captured events to your local server

## Important Constants

In `src/content/config.ts`:

- `BATCH_SIZE`: 100 events per batch
- `BATCH_MS`: 2000ms max time before flush
- `MAX_BUFFER`: 2000 max events in buffer
- `PORT_NAME`: "events" (connection name)
