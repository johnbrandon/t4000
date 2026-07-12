import { Platform } from "react-native";

// When hosted under a sub-path (e.g. GitHub Pages at /t4000/), the CI build
// sets EXPO_PUBLIC_BASE_URL so these absolute asset URLs resolve correctly.
// Locally / at a domain root it is unset, leaving paths anchored at "/".
const BASE = (process.env.EXPO_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
const withBase = (path: string) => `${BASE}${path}`;

// expo-router's web.output is "single" (pure client-side SPA), so there is
// no static HTML pass to hook into for <head> tags — wire up the manifest,
// iOS PWA meta, and the service worker at runtime instead.
export function registerPwa() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;

  addHeadTag("link", { rel: "manifest", href: withBase("/manifest.json") });
  addHeadTag("link", { rel: "apple-touch-icon", href: withBase("/icon-512.png") });
  addHeadTag("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
  addHeadTag("meta", { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" });
  addHeadTag("meta", { name: "apple-mobile-web-app-title", content: "Check In" });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(withBase("/sw.js")).catch(() => {});
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
