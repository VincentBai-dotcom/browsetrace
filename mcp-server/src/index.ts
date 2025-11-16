#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { setupBrowseTraceServer } from './server.js';

async function main() {
  // Create MCP server instance
  const server = new McpServer({
    name: 'browsetrace-mcp',
    version: '1.0.0',
  });

  // Set up BrowseTrace tools
  setupBrowseTraceServer(server);

  // Connect stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('BrowseTrace MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
