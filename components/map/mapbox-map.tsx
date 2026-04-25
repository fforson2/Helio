"use client";

import { useEffect, useRef, useCallback } from "react";
import { Property } from "@/types/property";
import { formatPrice } from "@/lib/format";
import { getDealScoreColor } from "@/lib/deal-score";

interface MapboxMapProps {
  properties: Property[];
  selectedId: string | null;
  onSelectProperty: (id: string | null) => void;
}

export function MapboxMap({
  properties,
  selectedId,
  onSelectProperty,
}: MapboxMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<Map<string, unknown>>(new Map());

  const updateMarkers = useCallback(() => {
    if (!mapRef.current) return;
    const mapboxgl = (window as unknown as { mapboxgl: typeof import("mapbox-gl") }).mapboxgl;
    if (!mapboxgl) return;

    const map = mapRef.current as import("mapbox-gl").Map;
    const existingIds = new Set(markersRef.current.keys());

    properties.forEach((property) => {
      existingIds.delete(property.id);
      const isSelected = property.id === selectedId;
      const score = property.dealScore?.total ?? 50;

      const markerEl = document.createElement("div");
      markerEl.className = "property-marker";
      markerEl.style.cssText = `
        background: ${isSelected ? "oklch(0.69 0.17 240)" : "oklch(0.12 0 0)"};
        color: ${isSelected ? "white" : score >= 80 ? "oklch(0.72 0.19 150)" : score >= 65 ? "oklch(0.69 0.17 240)" : "oklch(0.60 0 0)"};
        border: 2px solid ${isSelected ? "white" : score >= 80 ? "oklch(0.72 0.19 150)" : "oklch(0.22 0 0)"};
        border-radius: 8px;
        padding: 4px 8px;
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        transition: all 0.15s ease;
        font-family: ui-sans-serif, system-ui, sans-serif;
        z-index: ${isSelected ? 10 : 1};
        transform: ${isSelected ? "scale(1.1)" : "scale(1)"};
      `;
      markerEl.textContent = formatPrice(property.price);
      markerEl.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectProperty(
          property.id === selectedId ? null : property.id
        );
      });

      if (markersRef.current.has(property.id)) {
        const existing = markersRef.current.get(property.id) as import("mapbox-gl").Marker;
        existing.getElement().replaceWith(markerEl);
        const newMarker = new mapboxgl.Marker({ element: markerEl, anchor: "bottom" })
          .setLngLat([property.location.lng, property.location.lat])
          .addTo(map);
        existing.remove();
        markersRef.current.set(property.id, newMarker);
      } else {
        const marker = new mapboxgl.Marker({ element: markerEl, anchor: "bottom" })
          .setLngLat([property.location.lng, property.location.lat])
          .addTo(map);
        markersRef.current.set(property.id, marker);
      }
    });

    existingIds.forEach((id) => {
      const marker = markersRef.current.get(id) as import("mapbox-gl").Marker | undefined;
      marker?.remove();
      markersRef.current.delete(id);
    });
  }, [properties, selectedId, onSelectProperty]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (!token) {
      const el = mapContainerRef.current;
      el.innerHTML = `
        <div style="width:100%;height:100%;background:oklch(0.10 0 0);display:flex;flex-direction:column;align-items:center;justify-content:center;color:oklch(0.60 0 0);gap:8px;font-family:ui-sans-serif,system-ui,sans-serif;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
          <div style="font-size:14px;font-weight:600;color:oklch(0.80 0 0)">Map Preview</div>
          <div style="font-size:12px;text-align:center;max-width:220px;line-height:1.5">Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local to enable live map</div>
          <div style="margin-top:16px;font-size:11px;color:oklch(0.50 0 0)">${properties.length} properties loaded</div>
        </div>
      `;
      return;
    }

    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.js";
    script.async = true;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.css";
    document.head.appendChild(link);

    script.onload = () => {
      const mapboxgl = (window as unknown as { mapboxgl: typeof import("mapbox-gl") }).mapboxgl;
      (mapboxgl as unknown as { accessToken: string }).accessToken = token;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-118.35, 34.05],
        zoom: 10.5,
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      map.addControl(new mapboxgl.ScaleControl(), "bottom-left");

      mapRef.current = map;

      map.on("load", () => {
        updateMarkers();
      });

      map.on("click", () => {
        onSelectProperty(null);
      });
    };

    document.head.appendChild(script);

    return () => {
      markersRef.current.forEach((m) => (m as import("mapbox-gl").Marker).remove());
      markersRef.current.clear();
      if (mapRef.current) {
        (mapRef.current as import("mapbox-gl").Map).remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapRef.current) updateMarkers();
  }, [updateMarkers]);

  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const property = properties.find((p) => p.id === selectedId);
    if (!property) return;
    (mapRef.current as import("mapbox-gl").Map).flyTo({
      center: [property.location.lng, property.location.lat],
      zoom: 14,
      speed: 1.2,
    });
  }, [selectedId, properties]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full"
      style={{ minHeight: 400 }}
    />
  );
}
