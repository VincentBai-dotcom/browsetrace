import { BrowseTraceAPI } from '../api/client.js';
import type { Event, EventType } from '../types/events.js';
import { formatLocalTime } from '../utils/timezone.js';

const api = new BrowseTraceAPI();

/**
 * Get recent browsing events from the last N hours
 */
export async function getRecentEvents(params: {
  hours?: number;
  limit?: number;
}): Promise<{ events: Array<Event & { ts_local: string }>; count: number }> {
  const hours = params.hours ?? 24;
  const limit = params.limit ?? 100;

  const events = await api.getRecentEvents(hours, limit);

  // Add local timezone timestamp to each event
  const eventsWithLocal = events.map(event => ({
    ...event,
    ts_local: formatLocalTime(event.ts_utc),
  }));

  return {
    events: eventsWithLocal,
    count: eventsWithLocal.length,
  };
}

/**
 * Get events filtered by type
 */
export async function getEventsByType(params: {
  type: EventType;
  limit?: number;
}): Promise<{ events: Array<Event & { ts_local: string }>; count: number }> {
  const limit = params.limit ?? 100;

  const events = await api.getEventsByType(params.type, limit);

  // Add local timezone timestamp to each event
  const eventsWithLocal = events.map(event => ({
    ...event,
    ts_local: formatLocalTime(event.ts_utc),
  }));

  return {
    events: eventsWithLocal,
    count: eventsWithLocal.length,
  };
}

/**
 * Search events by URL pattern (case-insensitive substring match)
 */
export async function searchByUrl(params: {
  urlPattern: string;
  limit?: number;
}): Promise<{ events: Array<Event & { ts_local: string }>; count: number }> {
  const limit = params.limit ?? 100;
  const pattern = params.urlPattern.toLowerCase();

  // Fetch a large batch and filter client-side
  const allEvents = await api.getEvents({ limit });

  const matchedEvents = allEvents.filter((event) =>
    event.url.toLowerCase().includes(pattern)
  );

  // Add local timezone timestamp to each event
  const eventsWithLocal = matchedEvents.map(event => ({
    ...event,
    ts_local: formatLocalTime(event.ts_utc),
  }));

  return {
    events: eventsWithLocal,
    count: eventsWithLocal.length,
  };
}

/**
 * Get form input history (includes sensitive data - use with caution)
 */
export async function getInputHistory(params: {
  limit?: number;
}): Promise<{ inputs: Array<{ url: string; selector: string; value: string; timestamp: string }>; count: number }> {
  const limit = params.limit ?? 50;

  const events = await api.getEventsByType('input', limit);

  const inputs = events.map((event) => {
    const data = event.data as { selector: string; value: string };
    return {
      url: event.url,
      selector: data.selector,
      value: data.value,
      timestamp: formatLocalTime(event.ts_utc),
    };
  });

  return {
    inputs,
    count: inputs.length,
  };
}
