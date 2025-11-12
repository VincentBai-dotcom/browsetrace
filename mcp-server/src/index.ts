#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { setupBrowseTraceServer } from './server.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  // Create MCP server instance
  const server = new Server(
    {
      name: 'browsetrace-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Set up BrowseTrace tools
  setupBrowseTraceServer(server);

  // Connect stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Error handling
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
