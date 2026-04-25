"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Compass, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  "Walk me through the best deal in my saved list",
  "Compare the top 3 properties and recommend one",
  "Highlight hidden risks I should care about",
];

export default function TourPage() {
  const [prompt, setPrompt] = useState("");
  const canStart = prompt.trim().length > 0;

  const placeholder = useMemo(
    () => "Describe the property tour you want — ask the agent to explore, compare, or explain.",
    []
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border p-6">
        <div className="max-w-4xl mx-auto flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Compass className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-semibold">Tour</div>
            <div className="text-sm text-muted-foreground mt-1">
              A guided workflow that turns prompts into structured exploration. (Placeholder UI)
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto grid gap-4">
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Start a tour
              </CardTitle>
              <CardDescription>
                Enter a prompt, then press Start Tour to kick off the guided flow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={placeholder}
              />
              <div className="flex items-center gap-2">
                <Button disabled={!canStart} className={cn("min-w-28")}>
                  Start Tour
                </Button>
                <Button variant="outline" onClick={() => setPrompt("")} disabled={!prompt}>
                  Clear
                </Button>
              </div>
              <div className="pt-2">
                <div className="text-xs text-muted-foreground mb-2">Try one:</div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPrompt(p)}
                      className="text-left px-3 py-1.5 rounded-full border border-border hover:border-primary/40 hover:bg-primary/5 text-xs transition-all"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

