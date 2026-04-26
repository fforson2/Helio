"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { LngLatBoundsLike, Map as MapboxMapInstance, Marker } from "mapbox-gl";
import { Property } from "@/types/property";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

import "mapbox-gl/dist/mapbox-gl.css";

interface MapboxMapProps {
  properties: Property[];
  selectedId: string | null;
  onSelectProperty: (id: string | null) => void;
}

type MapViewMode = "2d" | "3d";

const DEFAULT_CENTER: [number, number] = [-119.4179, 36.7783];
const DEFAULT_ZOOM = 5.5;
const MIN_3D_ZOOM = 15.5;

const STYLE_2D = "mapbox://styles/mapbox/dark-v11";
const STYLE_3D = "mapbox://styles/mapbox/standard";

function isValidPublicToken(token: string | undefined): token is string {
  const value = (token ?? "").trim();
  if (!value) return false;
  if (value.includes("your_mapbox_token_here")) return false;
  return value.startsWith("pk.");
}

function buildMarkerEl(property: Property, isSelected: boolean): HTMLDivElement {
  const score = property.dealScore?.total ?? 50;
  const colorClass =
    score >= 80
      ? "map-price-marker--green"
      : score >= 65
        ? "map-price-marker--blue"
        : "map-price-marker--muted";

  const el = document.createElement("div");
  el.className = `map-price-marker ${colorClass}${isSelected ? " map-price-marker--selected" : ""}`;
  el.innerHTML = `<span class="map-price-marker__label">${formatPrice(property.price)}</span><span class="map-price-marker__pin" />`;
  el.dataset.color = colorClass;
  el.dataset.selected = isSelected ? "true" : "false";
  return el;
}

function applyMarkerSelection(el: HTMLElement, property: Property, isSelected: boolean) {
  const score = property.dealScore?.total ?? 50;
  const colorClass =
    score >= 80
      ? "map-price-marker--green"
      : score >= 65
        ? "map-price-marker--blue"
        : "map-price-marker--muted";

  el.className = `map-price-marker ${colorClass}${isSelected ? " map-price-marker--selected" : ""}`;
  el.dataset.selected = isSelected ? "true" : "false";
}

function showPlaceholder(el: HTMLDivElement, message: string, count: number) {
  el.innerHTML = `
    <div style="width:100%;height:100%;background:oklch(0.10 0 0);display:flex;flex-direction:column;align-items:center;justify-content:center;color:oklch(0.60 0 0);gap:8px;font-family:ui-sans-serif,system-ui,sans-serif;padding:24px;">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
      <div style="font-size:14px;font-weight:600;color:oklch(0.80 0 0)">Map Preview</div>
      <div style="font-size:12px;text-align:center;max-width:320px;line-height:1.5">${message}</div>
      <div style="margin-top:16px;font-size:11px;color:oklch(0.50 0 0)">${count} properties loaded</div>
    </div>
  `;
}

function add3DBuildings(map: MapboxMapInstance) {
  if (!map.isStyleLoaded()) return;
  if (map.getLayer("3d-buildings")) return;

  const layers = map.getStyle()?.layers ?? [];
  const labelLayerId = layers.find(
    (layer) => layer.type === "symbol" && (layer as { layout?: { "text-field"?: unknown } }).layout?.["text-field"]
  )?.id;

  const composite = map.getSource("composite");
  if (!composite) return;

  try {
    map.addLayer(
      {
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": "#3884ff",
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            0,
            16,
            ["get", "height"],
          ],
          "fill-extrusion-base": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            0,
            16,
            ["get", "min_height"],
          ],
          "fill-extrusion-opacity": 0.55,
        },
      },
      labelLayerId
    );
  } catch {
    /* style may not include the composite source on the new Standard style — that's fine, it ships its own buildings */
  }
}

