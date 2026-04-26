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
    saveProperty,
    unsaveProperty,
    isPropertySaved,
  } = usePropertyStore();
  const { profile } = useUserStore();
  const { messages, isLoading, addMessage, setLoading, clearMessages } =
    useChatStore();

  const [activeTab, setActiveTab] = useState<"properties" | "saved">(
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

  const displayProperties =
    activeTab === "saved" ? savedPropsList : activeProperties;

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

  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden">
      {/* ── Left sidebar ─────────────────────────────────────────── */}
      <div className="flex w-52 min-h-0 shrink-0 flex-col border-r border-border bg-card/20">
        <div className="p-2.5 border-b border-border">
          <div className="flex rounded-lg bg-secondary/40 p-0.5">
            {(["properties", "saved"] as const).map((tab) => (
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
                {tab === "properties" ? "Properties" : "Saved"}
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
        {selectedProperty && (
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
}: {
  property: Property;
  isSelected: boolean;
  isSaved: boolean;
  onSelect: () => void;
  onSave: () => void;
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
      </div>
    </div>
  );
}
