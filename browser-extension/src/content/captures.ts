import { emit, cssPath, maskInputValue } from "./utils";
import { INPUT_DEBOUNCE_MS } from "./config";

// navigation + SPA changes
export function registerNavigation() {
  let last = location.href;
  emit("navigate", { from: null, to: last });

  const _push = history.pushState;
  history.pushState = function (...args) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _push.apply(this, args as any);
    const to = location.href;
    if (to !== last) emit("navigate", { from: last, to });
    last = to;
  };

  addEventListener("popstate", () => {
    const to = location.href;
    emit("navigate", { from: last, to });
    last = to;
  });
}

// clicks
export function registerClicks() {
  addEventListener(
    "click",
    (e) => {
      const target = e.target as Element | null;
      if (!target) return;
      const selector = cssPath(target);
      const text = (target as HTMLElement).innerText?.slice(0, 120) ?? "";
      emit("click", { selector, text });
    },
    { capture: true },
  );
}

// inputs (masked) - hybrid approach with debouncing + blur
export function registerInputs() {
  // Track debounce timers and last captured values per element
  const debounceTimers = new WeakMap<Element, number>();
  const lastCaptured = new WeakMap<Element, string>();

  const captureInput = (
    target: HTMLInputElement | HTMLTextAreaElement,
    source: "debounce" | "blur",
  ) => {
    const selector = cssPath(target);
    const value = maskInputValue(target);

    // Deduplication: only emit if value changed since last capture
    if (lastCaptured.get(target) === value) return;

    lastCaptured.set(target, value);
    emit("input", { selector, value, source });
  };

  // Debounced input handler
  addEventListener(
    "input",
    (e) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (!target) return;

      // Clear existing timer
      const existingTimer = debounceTimers.get(target);
      if (existingTimer) clearTimeout(existingTimer);

      // Set new timer
      const timer = window.setTimeout(() => {
        captureInput(target, "debounce");
      }, INPUT_DEBOUNCE_MS);

      debounceTimers.set(target, timer);
    },
    { capture: true },
  );

  // Blur handler for immediate capture when user leaves field
  addEventListener(
    "blur",
    (e) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (!target) return;

      // Clear pending debounce timer
      const existingTimer = debounceTimers.get(target);
      if (existingTimer) {
        clearTimeout(existingTimer);
        debounceTimers.delete(target);
      }

      // Capture immediately on blur
      captureInput(target, "blur");
    },
    { capture: true },
  );
}

// focus/blur
export function registerFocus() {
  addEventListener(
    "focus",
    (e) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (!target) return;
      emit("focus", {
        selector: cssPath(target),
        value: maskInputValue(target),
      });
    },
    true,
  );
}

// visible text (light snapshot)
export function registerVisibleText() {
  const snap = () => {
    const text = document.body?.innerText ?? "";
    if (text.trim()) emit("visible_text", { text });
  };
  addEventListener("DOMContentLoaded", snap);
}
