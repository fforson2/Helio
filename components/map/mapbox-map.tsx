"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { Property } from "@/types/property";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MapboxMapProps {
  properties: Property[];
  selectedId: string | null;
  onSelectProperty: (id: string | null) => void;
}

type MarkerEntry = {
  marker: any;
  el: HTMLDivElement;
  click: (e: MouseEvent) => void;
};

type MapViewMode = "2d" | "3d";

function isValidMapboxToken(token: string | undefined) {
  const value = (token ?? "").trim();
  if (!value) return false;
  if (value.includes("your_mapbox_token_here")) return false;
  return value.startsWith("pk.") || value.startsWith("sk.");
}

function ensure3DLayers(map: any) {
  if (!map.getSource("mapbox-dem")) {
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });
  }

  if (!map.getLayer("sky")) {
    map.addLayer({
      id: "sky",
      type: "sky",
      paint: {
        "sky-type": "atmosphere",
        "sky-atmosphere-sun": [0, 0],
        "sky-atmosphere-sun-intensity": 10,
      },
    });
  }

  if (!map.getLayer("3d-buildings")) {
    const style = map.getStyle();
    const layers = style?.layers ?? [];
    const hasBuilding = layers.some(
      (layer: { source?: string; [key: string]: unknown }) =>
        layer.source === "composite" && layer["source-layer"] === "building"
    );

    if (hasBuilding) {
      const labelLayerId = layers.find(
        (layer: { type?: string; layout?: { "text-field"?: unknown }; id?: string }) =>
          layer.type === "symbol" && layer.layout?.["text-field"]
      )?.id;

      map.addLayer(
        {
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 13,
          paint: {
            "fill-extrusion-color": "oklch(0.22 0 0)",
            "fill-extrusion-opacity": 0.85,
            "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 13.5, ["get", "height"]],
            "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 13, 0, 13.5, ["get", "min_height"]],
          },
        },
        labelLayerId
      );
    }
  }
}

function setMarkerAppearance(el: HTMLDivElement, property: Property, isSelected: boolean) {
  const score = property.dealScore?.total ?? 50;
  const colorClass =
    score >= 80 ? "property-marker--green" : score >= 65 ? "property-marker--blue" : "property-marker--muted";

  el.className = `property-marker ${colorClass} ${isSelected ? "property-marker--selected" : ""}`;
  el.textContent = formatPrice(property.price);
  el.dataset.selected = isSelected ? "true" : "false";
  el.dataset.color = colorClass;
}

function showMapPlaceholder(el: HTMLDivElement, message: string, propertiesCount: number) {
  el.innerHTML = `
    <div style="width:100%;height:100%;background:oklch(0.10 0 0);display:flex;flex-direction:column;align-items:center;justify-content:center;color:oklch(0.60 0 0);gap:8px;font-family:ui-sans-serif,system-ui,sans-serif;">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
      <div style="font-size:14px;font-weight:600;color:oklch(0.80 0 0)">Map Preview</div>
      <div style="font-size:12px;text-align:center;max-width:220px;line-height:1.5">${message}</div>
      <div style="margin-top:16px;font-size:11px;color:oklch(0.50 0 0)">${propertiesCount} properties loaded</div>
    </div>
  `;
}

