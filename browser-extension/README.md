# Chrome Activity Tracker

A Chrome extension that captures text from web pages and user input, storing it locally in a structured format for later retrieval and analysis. Designed to support LLM-powered workflows by providing a searchable memory of browsing activity.

## Features

- Captures visible text content from visited pages.
- Extracts metadata (URL, domain, title, language) and Schema.org JSON-LD.
- Stores structured content blocks with section paths and order.
- Records user inputs with timestamps.
- Saves all data to a local vector database for fast similarity search.

## Tech Stack

- **TypeScript** for extension logic
- **Chrome Extension APIs** (content scripts, storage)
- **Vector DB** (local persistence, similarity search)

## Project Structure

- `content/` – DOM extraction and page capture logic
- `background/` – lifecycle management, storage handling
- `models/` – Type definitions (`PageCapture`, `ContentBlock`)
- `utils/` – Metadata & Schema.org collection

## Getting Started

1. Clone this repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
