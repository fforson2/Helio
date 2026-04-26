"use client";

import { useState, useRef, useEffect } from "react";
import {
  resolvePropertiesById,
  usePropertyStore,
  useUserStore,
  useChatStore,
} from "@/lib/store";
import { ChatMessageBubble } from "@/components/chat/chat-message-bubble";
import { Property } from "@/types/property";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import {
  Home,
  Send,
  Loader2,
  Bot,
  Download,
  CheckCircle2,
  Bookmark,
  BookmarkCheck,
  Mail,
  X,
} from "lucide-react";
import { toast } from "sonner";

type QuickActionId = "email" | "mrkt" | "rprt" | "schm";

interface QuickAction {
  id: QuickActionId;
  tag: string;
  label: string;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "email",
    tag: "EMAIL",
    label: "Email me a property summary",
    prompt: "",
  },
  {
    id: "mrkt",
    tag: "MRKT",
    label: "Market analysis for my saved properties",
    prompt:
      "Give me a thorough market analysis comparing every property in my saved properties. Cover pricing vs. AVM, neighborhood trends, days-on-market signals, and risk factors. End with a final ranking.",
  },
  {
    id: "rprt",
    tag: "RPRT",
    label: "Compare top search results",
    prompt:
      "Compare the top 3 properties in my search by deal score. Surface the clearest differences (price-per-sqft, school rating, walkability, risk, condition, momentum) and tell me which one is the best buy and why.",
  },
  {
    id: "schm",
    tag: "SCHM",
    label: "Generate floor plan schematic",
    prompt: "",
  },
];

