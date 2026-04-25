"use client";

import { useEffect } from "react";
import { usePropertyStore, useUserStore } from "@/lib/store";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { preferencesToFilters, searchListings } from "@/lib/search-client";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = useUserStore();
  const {
    properties,
    setSearchResults,
    setSearching,
    setSearchError,
  } = usePropertyStore();

  useEffect(() => {
    if (properties.length > 0) return;

    let cancelled = false;
    const filters = preferencesToFilters(profile?.preferences);
    const query = profile?.preferences?.targetNeighborhoods?.length
      ? `Homes matching ${profile.preferences.targetNeighborhoods.join(", ")}`
      : "All available homes";

    setSearching(true);
    searchListings({
      query,
      summary: query,
      filters,
    })
      .then((response) => {
        if (cancelled) return;
        setSearchResults({
          properties: response.properties,
          session: response.session,
          query,
          filters,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSearchError("Could not load the property search session.");
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profile, properties.length, setSearchError, setSearchResults, setSearching]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DashboardNav />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
