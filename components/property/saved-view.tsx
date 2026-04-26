"use client";

import { resolvePropertiesById, usePropertyStore, useUIStore } from "@/lib/store";
import { Property } from "@/types/property";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { PropertyCard } from "@/components/property/property-card";
import { Bookmark, Map } from "lucide-react";

export function SavedView() {
  const { properties, propertyMap, savedProperties, selectProperty } = usePropertyStore();
  const { setActiveTab } = useUIStore();

  const saved = resolvePropertiesById(
    savedProperties.map((savedProperty) => savedProperty.propertyId),
    propertyMap,
    properties
  );

  if (saved.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
          <Bookmark className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">No saved properties yet</h2>
          <p className="text-muted-foreground max-w-sm">
            Bookmark properties as you browse to keep track of your shortlist.
          </p>
        </div>
        <Button onClick={() => setActiveTab("map")} variant="outline" className="gap-2">
          <Map className="w-4 h-4" /> Browse map
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border p-4 flex items-center gap-3">
        <Bookmark className="w-5 h-5 text-primary" />
        <div>
          <h2 className="font-semibold">Saved Properties</h2>
          <p className="text-xs text-muted-foreground">{saved.length} properties in your shortlist</p>
        </div>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {saved.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onClick={() => {
                selectProperty(property.id);
                setActiveTab("map");
              }}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