export function ReportsView() {
  const {
    properties,
    propertyMap,
    activePropertyIds,
    activeSearchSessionId,
    savedProperties,
    comparisonIds,
    saveProperty,
    unsaveProperty,
    isPropertySaved,
    addToComparison,
    removeFromComparison,
    clearComparison,
  } = usePropertyStore();
  const { profile } = useUserStore();
  const { messages, isLoading, addMessage, setLoading, clearMessages } =
    useChatStore();

  const [activeTab, setActiveTab] = useState<"properties" | "saved" | "compare">(
    "properties"
  );
  const [input, setInput] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  );
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<Set<string>>(new Set());
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset to default welcome state every time the Report tab is opened.
  useEffect(() => {
    clearMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Saved listings may live outside the current search results, so fall
  // back to the persisted propertyMap for lookups.
  const activeProperties = resolvePropertiesById(
    activePropertyIds,
    propertyMap,
    properties
  );
  const savedPropsList = resolvePropertiesById(
    savedProperties.map((saved) => saved.propertyId),
    propertyMap,
    properties
  );
  const comparedProps = resolvePropertiesById(comparisonIds, propertyMap, properties);

  const displayProperties =
    activeTab === "saved"
      ? savedPropsList
      : activeTab === "compare"
        ? comparedProps
        : activeProperties;
  const bestComparedProperty =
    comparedProps.length > 0
      ? comparedProps.reduce((best, property) =>
          (property.dealScore?.total ?? -1) > (best.dealScore?.total ?? -1)
            ? property
            : best
        )
      : null;
  const bestComparedReasons = bestComparedProperty
    ? getBestPropertyReasons(bestComparedProperty, comparedProps)
    : [];

  const comparisonRows: { label: string; value: (property: Property) => string }[] = [
    { label: "Address", value: (property) => property.location.address },
    {
      label: "Location",
      value: (property) =>
        `${property.location.neighborhood}, ${property.location.city}, ${property.location.state}`,
    },
    { label: "Price", value: (property) => property.price.toLocaleString() },
    {
      label: "Deal Score",
      value: (property) =>
        property.dealScore
          ? `${property.dealScore.total} (${property.dealScore.label})`
          : "N/A",
    },
    {
      label: "Estimated Value",
      value: (property) =>
        property.estimatedValue ? property.estimatedValue.toLocaleString() : "N/A",
    },
    {
      label: "Price / Sqft",
      value: (property) =>
        property.pricePerSqft
          ? `$${Math.round(property.pricePerSqft).toLocaleString()}`
          : `$${Math.round(property.price / Math.max(property.details.sqft, 1)).toLocaleString()}`,
    },
    {
      label: "Beds / Baths",
      value: (property) => `${property.details.beds} bd / ${property.details.baths} ba`,
    },
    {
      label: "Square Footage",
      value: (property) => `${property.details.sqft.toLocaleString()} sqft`,
    },
    {
      label: "Lot Size",
      value: (property) =>
        property.details.lotSqft
          ? `${property.details.lotSqft.toLocaleString()} sqft`
          : "N/A",
    },
    {
      label: "Year Built",
      value: (property) => String(property.details.yearBuilt),
    },
    {
      label: "Property Type",
      value: (property) => property.details.propertyType.replace(/_/g, " "),
    },
    {
      label: "Days on Market",
      value: (property) => `${property.daysOnMarket} days`,
    },
    {
      label: "Neighborhood Median Price",
      value: (property) =>
        `$${property.neighborhoodStats.medianPrice.toLocaleString()}`,
    },
    {
      label: "Market Trend",
      value: (property) => `${property.neighborhoodStats.priceChangeYoY}% YoY`,
    },
    {
      label: "Walk Score",
      value: (property) =>
        property.walkScore !== undefined ? `${property.walkScore}/100` : "N/A",
    },
    {
      label: "Transit Score",
      value: (property) =>
        property.transitScore !== undefined ? `${property.transitScore}/100` : "N/A",
    },
    {
      label: "School Rating",
      value: (property) =>
        property.schoolRating !== undefined ? `${property.schoolRating}/10` : "N/A",
    },
    {
      label: "Rental Estimate",
      value: (property) =>
        property.rentalEstimate ? `${property.rentalEstimate.toLocaleString()}/mo` : "N/A",
    },
    {
      label: "HOA",
      value: (property) =>
        property.hoaFee ? `${property.hoaFee.toLocaleString()}/mo` : "None",
    },
    {
      label: "Tax Rate",
      value: (property) => (property.taxRate ? `${property.taxRate}%` : "N/A"),
    },
    {
      label: "Fire Risk",
      value: (property) =>
        property.riskProfile.fireRisk.charAt(0).toUpperCase() +
        property.riskProfile.fireRisk.slice(1),
    },
    {
      label: "Flood Risk",
      value: (property) =>
        property.riskProfile.floodRisk.charAt(0).toUpperCase() +
        property.riskProfile.floodRisk.slice(1),
    },
    {
      label: "Earthquake Risk",
      value: (property) =>
        property.riskProfile.earthquakeRisk.charAt(0).toUpperCase() +
        property.riskProfile.earthquakeRisk.slice(1),
    },
    {
      label: "Crime Score",
      value: (property) => `${property.riskProfile.crimeScore}/100`,
    },
  ];

  function downloadImage(url: string, caption: string) {
    const filename = caption
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase()
      .slice(0, 60);

    if (url.startsWith("data:")) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.png`;
      a.click();
      return;
    }

    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `${filename}.png`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => {
        window.open(url, "_blank");
      });
  }

  /** Pick which properties go into a "summary" action (email, etc.). */
  function getSummaryScope(): Property[] {
    if (selectedProperty) return [selectedProperty];
    if (savedPropsList.length > 0) return savedPropsList;
    return [...activeProperties]
      .sort((a, b) => (b.dealScore?.total ?? 0) - (a.dealScore?.total ?? 0))
      .slice(0, 3);
  }

  /** Pick the property used for floor-plan generation. */
  function getSchematicProperty(): Property | null {
    if (selectedProperty) return selectedProperty;
    if (savedPropsList.length > 0) return savedPropsList[0];
    const top = [...activeProperties].sort(
      (a, b) => (b.dealScore?.total ?? 0) - (a.dealScore?.total ?? 0)
    )[0];
    return top ?? null;
  }

  async function sendMessage(content?: string) {
    const text = (content ?? input).trim();
    if (!text || isLoading) return;
    setInput("");

    addMessage({ role: "user", content: text });
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: text }],
          context: {
            searchSessionId: activeSearchSessionId,
            selectedPropertyId: selectedProperty?.id ?? null,
            savedPropertyIds: savedProperties.map((s) => s.propertyId),
            userPreferences: profile?.preferences,
            userName: profile?.name,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      addMessage({ role: "assistant", content: data.message });
    } catch {
      addMessage({
        role: "assistant",
        content:
          "Having trouble connecting. Check your API key in .env.local and try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickAction(action: QuickAction) {
    if (action.id === "email") {
      setEmailModalOpen(true);
      return;
    }
    if (action.id === "schm") {
      await generateSchematic();
      return;
    }
    sendMessage(action.prompt);
  }

  async function generateSchematic() {
    const property = getSchematicProperty();
    if (!property) {
      toast.error("No property available to render");
      return;
    }
    addMessage({
      role: "user",
      content: `Generate a floor plan schematic for ${property.location.address}.`,
    });
    setLoading(true);

    try {
      const res = await fetch("/api/schematic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to generate schematic");
      }
      addMessage({
        role: "assistant",
        content: data.caption ?? "Floor plan generated.",
        imageUrl: data.imageUrl,
        imageCaption: data.caption,
      });
    } catch (err) {
      addMessage({
        role: "assistant",
        content: `Couldn't generate the floor plan. ${
          err instanceof Error ? err.message : "Please try again."
        }`,
      });
    } finally {
      setLoading(false);
    }
  }

  async function sendEmail(toEmail: string) {
    const scope = getSummaryScope();
    if (scope.length === 0) {
      toast.error("No properties to summarize");
      return;
    }
    setEmailModalOpen(false);

    const label =
      scope.length === 1
        ? scope[0].location.address
        : `${scope.length} saved properties`;
    addMessage({
      role: "user",
      content: `Email me a property summary for ${label} (${toEmail}).`,
    });
    setLoading(true);

    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: toEmail,
          properties: scope,
          userProfile: profile,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Email failed");
      }
      toast.success("Email sent", { description: toEmail });
      addMessage({
        role: "assistant",
        content: `Sent your property summary to **${toEmail}**. Subject: "${data.subject}". Check your inbox in a minute or two.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Email failed";
      toast.error("Email failed", { description: msg });
      addMessage({
        role: "assistant",
        content: `I couldn't send the email. ${msg}`,
      });
    } finally {
      setLoading(false);
    }
  }

  async function generateReport(property: Property) {
    setGenerating(true);
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
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `helio-report-${property.location.address
        .replace(/\s+/g, "-")
        .toLowerCase()}.html`;
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
    } finally {
      setGenerating(false);
    }
  }

  function getComparisonPosition(propertyId: string) {
    const index = comparisonIds.indexOf(propertyId);
    return index === -1 ? null : index + 1;
  }

  function toggleCompare(property: Property) {
    const position = getComparisonPosition(property.id);
    if (position) {
      removeFromComparison(property.id);
      return;
    }

    if (comparisonIds.length >= 3) {
      toast.error("Comparison is limited to 3 properties");
      return;
    }

    addToComparison(property.id);
    toast.success("Added to compare", {
      description: property.location.address,
    });
  }

  function exportComparisonSheet() {
    if (comparedProps.length === 0) {
      toast.error("Select properties to compare first");
      return;
    }

    const escaped = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const tableRows = comparisonRows
      .map(
        (row) => `
          <tr>
            <td>${escaped(row.label)}</td>
            ${comparedProps
              .map((property) => `<td>${escaped(row.value(property))}</td>`)
              .join("")}
          </tr>`
      )
      .join("");

    const table = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; }
      h1 { margin-bottom: 8px; }
      p { margin: 0 0 16px; color: #555; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #cbd5e1; padding: 10px; vertical-align: top; }
      th { background: #0f172a; color: white; font-weight: 700; }
      td:first-child { font-weight: 700; background: #f8fafc; width: 220px; }
    </style>
  </head>
  <body>
    <h1>Helio Property Comparison</h1>
    <p>Generated ${new Date().toLocaleString()}</p>
    ${
      bestComparedProperty
        ? `<p><strong>Best overall:</strong> ${escaped(
            bestComparedProperty.location.address
          )} (${escaped(
            bestComparedProperty.dealScore
              ? `${bestComparedProperty.dealScore.total} - ${bestComparedProperty.dealScore.label}`
              : "Top comparison pick"
          )})</p>`
        : ""
    }
    ${
      bestComparedReasons.length > 0
        ? `<p><strong>Why this wins:</strong> ${escaped(bestComparedReasons.join(" | "))}</p>`
        : ""
    }
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          ${comparedProps
            .map(
              (property) =>
                `<th>${escaped(property.location.address)}${
                  bestComparedProperty?.id === property.id
                    ? "<br />Best overall"
                    : ""
                }<br />${escaped(`${property.location.city}, ${property.location.state}`)}</th>`
            )
            .join("")}
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </body>
</html>`;

    const blob = new Blob([table], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `helio-compare-${comparedProps.length}-properties.xls`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Comparison sheet downloaded");
  }

  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden">
      {/* ── Left sidebar ─────────────────────────────────────────── */}
      <div className="flex w-52 min-h-0 shrink-0 flex-col border-r border-border bg-card/20">
        <div className="p-2.5 border-b border-border">
          <div className="flex rounded-lg bg-secondary/40 p-0.5">
            {(["properties", "saved", "compare"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 py-1.5 text-[11px] font-semibold rounded-md capitalize transition-all",
                  activeTab === tab
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === "properties"
                  ? "Properties"
                  : tab === "saved"
                    ? "Saved"
                    : `Compare${comparisonIds.length ? ` (${comparisonIds.length})` : ""}`}
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 py-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Listings
          </span>
          <span className="text-[10px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
            {displayProperties.length}
          </span>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-2 space-y-2">
            {displayProperties.length === 0 && (
              <div className="py-10 text-center px-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {activeTab === "saved"
                    ? "No saved properties yet. Bookmark listings from the map."
                    : activeTab === "compare"
                      ? "No comparison picks yet. Tap Compare on up to 3 listings."
                    : "No properties found."}
                </p>
              </div>
            )}
            {displayProperties.map((property) => (
              <PropertySidebarCard
                key={property.id}
                property={property}
                isSelected={selectedProperty?.id === property.id}
                isSaved={isPropertySaved(property.id)}
                onSelect={() =>
                  setSelectedProperty(
                    selectedProperty?.id === property.id ? null : property
                  )
                }
                onSave={() =>
                  isPropertySaved(property.id)
                    ? unsaveProperty(property.id)
                    : saveProperty(property.id)
                }
                onCompare={() => toggleCompare(property)}
                comparisonIndex={getComparisonPosition(property.id)}
              />
            ))}
          </div>
        </ScrollArea>

        <div className="px-3 py-2 border-t border-border flex flex-wrap gap-1.5">
          <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full">
            Operational
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            {properties.length} listings
          </span>
        </div>
      </div>

      {/* ── Main AI panel ─────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab !== "compare" && selectedProperty && (
          <div className="border-b border-border bg-card/40 px-5 py-2 flex items-center gap-3 text-xs">
            <div className="flex-1 min-w-0">
              <span className="font-semibold truncate">
                {selectedProperty.location.address}
              </span>
              <span className="ml-2 text-muted-foreground">
                {formatPrice(selectedProperty.price)}
              </span>
              {selectedProperty.dealScore && (
                <span className="ml-2 text-primary font-bold">
                  Score {selectedProperty.dealScore.total}
                </span>
              )}
            </div>
            <button
              onClick={() => generateReport(selectedProperty)}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-secondary transition-colors disabled:opacity-50 font-medium shrink-0"
            >
              {generating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : generated.has(selectedProperty.id) ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              {generating
                ? "Generating…"
                : generated.has(selectedProperty.id)
                ? "Download again"
                : "Download report"}
            </button>
          </div>
        )}

        {activeTab === "compare" ? (
          <ScrollArea className="min-h-0 flex-1">
            <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-[22px] font-bold tracking-tight">
                    Compare Buildings Side by Side
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                    Select up to three properties from the list and export an Excel sheet with the key metrics buyers care about most.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={clearComparison}
                    disabled={comparisonIds.length === 0}
                    className="px-3 py-2 rounded-lg border border-border hover:bg-secondary text-sm font-medium transition-colors disabled:opacity-40"
                  >
                    Clear compare
                  </button>
                  <button
                    onClick={exportComparisonSheet}
                    disabled={comparisonIds.length === 0}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Excel
                  </button>
                </div>
              </div>

              {comparedProps.length === 0 ? (
                <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/20 p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Home className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">No properties selected yet</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Use the Compare button on any listing in the Reports sidebar to build a 3-property comparison set.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {bestComparedProperty ? (
                    <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
                        Best Overall
                      </div>
                      <div className="mt-1 text-base font-semibold text-foreground">
                        {bestComparedProperty.location.address}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Helio ranks this property highest based on deal score, value signals, and overall comparison strength.
                        {bestComparedProperty.dealScore
                          ? ` Current score: ${bestComparedProperty.dealScore.total} (${bestComparedProperty.dealScore.label}).`
                          : ""}
                      </p>
                      {bestComparedReasons.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
                            Why This Wins
                          </div>
                          <ul className="space-y-1.5 text-sm text-foreground/90">
                            {bestComparedReasons.map((reason) => (
                              <li key={reason} className="flex items-start gap-2">
                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-3">
                    {comparedProps.map((property, index) => (
                      <div
                        key={property.id}
                        className={cn(
                          "rounded-2xl border bg-card/30 p-4",
                          bestComparedProperty?.id === property.id
                            ? "border-emerald-400/35 ring-1 ring-emerald-400/20"
                            : "border-border"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.2em] text-primary/80">
                              Compare {index + 1}
                            </div>
                            {bestComparedProperty?.id === property.id ? (
                              <div className="mt-1 inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                                Best overall
                              </div>
                            ) : null}
                            <div className="mt-1 text-sm font-semibold">
                              {property.location.address}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {property.location.city}, {property.location.state}
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromComparison(property.id)}
                            className="w-7 h-7 rounded-md border border-border hover:bg-secondary flex items-center justify-center"
                            aria-label={`Remove ${property.location.address} from compare`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-xl bg-secondary/30 p-3">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Price
                            </div>
                            <div className="mt-1 font-semibold">
                              {formatPrice(property.price)}
                            </div>
                          </div>
                          <div className="rounded-xl bg-secondary/30 p-3">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Deal Score
                            </div>
                            <div className="mt-1 font-semibold">
                              {property.dealScore?.total ?? "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-border bg-card/20">
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse">
                        <thead>
                          <tr className="border-b border-border bg-secondary/30">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Metric
                            </th>
                            {comparedProps.map((property) => (
                              <th
                                key={property.id}
                                className={cn(
                                  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground min-w-[220px]",
                                  bestComparedProperty?.id === property.id && "bg-emerald-500/10"
                                )}
                              >
                                {property.location.address}
                                {bestComparedProperty?.id === property.id ? (
                                  <div className="mt-1 text-[10px] font-semibold tracking-[0.16em] text-emerald-300">
                                    Best overall
                                  </div>
                                ) : null}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {comparisonRows.map((row, index) => (
                            <tr
                              key={row.label}
                              className={cn(
                                "border-b border-border/70",
                                index % 2 === 0 ? "bg-background/30" : "bg-secondary/10"
                              )}
                            >
                              <td className="px-4 py-3 text-sm font-medium text-muted-foreground">
                                {row.label}
                              </td>
                              {comparedProps.map((property) => (
                                <td
                                  key={`${property.id}-${row.label}`}
                                  className={cn(
                                    "px-4 py-3 text-sm text-foreground align-top",
                                    bestComparedProperty?.id === property.id && "bg-emerald-500/[0.06]"
                                  )}
                                >
                                  {row.value(property)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        ) : (
          <>
            <ScrollArea
              className="min-h-0 flex-1"
              ref={scrollRef as React.RefObject<HTMLDivElement>}
            >
              <div className="mx-auto max-w-2xl px-6 py-8">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center min-h-[52vh] gap-7 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/25">
                      <Home className="w-8 h-8 text-primary-foreground" />
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-[22px] font-bold tracking-tight">
                        Helio Intelligence
                      </h2>
                      <p className="text-sm text-muted-foreground max-w-[300px] leading-relaxed">
                        Generate floor plan schematics, create PDF market reports,
                        or ask any real estate question. Multimodal — all data is
                        shared.
                      </p>
                    </div>

                    <div className="w-full max-w-md grid grid-cols-2 gap-2.5">
                      {QUICK_ACTIONS.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => handleQuickAction(action)}
                          disabled={isLoading}
                          className="flex items-start gap-2.5 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 text-left transition-all group disabled:opacity-50"
                        >
                          <span className="shrink-0 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded mt-0.5 leading-none font-mono">
                            {action.tag}
                          </span>
                          <span className="text-[12px] text-muted-foreground group-hover:text-foreground transition-colors leading-snug">
                            {action.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 pb-4">
                    {messages.map((message) => (
                      <ChatMessageBubble
                        key={message.id}
                        message={message}
                        onDownloadImage={(url, caption) => downloadImage(url, caption)}
                        downloadImageLabel="Download schematic"
                      />
                    ))}

                    {isLoading && (
                      <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
                          <Bot className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Working…
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="shrink-0 border-t border-border bg-background/95 p-4 backdrop-blur">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-end gap-2 rounded-xl border border-border bg-card/40 px-3 py-2.5 focus-within:border-primary/50 transition-colors">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Ask about floor plans, reports, market analysis..."
                    className="flex-1 bg-transparent text-sm resize-none outline-none min-h-[20px] max-h-28 placeholder:text-muted-foreground/50 leading-relaxed"
                    rows={1}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isLoading}
                    className="shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground transition-opacity disabled:opacity-30 hover:opacity-90"
                  >
                    {isLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-center text-[10px] text-muted-foreground/50 mt-2">
                  Shift+Enter new line · Enter to send
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Email modal ───────────────────────────────────────────── */}
      {emailModalOpen && (
        <EmailModal
          defaultEmail={profile?.email ?? ""}
          scope={getSummaryScope()}
          onClose={() => setEmailModalOpen(false)}
          onSubmit={(email) => sendEmail(email)}
        />
      )}
    </div>
  );
}

/* ── Email modal ──────────────────────────────────────────────────── */
function EmailModal({
  defaultEmail,
  scope,
  onClose,
  onSubmit,
}: {
  defaultEmail: string;
  scope: Property[];
  onClose: () => void;
  onSubmit: (email: string) => void;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address");
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl">
        <div className="p-5 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Mail className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm">
              Email me a property summary
            </div>
            <div className="text-[11px] text-muted-foreground">
              {scope.length === 1
                ? scope[0].location.address
                : `${scope.length} properties · AI-generated analysis`}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Email address
            </label>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="you@example.com"
              className={cn(
                "mt-1 w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none transition-colors",
                error
                  ? "border-red-500/60 focus:border-red-500"
                  : "border-border focus:border-primary/60"
              )}
            />
            {error && (
              <div className="text-[11px] text-red-400 mt-1">{error}</div>
            )}
          </div>

          {scope.length > 0 && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
                Will include
              </div>
              <ul className="space-y-1">
                {scope.slice(0, 4).map((p) => (
                  <li
                    key={p.id}
                    className="text-[12px] flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{p.location.address}</span>
                    <span className="text-muted-foreground shrink-0">
                      {formatPrice(p.price)}
                    </span>
                  </li>
                ))}
                {scope.length > 4 && (
                  <li className="text-[11px] text-muted-foreground">
                    +{scope.length - 4} more
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-secondary text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-sm font-semibold transition-opacity flex items-center justify-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Property sidebar card ──────────────────────────────────────────── */
function PropertySidebarCard({
  property,
  isSelected,
  isSaved,
  onSelect,
  onSave,
  onCompare,
  comparisonIndex,
}: {
  property: Property;
  isSelected: boolean;
  isSaved: boolean;
  onSelect: () => void;
  onSave: () => void;
  onCompare: () => void;
  comparisonIndex: number | null;
}) {
  const changeYoY = property.neighborhoodStats?.priceChangeYoY ?? 0;
  const isPositive = changeYoY >= 0;

  return (
    <div
      onClick={onSelect}
      className={cn(
        "rounded-xl border overflow-hidden cursor-pointer transition-all",
        isSelected
          ? "border-primary ring-1 ring-primary/30 bg-primary/5"
          : "border-border hover:border-primary/30"
      )}
    >
      {property.photos?.[0] && (
        <div className="relative h-[88px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={property.photos[0]}
            alt={property.location.address}
            className="w-full h-full object-cover"
          />
          <div
            className={cn(
              "absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm",
              isPositive
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-red-500/20 text-red-300"
            )}
          >
            {isPositive ? "+" : ""}
            {changeYoY}%
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            {isSaved ? (
              <BookmarkCheck className="w-3 h-3 text-primary" />
            ) : (
              <Bookmark className="w-3 h-3 text-white/80" />
            )}
          </button>
        </div>
      )}

      <div className="p-2">
        <div className="font-bold text-[12px] leading-tight">
          {formatPrice(property.price)}
          {property.listingType === "for_rent" && (
            <span className="font-normal text-muted-foreground">/mo</span>
          )}
        </div>
        <div className="text-[11px] font-medium truncate mt-0.5 text-foreground/90">
          {property.location.address}
        </div>
        <div className="text-[10px] text-muted-foreground truncate mt-0.5">
          {property.location.city}, {property.location.state}{" "}
          {property.location.zip} · {property.details.sqft.toLocaleString()} sf
        </div>
        <div className="text-[10px] text-muted-foreground/60 truncate mt-0.5">
          {property.details.propertyType.replace(/_/g, " ")}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCompare();
            }}
            className={cn(
              "relative flex-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
              comparisonIndex
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-secondary"
            )}
          >
            Compare
            {comparisonIndex ? (
              <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-bold text-background">
                {comparisonIndex}
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </div>
  );
}

function getBestPropertyReasons(bestProperty: Property, comparedProps: Property[]) {
  const peers = comparedProps.filter((property) => property.id !== bestProperty.id);
  if (peers.length === 0) return [];

  const reasons: string[] = [];
  const bestScore = bestProperty.dealScore?.total;
  const peerScores = peers
    .map((property) => property.dealScore?.total)
    .filter((score): score is number => typeof score === "number");

  if (typeof bestScore === "number" && peerScores.length > 0) {
    const nextBest = Math.max(...peerScores);
    reasons.push(
      `Highest deal score at ${bestScore}, beating the next closest option by ${bestScore - nextBest} points.`
    );
  }

  const bestPricePerSqft =
    bestProperty.pricePerSqft ?? bestProperty.price / Math.max(bestProperty.details.sqft, 1);
  const peerPricePerSqft = peers.map(
    (property) => property.pricePerSqft ?? property.price / Math.max(property.details.sqft, 1)
  );
  if (peerPricePerSqft.length > 0) {
    const averagePeerPpsf =
      peerPricePerSqft.reduce((sum, value) => sum + value, 0) / peerPricePerSqft.length;
    if (bestPricePerSqft < averagePeerPpsf) {
      reasons.push(
        `Better value per square foot at $${Math.round(bestPricePerSqft).toLocaleString()}, versus about $${Math.round(
          averagePeerPpsf
        ).toLocaleString()} across the other picks.`
      );
    }
  }

  const avgRisk =
    (bestProperty.riskProfile.crimeScore +
      riskSeverity(bestProperty.riskProfile.fireRisk) * 20 +
      riskSeverity(bestProperty.riskProfile.floodRisk) * 20 +
      riskSeverity(bestProperty.riskProfile.earthquakeRisk) * 20) /
    4;
  const peerRiskScores = peers.map(
    (property) =>
      (property.riskProfile.crimeScore +
        riskSeverity(property.riskProfile.fireRisk) * 20 +
        riskSeverity(property.riskProfile.floodRisk) * 20 +
        riskSeverity(property.riskProfile.earthquakeRisk) * 20) /
      4
  );
  if (peerRiskScores.length > 0) {
    const averagePeerRisk =
      peerRiskScores.reduce((sum, value) => sum + value, 0) / peerRiskScores.length;
    if (avgRisk < averagePeerRisk) {
      reasons.push(
        `Lower overall risk profile, with a blended risk score of ${Math.round(avgRisk)} versus ${Math.round(
          averagePeerRisk
        )} for the other options.`
      );
    }
  }

  if (reasons.length < 3) {
    const peerTrend =
      peers.reduce((sum, property) => sum + property.neighborhoodStats.priceChangeYoY, 0) /
      peers.length;
    if (bestProperty.neighborhoodStats.priceChangeYoY >= peerTrend) {
      reasons.push(
        `Stronger neighborhood momentum at ${bestProperty.neighborhoodStats.priceChangeYoY}% YoY, supporting better upside than the rest of the set.`
      );
    }
  }

  if (reasons.length < 3) {
    const peerDom =
      peers.reduce((sum, property) => sum + property.daysOnMarket, 0) / peers.length;
    if (bestProperty.daysOnMarket <= peerDom) {
      reasons.push(
        `Moving faster than the comparison group at ${bestProperty.daysOnMarket} days on market, versus ${Math.round(
          peerDom
        )} days on average for the others.`
      );
    }
  }

  return reasons.slice(0, 3);
}

function riskSeverity(risk: Property["riskProfile"]["fireRisk"]) {
  return {
    minimal: 0,
    low: 1,
    moderate: 2,
    high: 3,
  }[risk];
}
