import { BrowseTraceAPI } from '../api/client.js';
import type { Event, EventType, NavigateEventData, InputEventData } from '../types/events.js';

const api = new BrowseTraceAPI();

/**
 * Analyze browsing patterns: unique URLs, most visited, event distribution
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
  const hours = params.hours ?? 24;
  const events = await api.getRecentEvents(hours, 1000);

  if (events.length === 0) {
    return {
      totalEvents: 0,
      uniqueUrls: 0,
      mostVisitedUrls: [],
      eventTypeCounts: {
        navigate: 0,
        visible_text: 0,
        click: 0,
        input: 0,
        focus: 0,
      },
      timeRange: { from: '', to: '' },
    };
  }

  // Count unique URLs
  const urlCounts = new Map<string, number>();
  const eventTypeCounts: Record<EventType, number> = {
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
    eventTypeCounts,
    timeRange: {
      from: new Date(minTime).toISOString(),
      to: new Date(maxTime).toISOString(),
    },
  };
}

/**
 * Analyze tab switching behavior (navigation events with session_id="tab-switch")
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
  const hours = params.hours ?? 24;
  const events = await api.getRecentEvents(hours, 1000);

  // Filter for tab switch events
  const tabSwitches = events.filter(
    (e) => e.type === 'navigate' && e.session_id === 'tab-switch'
  );

  const switchEvents = tabSwitches.map((event) => {
    const data = event.data as NavigateEventData;
    return {
      from: data.from,
      to: data.to,
      timestamp: event.ts_iso,
    };
  });

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
