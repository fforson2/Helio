"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePropertyStore } from "@/lib/store";
import { AgentPropertySidebar } from "@/components/agent/agent-property-sidebar";
import { Tour3DView } from "@/components/tour/tour-3d-view";
import { cn } from "@/lib/utils";
import { Box, ImageOff, Loader2 } from "lucide-react";

const FALLBACK_HERO =
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400&q=80";

const DEFAULT_DESCRIPTION =
  "Modern home with clean architectural lines, open floor plan, and abundant natural light throughout.";

export default function TourPage() {
  const searchParams = useSearchParams();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [descriptionLoading, setDescriptionLoading] = useState(false);
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);

  const properties = usePropertyStore((state) => state.properties);
  const propertyMap = usePropertyStore((state) => state.propertyMap);
  const globalSelectedPropertyId = usePropertyStore((state) => state.selectedPropertyId);
  const selectedProperty = selectedPropertyId
    ? propertyMap[selectedPropertyId] ??
      properties.find((p) => p.id === selectedPropertyId) ??
      null
    : null;

  // Only carry a selected property into Tour when the user explicitly
  // launched Tour from a listing action.
  useEffect(() => {
    if (selectedPropertyId) return;
    if (searchParams.get("focus") !== "selected") return;
    if (globalSelectedPropertyId && propertyMap[globalSelectedPropertyId]) {
      setSelectedPropertyId(globalSelectedPropertyId);
      return;
    }
    if (globalSelectedPropertyId && properties.some((property) => property.id === globalSelectedPropertyId)) {
      setSelectedPropertyId(globalSelectedPropertyId);
      return;
    }
  }, [globalSelectedPropertyId, properties, propertyMap, searchParams, selectedPropertyId]);

  const photos = useMemo(() => {
    if (!selectedProperty) return [FALLBACK_HERO];
    return selectedProperty.photos.length > 0
      ? selectedProperty.photos
      : [FALLBACK_HERO];
  }, [selectedProperty]);

  const addressLine = selectedProperty
    ? `${selectedProperty.location.address} · ${selectedProperty.location.city}, ${selectedProperty.location.state}`
    : "Select a listing to explore";

  const propertyStats = useMemo(() => {
    if (!selectedProperty) return undefined;
    return {
      price: selectedProperty.price,
      beds: selectedProperty.details.beds,
      baths: selectedProperty.details.baths,
      sqft: selectedProperty.details.sqft,
      yearBuilt: selectedProperty.details.yearBuilt,
      propertyType: selectedProperty.details.propertyType,
      pool: selectedProperty.details.pool ?? false,
      garage: selectedProperty.details.garage ?? false,
      basement: selectedProperty.details.basement ?? false,
      stories: selectedProperty.details.stories ?? 1,
    };
  }, [selectedProperty]);

  // Fetch AI description from listing data
  useEffect(() => {
    if (!selectedPropertyId) {
      setDescription(DEFAULT_DESCRIPTION);
      return;
    }
    setDescriptionLoading(true);
    fetch(`/api/tour/description?propertyId=${encodeURIComponent(selectedPropertyId)}`)
      .then((r) => r.json())
      .then((data: { description?: string }) => {
        if (data.description) setDescription(data.description);
        else if (selectedProperty) {
          setDescription(
            `${selectedProperty.location.address}, ${selectedProperty.details.beds} bed, ` +
              `${selectedProperty.details.baths} bath, ${selectedProperty.details.sqft} sqft home.`
          );
        }
      })
      .catch(() => {
        if (selectedProperty) {
          setDescription(`${selectedProperty.location.address}, ${selectedProperty.location.city}.`);
        }
      })
      .finally(() => setDescriptionLoading(false));
  }, [selectedPropertyId, selectedProperty]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 flex overflow-hidden">
      <AgentPropertySidebar
        onSelectProperty={setSelectedPropertyId}
        selectedPropertyId={selectedPropertyId}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Property header */}
        {selectedProperty && (
          <div className="shrink-0 border-b border-border/60 bg-card/20 px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {selectedProperty.location.address}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {selectedProperty.location.city}, {selectedProperty.location.state} ·{" "}
                {selectedProperty.details.beds}bd / {selectedProperty.details.baths}ba ·{" "}
                {selectedProperty.details.sqft.toLocaleString()} sqft
              </p>
            </div>
            {descriptionLoading && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading description…
              </div>
            )}
          </div>
        )}

        <div className="flex-1 p-4 min-h-0 flex flex-col">
          {!selectedProperty ? (
            <div
              className={cn(
                "flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-card/20 p-8 text-center"
              )}
            >
              <ImageOff className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground max-w-sm">
                {properties.length === 0
                  ? "Loading properties for the Tour…"
                  : "Choose a property on the left to start a 3D cinematic tour through the listing."}
              </p>
            </div>
          ) : (
            <Tour3DView
              key={selectedPropertyId ?? "none"}
              photos={photos}
              addressLine={addressLine}
              description={description}
              propertyStats={propertyStats}
            />
          )}
        </div>

        {/* Status bar */}
        <div className="h-8 border-t border-border flex items-center px-4 gap-4 bg-card/20 shrink-0 text-[10px]">
          <div className="flex items-center gap-1.5">
            <Box className="w-2.5 h-2.5 text-primary" />
            <span className="text-muted-foreground/70">Three.js 3D Tour</span>
          </div>
          <span className="text-muted-foreground/40">
            Interior walkthrough · Spacebar to play/pause
          </span>
          <div className="flex-1" />
        </div>
      </div>
    </div>
  );
}
