import { emit, cssPath, maskInputValue } from "./utils";

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

// inputs (masked) - capture on blur
export function registerInputs() {
  addEventListener(
    "blur",
    (e) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (!target) return;

      const selector = cssPath(target);
      const value = maskInputValue(target);

      emit("input", { selector, value });
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
