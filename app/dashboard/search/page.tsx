"use client";

import { MapSearchView } from "@/components/map/map-search-view";

export default function SearchPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <MapSearchView listOnly />
    </div>
  );
}

