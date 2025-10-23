// Individual event data types (type-specific fields only)
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

// Discriminated union of event payloads
export type EventPayload =
  | {
      ts_utc: number;
      ts_iso: string;
      url: string;
      title: string | null;
      type: "navigate";
      data: NavigateEventData;
    }
  | {
      ts_utc: number;
      ts_iso: string;
      url: string;
      title: string | null;
      type: "click";
      data: ClickEventData;
    }
  | {
      ts_utc: number;
      ts_iso: string;
      url: string;
      title: string | null;
      type: "input";
      data: InputEventData;
    }
  | {
      ts_utc: number;
      ts_iso: string;
      url: string;
      title: string | null;
      type: "focus";
      data: FocusEventData;
    }
  | {
      ts_utc: number;
      ts_iso: string;
      url: string;
      title: string | null;
      type: "visible_text";
      data: VisibleTextEventData;
    };

// Extract all valid event types from the discriminated union
export type EventType = EventPayload["type"];

// Helper type to get data type for a specific event
export type EventDataForType<T extends EventType> = Extract<
  EventPayload,
  { type: T }
>["data"];
