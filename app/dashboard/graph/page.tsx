"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartNetwork } from "lucide-react";

export default function GraphPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6">
      <div className="max-w-4xl mx-auto w-full">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartNetwork className="w-4 h-4" /> Graph
            </CardTitle>
            <CardDescription>
              Placeholder for property ↔ neighborhood ↔ risk ↔ comps relationships.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This page is wired into navigation. Next step is to visualize your saved properties and
            deal score signals as a graph.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

