import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  getRecentEvents,
  getEventsByType,
  searchByUrl,
  getInputHistory,
  analyzeBrowsingPatterns,
  analyzeTabSwitches,
} from './tools/index.js';

export function setupBrowseTraceServer(server: McpServer) {
  // Register get_recent_events tool
  server.tool(
    'get_recent_events',
    'Get recent browsing events from the last N hours. Returns events with URLs, titles, types, and data.',
    {
      hours: z.number().optional().describe('Number of hours to look back (default: 24)'),
      limit: z.number().optional().describe('Maximum number of events to return (default: 100)'),
    },
    async ({ hours, limit }) => {
      const result = await getRecentEvents({ hours, limit });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Register get_events_by_type tool
  server.tool(
    'get_events_by_type',
    'Get events filtered by type. Available types: navigate, visible_text, click, input, focus.',
    {
      type: z
        .enum(['navigate', 'visible_text', 'click', 'input', 'focus'])
        .describe('Event type to filter by'),
      limit: z.number().optional().describe('Maximum number of events to return (default: 100)'),
    },
    async ({ type, limit }) => {
      const result = await getEventsByType({ type: type as any, limit });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Register search_by_url tool
  server.tool(
    'search_by_url',
    'Search for events by URL pattern (case-insensitive substring match). Useful for finding activity on specific websites.',
    {
      urlPattern: z.string().describe('URL pattern to search for (e.g., "github.com", "google")'),
      limit: z.number().optional().describe('Maximum number of events to return (default: 100)'),
    },
    async ({ urlPattern, limit }) => {
      const result = await searchByUrl({ urlPattern, limit });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Register get_input_history tool
  server.tool(
    'get_input_history',
    'Get form input history including selectors and values. WARNING: May contain sensitive data like passwords.',
    {
      limit: z
        .number()
        .optional()
        .describe('Maximum number of input events to return (default: 50)'),
    },
    async ({ limit }) => {
      const result = await getInputHistory({ limit });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Register analyze_browsing_patterns tool
  server.tool(
    'analyze_browsing_patterns',
    'Analyze browsing patterns including unique URLs visited, most visited sites, and event type distribution.',
    {
      hours: z.number().optional().describe('Number of hours to analyze (default: 24)'),
    },
    async ({ hours }) => {
      const result = await analyzeBrowsingPatterns({ hours });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Register analyze_tab_switches tool
  server.tool(
    'analyze_tab_switches',
    'Analyze tab switching behavior to understand which tabs users switch between most frequently.',
    {
      hours: z.number().optional().describe('Number of hours to analyze (default: 24)'),
    },
    async ({ hours }) => {
      const result = await analyzeTabSwitches({ hours });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
