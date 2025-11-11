import type { Event, EventBatch, EventFilter } from '../types/events.js';

const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:8123';

export class BrowseTraceAPI {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch events from the BrowseTrace server
   */
  async getEvents(filter: EventFilter = {}): Promise<Event[]> {
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
    const url = queryString ? `${this.baseUrl}/events?${queryString}` : `${this.baseUrl}/events`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.statusText}`);
    }

    const data = (await response.json()) as EventBatch;
    return data.events || [];
  }

  /**
   * Check if the server is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/healthz`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Delete all events
   */
  async deleteAllEvents(): Promise<{ deleted_count: number; message: string }> {
    const response = await fetch(`${this.baseUrl}/events`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete events: ${response.statusText}`);
    }

    return (await response.json()) as { deleted_count: number; message: string };
  }

  /**
   * Get events from the last N hours
   */
  async getRecentEvents(hours: number, limit: number = 100): Promise<Event[]> {
    const since = Date.now() - hours * 60 * 60 * 1000;
    return this.getEvents({ since, limit });
  }

  /**
   * Get events by type
   */
  async getEventsByType(type: EventFilter['type'], limit: number = 100): Promise<Event[]> {
    return this.getEvents({ type, limit });
  }
}