export function MapboxMap({ properties, selectedId, onSelectProperty }: MapboxMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const [viewMode, setViewMode] = useState<MapViewMode>("3d");
  const hasToken = useMemo(() => isValidMapboxToken(process.env.NEXT_PUBLIC_MAPBOX_TOKEN), []);

  const updateMarkers = useCallback(async () => {
    if (!mapRef.current) return;
    const mapboxgl = await import("mapbox-gl");
    const map = mapRef.current;
    const existingIds = new Set(markersRef.current.keys());

    properties.forEach((property) => {
      existingIds.delete(property.id);
      const isSelected = property.id === selectedId;
      const existing = markersRef.current.get(property.id);

      if (existing) {
        existing.marker.setLngLat([property.location.lng, property.location.lat]);
        setMarkerAppearance(existing.el, property, isSelected);
        return;
      }

      const markerEl = document.createElement("div");
      setMarkerAppearance(markerEl, property, isSelected);

      const click = (e: MouseEvent) => {
        e.stopPropagation();
        onSelectProperty(property.id === selectedId ? null : property.id);
      };

      markerEl.addEventListener("click", click);
      const marker = new mapboxgl.Marker({ element: markerEl, anchor: "bottom" })
        .setLngLat([property.location.lng, property.location.lat])
        .addTo(map);

      markersRef.current.set(property.id, { marker, el: markerEl, click });
    });

    existingIds.forEach((id) => {
      const entry = markersRef.current.get(id);
      if (!entry) return;
      entry.el.removeEventListener("click", entry.click);
      entry.marker.remove();
      markersRef.current.delete(id);
    });
  }, [onSelectProperty, properties, selectedId]);

  const fitToProperties = useCallback(async () => {
    if (!mapRef.current || selectedId || properties.length === 0) return;
    const mapboxgl = await import("mapbox-gl");
    const map = mapRef.current;

    if (properties.length === 1) {
      map.flyTo({
        center: [properties[0].location.lng, properties[0].location.lat],
        zoom: 14,
        speed: 1.1,
      });
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();
    for (const property of properties) {
      bounds.extend([property.location.lng, property.location.lat]);
    }
    map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 600 });
  }, [properties, selectedId]);

  const applyViewMode = useCallback(
    (mode: MapViewMode) => {
      if (!mapRef.current) return;
      const map = mapRef.current;

      if (mode === "2d") {
        map.easeTo({ pitch: 0, bearing: 0, duration: 550 });
        try {
          map.setTerrain(null);
        } catch {}
        if (map.getLayer("3d-buildings")) map.setLayoutProperty("3d-buildings", "visibility", "none");
        if (map.getLayer("sky")) map.setLayoutProperty("sky", "visibility", "none");
        try {
          map.dragRotate.disable();
          map.touchZoomRotate.disableRotation();
        } catch {}
        return;
      }

      map.easeTo({ pitch: 55, bearing: -15, duration: 650 });
      try {
        ensure3DLayers(map);
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.2 });
        if (map.getLayer("3d-buildings")) map.setLayoutProperty("3d-buildings", "visibility", "visible");
        if (map.getLayer("sky")) map.setLayoutProperty("sky", "visibility", "visible");
      } catch {}
      try {
        map.dragRotate.enable();
        map.touchZoomRotate.enableRotation();
      } catch {}
    },
    []
  );

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!isValidMapboxToken(token)) {
      showMapPlaceholder(
        mapContainerRef.current,
        "Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local to enable live map",
        properties.length
      );
      return;
    }

    let cancelled = false;

    const existingCss = document.querySelector<HTMLLinkElement>('link[data-mapbox-gl="true"]');
    if (!existingCss) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.css";
      link.dataset.mapboxGl = "true";
      document.head.appendChild(link);
    }

    import("mapbox-gl")
      .then((mapboxgl) => {
        if (cancelled || !mapContainerRef.current) return;
        mapboxgl.default.accessToken = token!.trim();

        const map = new mapboxgl.default.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox/dark-v11",
          center: [-118.35, 34.05],
          zoom: 10.5,
          pitch: viewMode === "3d" ? 55 : 0,
          bearing: viewMode === "3d" ? -15 : 0,
          antialias: true,
        });

        map.addControl(new mapboxgl.default.NavigationControl(), "top-right");
        map.addControl(new mapboxgl.default.ScaleControl(), "bottom-left");

        mapRef.current = map;
        map.on("load", async () => {
          if (viewMode === "3d") {
            try {
              ensure3DLayers(map);
              map.setTerrain({ source: "mapbox-dem", exaggeration: 1.2 });
            } catch {}
          }

          await updateMarkers();
          await fitToProperties();
        });

        map.on("click", () => onSelectProperty(null));
      })
      .catch(() => {
        if (!cancelled && mapContainerRef.current) {
          showMapPlaceholder(
            mapContainerRef.current,
            "Mapbox could not be loaded. Check the API token and enabled APIs.",
            properties.length
          );
        }
      });

    return () => {
      cancelled = true;
      markersRef.current.forEach((entry) => {
        entry.el.removeEventListener("click", entry.click);
        entry.marker.remove();
      });
      markersRef.current.clear();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void updateMarkers();
  }, [updateMarkers]);

  useEffect(() => {
    void fitToProperties();
  }, [fitToProperties]);

  useEffect(() => {
    applyViewMode(viewMode);
  }, [applyViewMode, viewMode]);

  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const property = properties.find((entry) => entry.id === selectedId);
    if (!property) return;

    mapRef.current.flyTo({
      center: [property.location.lng, property.location.lat],
      zoom: 14,
      speed: 1.2,
    });
  }, [properties, selectedId]);

  return (
    <div className="w-full h-full relative" style={{ minHeight: 400 }}>
      <div ref={mapContainerRef} className="absolute inset-0" />

      {hasToken && (
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
