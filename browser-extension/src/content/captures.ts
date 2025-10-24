import { emit, cssPath } from "./utils";

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

// DFS helper to search for input value in node tree
function deepSearchForInputValue(
  node: Element | ShadowRoot,
  depth = 0,
): string | null {
  const MAX_DEPTH = 10; // Prevent infinite recursion
  if (depth > MAX_DEPTH) return null;

  // If this is an Element, perform direct checks
  if (node instanceof Element) {
    // 1. Native input/textarea - get value directly
    if (
      node instanceof HTMLInputElement ||
      node instanceof HTMLTextAreaElement
    ) {
      if (node.value) return node.value;
    }

    // 2. Check element's .value property (for custom elements)
    if (node instanceof HTMLElement) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const nodeAny = node as any;
      if (typeof nodeAny.value === "string" && nodeAny.value) {
        return nodeAny.value;
      }
      /* eslint-enable @typescript-eslint/no-explicit-any */

      // 3. Check value-related attributes
      const valueAttr =
        node.getAttribute("value") ||
        node.getAttribute("data-value") ||
        node.getAttribute("initial-query");
      if (valueAttr) return valueAttr;

      // 4. Check contenteditable
      if (node.isContentEditable && node.textContent?.trim()) {
        return node.textContent.trim();
      }
    }
  }

  // 6. Recursively search shadow DOM
  if (node instanceof Element && node.shadowRoot) {
    const shadowResult = deepSearchForInputValue(node.shadowRoot, depth + 1);
    if (shadowResult) return shadowResult;
  }

  // 7. Recursively search children (both Element and ShadowRoot have children)
  const children =
    node instanceof ShadowRoot ? node.children : node.children || [];
  for (const child of Array.from(children)) {
    const childResult = deepSearchForInputValue(child, depth + 1);
    if (childResult) return childResult;
  }

  return null;
}

// Helper function to extract input value from various sources
function extractInputValue(target: EventTarget | null): string | null {
  if (!target) return null;
  if (!(target instanceof Element)) return null;

  return deepSearchForInputValue(target, 0);
}

// inputs (unmasked)
export function registerInputs() {
  addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (!target || !(target instanceof Element)) return;

      console.log(target);

      // Extract value using comprehensive strategy
      const value = extractInputValue(target);
      if (value === null) return; // Skip if we couldn't extract a value

      const selector = cssPath(target);

      // Pass selector as field_id for deduplication
      emit("input", { selector, value }, selector);
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
        value: target.value ?? "",
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
