import { PORT_NAME } from "./config";

let port: chrome.runtime.Port | null = null;

export function getPort(): chrome.runtime.Port {
  if (port) return port;
  port = chrome.runtime.connect(undefined, { name: PORT_NAME });
  port.onDisconnect.addListener(() => {
    port = null;
    setTimeout(() => {
      if (!port)
        try {
          port = chrome.runtime.connect(undefined, { name: PORT_NAME });
        } catch {
          console.log("connection failed.");
        }
    }, 1000);
  });
  return port;
}
