export type EventType = 'navigate' | 'visible_text' | 'click' | 'input' | 'focus';

export interface Event {
  ts_utc: number;
  ts_iso: string;
  url: string;
  title: string | null;
  type: EventType;
  data: Record<string, unknown>;
}

export interface EventBatch {
  events: Event[];
}

export interface EventFilter {
  type?: EventType;
  since?: number;
  until?: number;
  limit?: number;
}
