import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  getRecentEvents,
  getEventsByType,
  searchByUrl,
  getInputHistory,
  analyzeBrowsingPatterns,
  analyzeTabSwitches,
} from './tools/index.js';

export function setupBrowseTraceServer(server: Server) {
  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_recent_events',
          description:
            'Get recent browsing events from the last N hours. Returns events with URLs, titles, types, and data.',
          inputSchema: {
            type: 'object',
            properties: {
              hours: {
                type: 'number',
                description: 'Number of hours to look back (default: 24)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of events to return (default: 100)',
              },
            },
          },
        },
        {
          name: 'get_events_by_type',
          description:
            'Get events filtered by type. Available types: navigate, visible_text, click, input, focus.',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                description:
                  'Event type to filter by (navigate, visible_text, click, input, focus)',
                enum: ['navigate', 'visible_text', 'click', 'input', 'focus'],
              },
              limit: {
                type: 'number',
                description: 'Maximum number of events to return (default: 100)',
              },
            },
            required: ['type'],
          },
        },
        {
          name: 'search_by_url',
          description:
            'Search for events by URL pattern (case-insensitive substring match). Useful for finding activity on specific websites.',
          inputSchema: {
            type: 'object',
            properties: {
              urlPattern: {
                type: 'string',
                description: 'URL pattern to search for (e.g., "github.com", "google")',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of events to return (default: 100)',
              },
            },
            required: ['urlPattern'],
          },
        },
        {
          name: 'get_input_history',
          description:
            'Get form input history including selectors and values. WARNING: May contain sensitive data like passwords.',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of input events to return (default: 50)',
              },
            },
          },
        },
        {
          name: 'analyze_browsing_patterns',
          description:
            'Analyze browsing patterns including unique URLs visited, most visited sites, and event type distribution.',
          inputSchema: {
            type: 'object',
            properties: {
              hours: {
                type: 'number',
                description: 'Number of hours to analyze (default: 24)',
              },
            },
          },
        },
        {
          name: 'analyze_tab_switches',
          description:
            'Analyze tab switching behavior to understand which tabs users switch between most frequently.',
          inputSchema: {
            type: 'object',
            properties: {
              hours: {
                type: 'number',
                description: 'Number of hours to analyze (default: 24)',
              },
            },
          },
        },
      ],
    };
  });

  // Register tool execution handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result;

      switch (name) {
        case 'get_recent_events':
          result = await getRecentEvents(args as { hours?: number; limit?: number });
          break;

        case 'get_events_by_type':
          result = await getEventsByType(args as { type: any; limit?: number });
          break;

        case 'search_by_url':
          result = await searchByUrl(args as { urlPattern: string; limit?: number });
          break;

        case 'get_input_history':
          result = await getInputHistory(args as { limit?: number });
          break;

        case 'analyze_browsing_patterns':
          result = await analyzeBrowsingPatterns(args as { hours?: number });
          break;

        case 'analyze_tab_switches':
          result = await analyzeTabSwitches(args as { hours?: number });
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });
}
