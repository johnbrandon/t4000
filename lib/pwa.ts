import { Platform } from "react-native";

// expo-router's web.output is "single" (pure client-side SPA), so there is
// no static HTML pass to hook into for <head> tags — wire up the manifest,
// iOS PWA meta, and the service worker at runtime instead.
export function registerPwa() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;

  addHeadTag("link", { rel: "manifest", href: "/manifest.json" });
  addHeadTag("link", { rel: "apple-touch-icon", href: "/icon-512.png" });
  addHeadTag("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
  addHeadTag("meta", { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" });
  addHeadTag("meta", { name: "apple-mobile-web-app-title", content: "Check In" });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
}

function addHeadTag(tag: "link" | "meta", attrs: Record<string, string>) {
  const selector = Object.entries(attrs)
    .map(([key, value]) => `[${key}="${value}"]`)
    .join("");
  if (document.head.querySelector(`${tag}${selector}`)) return;

  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  document.head.appendChild(el);
}
