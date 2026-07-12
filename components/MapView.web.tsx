import { useEffect, useRef } from "react";
import { View } from "react-native";
import type { MapPoint } from "../lib/mapPoints";
import { theme } from "../lib/theme";

declare global {
  interface Window {
    L?: any;
  }
}

// Load Leaflet from the CDN once and cache the promise. Leaflet isn't bundled
// because it manipulates the DOM directly and is only needed on web.
let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Map is only available in the browser."));
  }
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Failed to load the map library."));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

export default function MapView({ points }: { points: MapPoint[] }) {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current) return;

        if (!mapRef.current) {
          mapRef.current = L.map(containerRef.current);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "© OpenStreetMap contributors",
          }).addTo(mapRef.current);
        }
        const map = mapRef.current;

        // Remove previous markers before re-adding.
        map.eachLayer((layer: any) => {
          if (layer instanceof L.CircleMarker) map.removeLayer(layer);
        });

        const latlngs: [number, number][] = [];
        for (const p of points) {
          const marker = L.circleMarker([p.latitude, p.longitude], {
            radius: 7,
            color: "#0B0B0F",
            weight: 1.5,
            fillColor: p.color,
            fillOpacity: 0.9,
          }).addTo(map);
          marker.bindPopup(`<strong>${escapeHtml(p.title)}</strong><br/>${escapeHtml(p.subtitle)}`);
          latlngs.push([p.latitude, p.longitude]);
        }

        if (latlngs.length === 1) map.setView(latlngs[0], 12);
        else if (latlngs.length > 1) map.fitBounds(latlngs, { padding: [40, 40] });
        else map.setView([20, 0], 1);

        // The container may have been sized after init; recompute tiles.
        setTimeout(() => map.invalidateSize(), 120);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [points]);

  useEffect(
    () => () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    },
    []
  );

  return <View ref={containerRef} style={{ flex: 1, minHeight: 320, backgroundColor: theme.color.surfaceRaised }} />;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}
