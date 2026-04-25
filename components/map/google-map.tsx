"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { Property } from "@/types/property";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

interface GoogleMapProps {
  properties: Property[];
  selectedId: string | null;
  onSelectProperty: (id: string | null) => void;
}

type GoogleMapsNamespace = typeof google.maps;

type MarkerOverlay = google.maps.OverlayView & {
  setSelected: (selected: boolean) => void;
  destroy: () => void;
};

type MarkerEntry = {
  overlay: MarkerOverlay;
};

type MapViewMode = "2d" | "3d";

const SCRIPT_ID = "google-maps-js-loader";
const DEFAULT_CENTER = { lat: 34.05, lng: -118.35 } as const;
const DEFAULT_ZOOM = 10.5;
const VECTOR_3D_ZOOM = 17;
const RASTER_3D_ZOOM = 18;

let googleMapsPromise: Promise<GoogleMapsNamespace> | null = null;

declare global {
  interface Window {
    google?: typeof google;
  }
}

function isValidGoogleMapsKey(key: string | undefined): key is string {
  const value = (key ?? "").trim();
  if (!value) return false;
  if (value.includes("your_google_maps_key_here")) return false;
  return value.length > 12;
}

function isValidMapId(id: string | undefined): id is string {
  const value = (id ?? "").trim();
  if (!value) return false;
  if (value.includes("your_google_maps_map_id_here")) return false;
  return value.length >= 4;
}

