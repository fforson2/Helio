"use client";

import { useEffect } from "react";
import { usePropertyStore } from "@/lib/store";
import { DEMO_PROPERTIES } from "@/lib/demo-properties";
import { computeDealScore } from "@/lib/deal-score";
import { DashboardNav } from "@/components/layout/dashboard-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setProperties } = usePropertyStore();

  useEffect(() => {
    const propsWithScores = DEMO_PROPERTIES.map((p) => ({
      ...p,
      dealScore: p.dealScore ?? computeDealScore(p),
    }));
    setProperties(propsWithScores);
  }, [setProperties]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DashboardNav />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