export function MapboxMap({ properties, selectedId, onSelectProperty }: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMapInstance | null>(null);
  const styleModeRef = useRef<MapViewMode>("2d");
  const markersRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const resizeFrameRef = useRef<number | null>(null);
  const resizeTimeoutRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelectProperty);
  const [viewMode, setViewMode] = useState<MapViewMode>("2d");
  const [styleReady, setStyleReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelectProperty;
  }, [onSelectProperty]);

  const token = useMemo(() => {
    const candidate = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    return isValidPublicToken(candidate) ? candidate : null;
  }, []);

  const flyToProperty = useCallback(
    (property: Property, options?: { close?: boolean }) => {
      const map = mapRef.current;
      if (!map) return;

      map.flyTo({
        center: [property.location.lng, property.location.lat],
        zoom: Math.max(map.getZoom(), options?.close ? 17 : 15),
        pitch: viewMode === "3d" ? 64 : 0,
        bearing: viewMode === "3d" ? -20 : 0,
        duration: 850,
        essential: true,
      });
    },
    [viewMode]
  );

  const updateMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const stale = new Set(markersRef.current.keys());

    properties.forEach((property) => {
      stale.delete(property.id);
      const isSelected = property.id === selectedId;

      const existing = markersRef.current.get(property.id);
      if (existing) {
        applyMarkerSelection(existing.getElement(), property, isSelected);
        return;
      }

      const el = buildMarkerEl(property, isSelected);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current(property.id);
        flyToProperty(property, { close: true });
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([property.location.lng, property.location.lat])
        .addTo(map);

      markersRef.current.set(property.id, marker);
    });

    stale.forEach((id) => {
      const marker = markersRef.current.get(id);
      if (!marker) return;
      marker.remove();
      markersRef.current.delete(id);
    });
  }, [flyToProperty, properties, selectedId]);

  const fitToProperties = useCallback(() => {
    const map = mapRef.current;
    if (!map || selectedId || properties.length === 0) return;

    if (properties.length === 1) {
      const only = properties[0];
      map.easeTo({
        center: [only.location.lng, only.location.lat],
        zoom: 14,
        duration: 700,
      });
      return;
    }

    const lngs = properties.map((p) => p.location.lng);
    const lats = properties.map((p) => p.location.lat);
    const bounds: LngLatBoundsLike = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];

    map.fitBounds(bounds, { padding: 80, duration: 700, maxZoom: 13 });
  }, [properties, selectedId]);

  const applyViewMode = useCallback(
    (mode: MapViewMode) => {
      const map = mapRef.current;
      if (!map) return;

      if (mode === "2d") {
        map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
        return;
      }

      const zoom = map.getZoom();
      map.easeTo({
        pitch: 60,
        bearing: -17,
        zoom: zoom < MIN_3D_ZOOM ? MIN_3D_ZOOM : zoom,
        duration: 800,
      });
    },
    []
  );

  const clearPendingResize = useCallback(() => {
    if (resizeFrameRef.current !== null) {
      cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = null;
    }

    if (resizeTimeoutRef.current !== null) {
      window.clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = null;
    }
  }, []);

  const scheduleResize = useCallback(
    (map: MapboxMapInstance) => {
      clearPendingResize();

      const safeResize = () => {
        if (mapRef.current !== map) return;

        try {
          const container = map.getContainer();
          if (!container?.isConnected) return;
          map.resize();
        } catch {
          /* ignore resize calls that race with Mapbox teardown */
        }
      };

      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        safeResize();
      });

      resizeTimeoutRef.current = window.setTimeout(() => {
        resizeTimeoutRef.current = null;
        safeResize();
      }, 120);
    },
    [clearPendingResize]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    if (!token) {
      showPlaceholder(
        containerRef.current,
        "Add a Mapbox public token (pk.eyJ...) to NEXT_PUBLIC_MAPBOX_TOKEN in .env.local. Get one at account.mapbox.com → Tokens. Secret tokens (sk.) cannot be used in the browser.",
        properties.length
      );
      return;
    }

    mapboxgl.accessToken = token;

    const styleForMode = viewMode === "3d" ? STYLE_3D : STYLE_2D;

    let map: MapboxMapInstance;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: styleForMode,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: viewMode === "3d" ? 60 : 0,
        bearing: viewMode === "3d" ? -17 : 0,
        attributionControl: false,
        antialias: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      showPlaceholder(
        containerRef.current,
        `Mapbox could not initialize: ${message}`,
        properties.length
      );
      return;
    }

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    scheduleResize(map);

    map.on("style.load", () => {
      styleModeRef.current = viewMode;
      add3DBuildings(map);
      scheduleResize(map);
      setStyleReady(true);
    });

    map.on("click", (e) => {
      const target = e.originalEvent.target as HTMLElement | null;
      if (target?.closest(".map-price-marker")) return;
      onSelectRef.current(null);
    });

    const resizeObserver = new ResizeObserver(() => {
      scheduleResize(map);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      clearPendingResize();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      setStyleReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearPendingResize, scheduleResize, token, viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !token) return;

    const targetStyle = viewMode === "3d" ? STYLE_3D : STYLE_2D;
    let cancelled = false;

    const syncViewMode = () => {
      if (cancelled) return;

      const needsStyleSwap = styleModeRef.current !== viewMode;
      setStyleReady(false);

      if (needsStyleSwap) {
        const onStyleLoad = () => {
          if (cancelled) return;
          styleModeRef.current = viewMode;
          add3DBuildings(map);
          applyViewMode(viewMode);
          updateMarkers();
          scheduleResize(map);
          setStyleReady(true);
        };

        map.once("style.load", onStyleLoad);
        map.setStyle(targetStyle);
        return;
      }

      if (!map.isStyleLoaded()) {
        map.once("style.load", syncViewMode);
        return;
      }

      add3DBuildings(map);
      applyViewMode(viewMode);
      scheduleResize(map);
      setStyleReady(true);
    };

    syncViewMode();

    return () => {
      cancelled = true;
      map.off("style.load", syncViewMode);
    };
  }, [viewMode, token, applyViewMode, scheduleResize, updateMarkers]);

  useEffect(() => {
    if (!styleReady) return;
    updateMarkers();
  }, [updateMarkers, styleReady]);

  useEffect(() => {
    if (!styleReady) return;
    fitToProperties();
  }, [fitToProperties, styleReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const property = properties.find((p) => p.id === selectedId);
    if (!property) return;

    flyToProperty(property, { close: true });
  }, [flyToProperty, properties, selectedId]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <div ref={containerRef} className="absolute inset-0" />

      {token && (
        <div className="absolute top-3 left-3 z-10">
          <div className="bg-card/80 backdrop-blur-sm border border-border rounded-lg p-1 flex items-center gap-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode("2d")}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-semibold transition-colors",
                viewMode === "2d"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              2D
            </button>
            <button
              type="button"
              onClick={() => setViewMode("3d")}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-semibold transition-colors",
                viewMode === "3d"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              3D
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
