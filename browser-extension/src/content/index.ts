import { scheduleFlush } from "./buffer";
import {
  registerNavigation,
  registerClicks,
  registerInputs,
  registerFocus,
  registerVisibleText,
} from "./captures";

console.log("Loading content script...");

// boot
registerNavigation();
registerClicks();
registerInputs();
registerFocus();
registerVisibleText();
scheduleFlush();

console.log("Content script loaded!");
