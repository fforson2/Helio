"use client";

import { useEffect } from "react";
import { usePropertyStore } from "@/lib/store";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { searchListings } from "@/lib/search-client";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    properties,
    setSearchResults,
    setSearching,
    setSearchError,
  } = usePropertyStore();

  useEffect(() => {
    if (properties.length > 0) return;

    let cancelled = false;
    const filters = {};
    const query = "California homes";
    const summary = "Active California listings";

    setSearching(true);
    searchListings({
      query,
      summary,
      filters,
    })
      .then((response) => {
        if (cancelled) return;
        setSearchResults({
          properties: response.properties,
          session: response.session,
          query,
          filters,
          summary,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSearchError("Could not load California listings.");
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [properties.length, setSearchError, setSearchResults, setSearching]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <DashboardNav />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
