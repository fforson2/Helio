"use client";

import { useUIStore } from "@/lib/store";
import { MapSearchView } from "@/components/map/map-search-view";
import { CompareView } from "@/components/compare/compare-view";
import { AssistantView } from "@/components/assistant/assistant-view";
import { ReportsView } from "@/components/reports/reports-view";
import { SavedView } from "@/components/property/saved-view";

export default function DashboardPage() {
  const { activeTab } = useUIStore();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {activeTab === "map" && <MapSearchView />}
      {activeTab === "list" && <MapSearchView listOnly />}
      {activeTab === "compare" && <CompareView />}
      {activeTab === "assistant" && <AssistantView />}
      {activeTab === "reports" && <ReportsView />}
      {activeTab === "saved" && <SavedView />}
    </div>
  );
}
