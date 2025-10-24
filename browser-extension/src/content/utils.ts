import type {
  EventPayload,
  EventType,
  NavigateEventData,
  ClickEventData,
  InputEventData,
  FocusEventData,
  VisibleTextEventData,
} from "../shared/types";
import { safePush } from "./buffer";

// Generate unique session ID for this content script instance
const SESSION_ID = crypto.randomUUID();

export function getTimestamps() {
  const date = new Date();
  return { ts_utc: date.getTime(), ts_iso: date.toISOString() };
}

// Type-safe emit function with overloads for each event type
export function emit(type: "navigate", data: NavigateEventData): void;
export function emit(type: "click", data: ClickEventData): void;
export function emit(
  type: "input",
  data: InputEventData,
  fieldId?: string,
): void;
export function emit(type: "focus", data: FocusEventData): void;
export function emit(type: "visible_text", data: VisibleTextEventData): void;

// Implementation signature (not exported separately)
export async function emit(
  type: EventType,
  data: unknown,
  fieldId?: string,
): Promise<void> {
  // Check if capture is paused
  try {
    const { paused = false } = await chrome.storage.local.get("paused");
    if (paused) return;
  } catch (error) {
    // Extension context invalidated (extension was reloaded) - silently fail
    console.warn(
      "Extension context invalidated, cannot check paused state:",
      error,
    );
    return;
  }

  console.log("emit", type, data);

  const { ts_utc, ts_iso } = getTimestamps();

  // Build base event payload
  const basePayload = {
    ts_utc,
    ts_iso,
    url: location.href,
    title: document.title || null,
    type,
    data,
    session_id: SESSION_ID,
  };

  // For input events, add field_id
  const eventPayload =
    type === "input" && fieldId
      ? { ...basePayload, field_id: fieldId }
      : basePayload;

  // Type assertion is safe because overloads enforce correctness at call sites
  safePush(eventPayload as EventPayload);
}

export function cssPath(element: Element): string {
  if (element.id) return `#${element.id}`;
  const parts: string[] = [];
  for (
    let tempElement: Element | null = element;
    tempElement && parts.length < 5;
    tempElement = tempElement.parentElement
  ) {
    // Skip if tagName doesn't exist (shouldn't happen but safety check)
    if (!tempElement.tagName) continue;

    let s = tempElement.tagName.toLowerCase();
    if (tempElement.classList.length) {
      s += "." + [...tempElement.classList].slice(0, 2).join(".");
    }
    parts.unshift(s);
  }
  return parts.join(" > ");
}

export function maskInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
): string {
  const t = (element.type || "").toLowerCase();
  const val = element.value ?? "";
  const sensitive =
    /password|email|tel|number|search/i.test(t) ||
    element.autocomplete === "one-time-code";
  if (sensitive) return mask(val);
  return val.length > 64 ? val.slice(0, 61) + "..." : val;
}

function mask(s: string): string {
  if (!s) return "";
  const keep = Math.min(2, s.length);
  return s.slice(0, keep) + "*".repeat(Math.max(0, s.length - keep));
}
