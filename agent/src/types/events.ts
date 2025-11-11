// Event types matching the Go server schema and browser extension
export type EventType = 'navigate' | 'visible_text' | 'click' | 'input' | 'focus';

export interface NavigateEventData {
  from: string | null;
  to: string;
}

export interface ClickEventData {
  selector: string;
  text: string;
}

export interface InputEventData {
  selector: string;
  value: string;
}

export interface FocusEventData {
  selector: string;
  value: string;
}

export interface VisibleTextEventData {
  text: string;
}

// Main event structure from database
export interface Event {
  ts_utc: number;
  ts_iso: string;
  url: string;
  title: string | null;
  type: EventType;
  data: NavigateEventData | ClickEventData | InputEventData | FocusEventData | VisibleTextEventData;
  session_id?: string;
  field_id?: string;
}

// Response from GET /events endpoint
export interface EventBatch {
  events: Event[];
}

// Query filters for GET /events
export interface EventFilter {
  type?: EventType;
  since?: number; // Unix timestamp in milliseconds
  until?: number; // Unix timestamp in milliseconds
  limit?: number;
}
