"use client";

import { useState } from "react";
import { usePropertyStore } from "@/lib/store";
import { AgentPropertySidebar } from "@/components/agent/agent-property-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  "Full Property Tour",
  "Exterior Walk-Around",
  "Interior Room Tour",
  "Neighborhood Flyover",
];

export default function TourPage() {
  const [prompt, setPrompt] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const { properties } = usePropertyStore();
  const canStart = prompt.trim().length > 0;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (canStart) {
        // TODO: start tour
      }
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <AgentPropertySidebar
        onSelectProperty={setSelectedPropertyId}
        selectedPropertyId={selectedPropertyId}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Prompt input bar */}
        <div className="border-b border-border px-5 py-3 bg-card/30 shrink-0">
          <div className="flex items-center gap-3">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the property tour you want — walk around, enter the building, explore rooms..."
              className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/60"
            />
            <Button
              disabled={!canStart}
              size="sm"
              className="shrink-0 px-4"
            >
              Start Tour
            </Button>
          </div>

          {/* Quick prompt chips */}
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-[11px] text-muted-foreground/50 italic">Try:</span>
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrompt(p)}
                className={cn(
                  "px-3 py-1 rounded-full border text-[11px] font-medium transition-all",
                  prompt === p
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground hover:bg-primary/5"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Main content — empty state */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="flex flex-col items-center gap-5">
            {/* Globe wireframe icon */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              <Globe className="w-20 h-20 text-primary/25 stroke-[0.8]" />
            </div>

            <div className="text-center space-y-1.5">
              <p className="text-sm text-muted-foreground">
                Enter a prompt and press{" "}
                <span className="font-semibold text-foreground">Start Tour</span>
              </p>
              <p className="text-sm text-muted-foreground/70">
                to start a live interactive virtual property tour.
              </p>
            </div>

            <div className="flex items-center gap-1.5 mt-2">
              <kbd className="px-2 py-1 rounded-md bg-muted/60 border border-border text-[11px] font-mono text-muted-foreground">
                Ctrl
              </kbd>
              <span className="text-muted-foreground/40 text-xs">+</span>
              <kbd className="px-2 py-1 rounded-md bg-muted/60 border border-border text-[11px] font-mono text-muted-foreground">
                Enter
              </kbd>
              <span className="text-[11px] text-muted-foreground/40 ml-1">to preview</span>
            </div>
          </div>
        </div>

        {/* Bottom status bar */}
        <div className="h-8 border-t border-border flex items-center px-4 gap-4 bg-card/20 shrink-0 text-[10px]">
          <div className="flex items-center gap-1.5">
            <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
            <span className="text-muted-foreground/70">Operational</span>
          </div>
          <span className="text-muted-foreground/40">United States</span>
          <span className="text-muted-foreground/40">{properties.length > 0 ? "78" : "0"} metros</span>
          <span className="text-muted-foreground/40">32 feeds</span>
          <div className="flex-1" />
          <span className="text-muted-foreground/30 tabular-nums">
            {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </div>
  );
}
