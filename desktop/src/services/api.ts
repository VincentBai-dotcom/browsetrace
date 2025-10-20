import type { EventBatch, EventFilter } from '../types/events';

const API_BASE_URL = 'http://127.0.0.1:8123';

export async function getEvents(filter: EventFilter = {}): Promise<EventBatch> {
  const params = new URLSearchParams();

  if (filter.type) {
    params.append('type', filter.type);
  }
  if (filter.since !== undefined) {
    params.append('since', filter.since.toString());
  }
  if (filter.until !== undefined) {
    params.append('until', filter.until.toString());
  }
  if (filter.limit !== undefined) {
    params.append('limit', filter.limit.toString());
  }

  const queryString = params.toString();
  const url = queryString ? `${API_BASE_URL}/events?${queryString}` : `${API_BASE_URL}/events`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.statusText}`);
  }

  return response.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/healthz`);
    return response.ok;
  } catch {
    return false;
  }
}
