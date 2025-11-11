import { BrowseTraceAPI } from '../api/client.js';
import type { Event, EventType } from '../types/events.js';

const api = new BrowseTraceAPI();

/**
 * Tool: Get recent browsing events
 */
export async function getRecentEvents(params: {
  hours?: number;
  limit?: number;
}): Promise<{ events: Event[]; count: number }> {
  const hours = params.hours || 24;
  const limit = params.limit || 100;

  const events = await api.getRecentEvents(hours, limit);

  return {
    events,
    count: events.length,
  };
}

/**
 * Tool: Get events by type
 */
export async function getEventsByType(params: {
  type: EventType;
  limit?: number;
}): Promise<{ events: Event[]; count: number }> {
  const limit = params.limit || 100;
  const events = await api.getEventsByType(params.type, limit);

  return {
    events,
    count: events.length,
  };
}

/**
 * Tool: Analyze browsing patterns
 */
export async function analyzeBrowsingPatterns(params: {
  hours?: number;
}): Promise<{
  totalEvents: number;
  uniqueUrls: number;
  mostVisitedUrls: Array<{ url: string; count: number }>;
  eventTypeCounts: Record<EventType, number>;
  timeRange: { from: string; to: string };
}> {
  const hours = params.hours || 24;
  const events = await api.getRecentEvents(hours, 1000);

  // Count unique URLs
  const urlCounts = new Map<string, number>();
  const eventTypeCounts: Record<string, number> = {
    navigate: 0,
    visible_text: 0,
    click: 0,
    input: 0,
    focus: 0,
  };

  for (const event of events) {
    urlCounts.set(event.url, (urlCounts.get(event.url) || 0) + 1);
    eventTypeCounts[event.type] = (eventTypeCounts[event.type] || 0) + 1;
  }

  // Get most visited URLs
  const mostVisited = Array.from(urlCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([url, count]) => ({ url, count }));

  const timestamps = events.map((e) => e.ts_utc);
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);

  return {
    totalEvents: events.length,
    uniqueUrls: urlCounts.size,
    mostVisitedUrls: mostVisited,
    eventTypeCounts: eventTypeCounts as Record<EventType, number>,
    timeRange: {
      from: new Date(minTime).toISOString(),
      to: new Date(maxTime).toISOString(),
    },
  };
}

/**
 * Tool: Search events by URL pattern
 */
export async function searchByUrl(params: {
  urlPattern: string;
  limit?: number;
}): Promise<{ events: Event[]; count: number }> {
  const limit = params.limit || 100;
  const allEvents = await api.getEvents({ limit: 1000 });

  const pattern = params.urlPattern.toLowerCase();
  const matchingEvents = allEvents.filter((event) =>
    event.url.toLowerCase().includes(pattern)
  );

  return {
    events: matchingEvents.slice(0, limit),
    count: matchingEvents.length,
  };
}

/**
 * Tool: Get user input history
 */
export async function getInputHistory(params: {
  limit?: number;
}): Promise<{
  inputs: Array<{
    url: string;
    selector: string;
    value: string;
    timestamp: string;
  }>;
  count: number;
}> {
  const limit = params.limit || 50;
  const events = await api.getEventsByType('input', limit);

  const inputs = events.map((event) => ({
    url: event.url,
    selector: (event.data as any).selector || 'unknown',
    value: (event.data as any).value || '',
    timestamp: event.ts_iso,
  }));

  return {
    inputs,
    count: inputs.length,
  };
}

/**
 * Tool: Analyze tab switches (navigation events with session_id="tab-switch")
 */
export async function analyzeTabSwitches(params: {
  hours?: number;
}): Promise<{
  totalSwitches: number;
  tabSwitchEvents: Array<{
    from: string | null;
    to: string;
    timestamp: string;
  }>;
  mostSwitchedBetween: Array<{
    from: string;
    to: string;
    count: number;
  }>;
}> {
  const hours = params.hours || 24;
  const events = await api.getRecentEvents(hours, 1000);

  // Filter for tab switch events
  const tabSwitches = events.filter(
    (e) => e.type === 'navigate' && e.session_id === 'tab-switch'
  );

  const switchEvents = tabSwitches.map((event) => ({
    from: (event.data as any).from || null,
    to: (event.data as any).to,
    timestamp: event.ts_iso,
  }));

  // Count switch patterns
  const switchPairs = new Map<string, number>();
  for (const sw of switchEvents) {
    if (sw.from) {
      const key = `${sw.from} -> ${sw.to}`;
      switchPairs.set(key, (switchPairs.get(key) || 0) + 1);
    }
  }

  const mostSwitched = Array.from(switchPairs.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pair, count]) => {
      const [from, to] = pair.split(' -> ');
      return { from, to, count };
    });

  return {
    totalSwitches: tabSwitches.length,
    tabSwitchEvents: switchEvents.slice(0, 20), // Last 20 switches
    mostSwitchedBetween: mostSwitched,
  };
}

// Export tool definitions for Claude Agent SDK
export const browsingTools = [
  {
    name: 'get_recent_events',
    description:
      'Get recent browsing events from the last N hours. Returns events with timestamps, URLs, and interaction data.',
    input_schema: {
      type: 'object' as const,
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
    function: getRecentEvents,
  },
  {
    name: 'get_events_by_type',
    description:
      'Get events filtered by type: navigate, click, input, focus, or visible_text.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['navigate', 'visible_text', 'click', 'input', 'focus'],
          description: 'Type of events to retrieve',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of events to return (default: 100)',
        },
      },
      required: ['type'],
    },
    function: getEventsByType,
  },
  {
    name: 'analyze_browsing_patterns',
    description:
      'Analyze browsing patterns over time: most visited URLs, event type distribution, unique sites visited.',
    input_schema: {
      type: 'object' as const,
      properties: {
        hours: {
          type: 'number',
          description: 'Number of hours to analyze (default: 24)',
        },
      },
    },
    function: analyzeBrowsingPatterns,
  },
  {
    name: 'search_by_url',
    description: 'Search for events by URL pattern. Case-insensitive partial match.',
    input_schema: {
      type: 'object' as const,
      properties: {
        urlPattern: {
          type: 'string',
          description: 'URL pattern to search for (e.g., "github.com", "reddit")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 100)',
        },
      },
      required: ['urlPattern'],
    },
    function: searchByUrl,
  },
  {
    name: 'get_input_history',
    description:
      'Get history of user inputs on forms and text fields, including values entered.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of inputs to return (default: 50)',
        },
      },
    },
    function: getInputHistory,
  },
  {
    name: 'analyze_tab_switches',
    description:
      'Analyze tab switching behavior: which tabs users switch between most frequently.',
    input_schema: {
      type: 'object' as const,
      properties: {
        hours: {
          type: 'number',
          description: 'Number of hours to analyze (default: 24)',
        },
      },
    },
    function: analyzeTabSwitches,
  },
];
