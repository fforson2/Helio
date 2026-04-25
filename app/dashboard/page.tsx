"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Map, MessageSquare, FileText, ChartNetwork, Compass } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border p-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-lg font-semibold">Dashboard</div>
          <div className="text-sm text-muted-foreground mt-1">
            Jump into the map, ask the agent, run a tour, or generate reports.
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="w-4 h-4" /> Map
              </CardTitle>
              <CardDescription>Browse properties on the map.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => router.push("/dashboard/map")}>
                Open map
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Agent
              </CardTitle>
              <CardDescription>Ask questions grounded in your search.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => router.push("/dashboard/agent")}
              >
                Open agent
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Compass className="w-4 h-4" /> Tour
              </CardTitle>
              <CardDescription>Start a guided tour workflow (placeholder).</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => router.push("/dashboard/tour")}
              >
                Start tour
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4" /> Report
              </CardTitle>
              <CardDescription>Generate and download property reports.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => router.push("/dashboard/report")}
              >
                Open reports
              </Button>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChartNetwork className="w-4 h-4" /> Graph
              </CardTitle>
              <CardDescription>Knowledge graph / relationships view (placeholder).</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => router.push("/dashboard/graph")}
              >
                Open graph
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