function ensureGoogleMaps(apiKey: string): Promise<GoogleMapsNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps requires a browser environment"));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const onReady = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error("Google Maps script loaded without exposing google.maps"));
      }
    };

    if (existing) {
      existing.addEventListener("load", onReady, { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=marker&loading=async`;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", onReady, { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load Google Maps")), {
      once: true,
    });
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0a0a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7a7a7a" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a2a2a" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#a8a8a8" }],
  },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6a6a6a" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#173622" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#5a8a6a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a1a1a" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a3a3a" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#c8c8c8" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#222222" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#9a9a9a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1f2d" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3a6a8a" }] },
];

function setMarkerAppearance(el: HTMLDivElement, property: Property, isSelected: boolean) {
  const score = property.dealScore?.total ?? 50;
  const colorClass =
    score >= 80 ? "property-marker--green" : score >= 65 ? "property-marker--blue" : "property-marker--muted";

  el.className = `property-marker ${colorClass} ${isSelected ? "property-marker--selected" : ""}`;
  el.textContent = formatPrice(property.price);
  el.dataset.selected = isSelected ? "true" : "false";
  el.dataset.color = colorClass;
}

function createMarkerOverlay(
  maps: GoogleMapsNamespace,
  map: google.maps.Map,
  property: Property,
  isSelected: boolean,
  onClick: () => void
): MarkerOverlay {
  const PriceMarker = class extends maps.OverlayView {
    private el: HTMLDivElement;
    private clickHandler: () => void;
    private position: google.maps.LatLngLiteral;
    private currentSelected: boolean;

    constructor() {
      super();
      this.position = { lat: property.location.lat, lng: property.location.lng };
      this.currentSelected = isSelected;
      this.el = document.createElement("div");
      setMarkerAppearance(this.el, property, isSelected);
      this.el.style.position = "absolute";
      this.el.style.transform = "translate(-50%, -100%)";

      this.clickHandler = () => onClick();
      this.el.addEventListener("click", this.clickHandler);
    }

    onAdd() {
      const panes = this.getPanes();
      panes?.overlayMouseTarget.appendChild(this.el);
    }

    draw() {
      const projection = this.getProjection();
      if (!projection) return;
      const point = projection.fromLatLngToDivPixel(new maps.LatLng(this.position));
      if (point) {
        this.el.style.left = `${point.x}px`;
        this.el.style.top = `${point.y - 4}px`;
      }
    }

    onRemove() {
      this.el.removeEventListener("click", this.clickHandler);
      this.el.parentNode?.removeChild(this.el);
    }

    setSelected(selected: boolean) {
      if (this.currentSelected === selected) return;
      this.currentSelected = selected;
      setMarkerAppearance(this.el, property, selected);
    }

    destroy() {
      this.setMap(null);
    }
  };

  const overlay = new PriceMarker() as unknown as MarkerOverlay;
  overlay.setMap(map);
  return overlay;
}

function showMapPlaceholder(el: HTMLDivElement, message: string, propertiesCount: number) {
  el.innerHTML = `
    <div style="width:100%;height:100%;background:oklch(0.10 0 0);display:flex;flex-direction:column;align-items:center;justify-content:center;color:oklch(0.60 0 0);gap:8px;font-family:ui-sans-serif,system-ui,sans-serif;">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
      <div style="font-size:14px;font-weight:600;color:oklch(0.80 0 0)">Map Preview</div>
      <div style="font-size:12px;text-align:center;max-width:240px;line-height:1.5">${message}</div>
      <div style="margin-top:16px;font-size:11px;color:oklch(0.50 0 0)">${propertiesCount} properties loaded</div>
    </div>
  `;
}

export function GoogleMap({ properties, selectedId, onSelectProperty }: GoogleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapsRef = useRef<GoogleMapsNamespace | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const [viewMode, setViewMode] = useState<MapViewMode>("2d");
  const hasKey = useMemo(
    () => isValidGoogleMapsKey(process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY),
    []
  );
  const mapId = useMemo(() => {
    const candidate = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
    return isValidMapId(candidate) ? candidate : null;
  }, []);
  const hasMapId = mapId !== null;

  const updateMarkers = useCallback(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps) return;

    const stale = new Set(markersRef.current.keys());
    properties.forEach((property) => {
      stale.delete(property.id);
      const isSelected = property.id === selectedId;
      const existing = markersRef.current.get(property.id);
      if (existing) {
        existing.overlay.setSelected(isSelected);
        return;
      }
      const overlay = createMarkerOverlay(maps, map, property, isSelected, () => {
        onSelectProperty(property.id === selectedId ? null : property.id);
      });
      markersRef.current.set(property.id, { overlay });
    });

    stale.forEach((id) => {
      const entry = markersRef.current.get(id);
      if (!entry) return;
      entry.overlay.destroy();
      markersRef.current.delete(id);
    });
  }, [onSelectProperty, properties, selectedId]);

  const fitToProperties = useCallback(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps || selectedId || properties.length === 0) return;

    if (properties.length === 1) {
      const only = properties[0];
      map.panTo({ lat: only.location.lat, lng: only.location.lng });
      map.setZoom(14);
      return;
    }

    const bounds = new maps.LatLngBounds();
    for (const property of properties) {
      bounds.extend({ lat: property.location.lat, lng: property.location.lng });
    }
    map.fitBounds(bounds, 80);
  }, [properties, selectedId]);

  const applyViewMode = useCallback(
    (mode: MapViewMode) => {
      const map = mapRef.current;
      if (!map) return;

      if (mode === "2d") {
        map.setTilt(0);
        map.setHeading(0);
        if (!hasMapId) {
          map.setMapTypeId("roadmap");
        }
        return;
      }

      const currentZoom = map.getZoom() ?? DEFAULT_ZOOM;

      if (hasMapId) {
        // Vector renderer supports tilt + heading and renders 3D buildings at high zoom.
        map.setTilt(67.5);
        map.setHeading(-15);
        if (currentZoom < VECTOR_3D_ZOOM) {
          map.setZoom(VECTOR_3D_ZOOM);
        }
        return;
      }

      // Raster fallback: tilt only works on satellite imagery at high zoom.
      map.setMapTypeId("hybrid");
      map.setTilt(45);
      map.setHeading(0);
      if (currentZoom < RASTER_3D_ZOOM) {
        map.setZoom(RASTER_3D_ZOOM);
      }
    },
    [hasMapId]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!isValidGoogleMapsKey(apiKey)) {
      showMapPlaceholder(
        containerRef.current,
        "Add NEXT_PUBLIC_GOOGLE_MAPS_KEY to .env.local to enable the live map",
        properties.length
      );
      return;
    }

    let cancelled = false;

    ensureGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapsRef.current = maps;

        const baseOptions: google.maps.MapOptions = {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          rotateControl: true,
          tilt: 0,
          heading: 0,
          disableDefaultUI: false,
          backgroundColor: "#1a1a1a",
          gestureHandling: "greedy",
        };

        // Vector renderer (mapId) supports tilt/heading + 3D buildings.
        // Raster renderer (no mapId) uses our dark style array but cannot tilt
        // unless we switch to satellite imagery — we handle that in applyViewMode.
        const options: google.maps.MapOptions = hasMapId
          ? { ...baseOptions, mapId: mapId ?? undefined }
          : { ...baseOptions, mapTypeId: "roadmap", styles: DARK_MAP_STYLES };

        const map = new maps.Map(containerRef.current, options);

        mapRef.current = map;

        map.addListener("click", () => onSelectProperty(null));

        updateMarkers();
        fitToProperties();
      })
      .catch(() => {
        if (cancelled || !containerRef.current) return;
        showMapPlaceholder(
          containerRef.current,
          "Google Maps could not be loaded. Check the API key and that the Maps JavaScript API is enabled.",
          properties.length
        );
      });

    return () => {
      cancelled = true;
      markersRef.current.forEach((entry) => entry.overlay.destroy());
      markersRef.current.clear();
      mapRef.current = null;
      mapsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    updateMarkers();
  }, [updateMarkers]);

  useEffect(() => {
    fitToProperties();
  }, [fitToProperties]);

  useEffect(() => {
    applyViewMode(viewMode);
  }, [applyViewMode, viewMode]);

  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const property = properties.find((entry) => entry.id === selectedId);
    if (!property) return;

    mapRef.current.panTo({ lat: property.location.lat, lng: property.location.lng });
    mapRef.current.setZoom(14);
  }, [properties, selectedId]);

  return (
    <div className="w-full h-full relative" style={{ minHeight: 400 }}>
      <div ref={containerRef} className="absolute inset-0" />

      {hasKey && (
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
