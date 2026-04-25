"use client";

import { useState } from "react";
import { usePropertyStore, useUserStore } from "@/lib/store";
import { Property } from "@/types/property";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatFullPrice, formatBeds, formatBaths, formatSqft, formatDaysOnMarket } from "@/lib/format";
import { getDealScoreColor, getDealScoreBg } from "@/lib/deal-score";
import {
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  Home,
  Sparkles,
  Map,
} from "lucide-react";
import { useUIStore } from "@/lib/store";
import { toast } from "sonner";

export function ReportsView() {
  const { properties, propertyMap, savedProperties, activeSearchSessionId } = usePropertyStore();
  const { profile } = useUserStore();
  const { setActiveTab } = useUIStore();
  const [generating, setGenerating] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Set<string>>(new Set());

  const savedProps = savedProperties
    .map((s) => propertyMap[s.propertyId] ?? properties.find((p) => p.id === s.propertyId))
    .filter(Boolean) as Property[];

  const reportableProps = savedProps.length > 0 ? savedProps : properties.slice(0, 4);

  async function generateReport(property: Property) {
    setGenerating(property.id);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          searchSessionId: activeSearchSessionId,
          userProfile: profile,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate report");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `helio-report-${property.location.address.replace(/\s+/g, "-").toLowerCase()}.html`;
      a.click();
      URL.revokeObjectURL(url);

      setGenerated((prev) => new Set([...prev, property.id]));
      toast.success("Report downloaded!", {
        description: property.location.address,
      });
    } catch {
      toast.error("Could not generate report", {
        description: "Add your API key to .env.local and try again",
      });
      setGenerated((prev) => new Set([...prev, property.id]));
    } finally {
      setGenerating(null);
    }
  }

  if (reportableProps.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
          <FileText className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">No properties saved yet</h2>
          <p className="text-muted-foreground max-w-sm">
            Save properties from the map to generate personalized analysis reports.
          </p>
        </div>
        <Button onClick={() => setActiveTab("map")} variant="outline" className="gap-2">
          <Map className="w-4 h-4" /> Browse and save properties
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
          <FileText className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Property Reports</h2>
          <p className="text-xs text-muted-foreground">
            AI-generated analysis for {reportableProps.length} properties
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Context */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex gap-3">
              <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium">AI-powered property reports</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Each report includes a deal analysis, neighborhood comparison, risk assessment,
                  and buyer-specific recommendations. Download as a shareable HTML file.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Property list */}
          {reportableProps.map((property) => (
            <PropertyReportCard
              key={property.id}
              property={property}
              isGenerating={generating === property.id}
              isGenerated={generated.has(property.id)}
              onGenerate={() => generateReport(property)}
            />
          ))}

          <Separator />

          {/* Comparison report */}
          {savedProps.length >= 2 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Full Comparison Report
                </CardTitle>
                <CardDescription>
                  Side-by-side analysis of all {savedProps.length} saved properties with a final recommendation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap mb-4">
                  {savedProps.map((p) => (
                    <Badge key={p.id} variant="secondary" className="text-xs gap-1">
                      <Home className="w-3 h-3" />
                      {p.location.address.split(" ").slice(0, 2).join(" ")}
                    </Badge>
                  ))}
                </div>
                <Button className="w-full gap-2" variant="outline">
                  <Download className="w-4 h-4" />
                  Download comparison report (coming soon)
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function PropertyReportCard({
  property,
  isGenerating,
  isGenerated,
  onGenerate,
}: {
  property: Property;
  isGenerating: boolean;
  isGenerated: boolean;
  onGenerate: () => void;
}) {
  const score = property.dealScore;

  return (
    <Card className={cn(score && getDealScoreBg(score.total), "transition-all")}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">
                  {property.location.address}
                </div>
                <div className="text-xs text-muted-foreground">
                  {property.location.neighborhood} · {formatFullPrice(property.price)}
                </div>
              </div>
              {score && (
                <div className="shrink-0 text-right">
                  <div className={cn("text-xl font-black", getDealScoreColor(score.total))}>
                    {score.total}
                  </div>
                  <div className="text-[10px] text-muted-foreground">score</div>
                </div>
              )}
            </div>

            <div className="flex gap-3 text-xs text-muted-foreground mt-2">
              <span>{formatBeds(property.details.beds)}</span>
              <span>{formatBaths(property.details.baths)}</span>
              <span>{formatSqft(property.details.sqft)}</span>
              <span>{formatDaysOnMarket(property.daysOnMarket)}</span>
            </div>

            {score && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                {score.summary}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3">
          <Button
            onClick={onGenerate}
            disabled={isGenerating}
            size="sm"
            className={cn(
              "w-full gap-2",
              isGenerated && "border-emerald-500/30 text-emerald-400 hover:text-emerald-300"
            )}
            variant={isGenerated ? "outline" : "default"}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating report...
              </>
            ) : isGenerated ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Download again
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                Generate & download report
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
