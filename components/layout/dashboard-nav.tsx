"use client";

import { useUserStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Map,
  MessageSquare,
  Compass,
  Search,
  FileText,
  LayoutDashboard,
  ChartNetwork,
  Home,
  User,
  Settings,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_TABS = [
  { id: "map", label: "Map", icon: Map, href: "/dashboard/map" },
  { id: "agent", label: "Agent", icon: MessageSquare, href: "/dashboard/agent" },
  { id: "tour", label: "Tour", icon: Compass, href: "/dashboard/tour" },
  { id: "search", label: "Search", icon: Search, href: "/dashboard/search" },
  { id: "report", label: "Report", icon: FileText, href: "/dashboard/report" },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "graph", label: "Graph", icon: ChartNetwork, href: "/dashboard/graph" },
] as const;

export function DashboardNav() {
  const { profile } = useUserStore();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <header className="h-14 border-b border-border flex items-center px-4 gap-4 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      {/* Logo */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 mr-2 shrink-0"
      >
        <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
          <Home className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
        <span className="font-bold text-sm tracking-tight hidden sm:block">
          Helio
        </span>
      </button>

      <div className="w-px h-5 bg-border hidden sm:block" />

      {/* Tabs */}
      <nav className="flex items-center gap-1 flex-1">
        {NAV_TABS.map(({ id, label, icon: Icon, href }) => {
          const isActive =
            (id === "dashboard" && pathname === "/dashboard") ||
            (id !== "dashboard" && pathname?.startsWith(href));

          return (
            <Link
              key={id}
              href={href}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden md:block">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none shrink-0">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-3 h-3 text-primary" />
          </div>
          <span className="hidden sm:block text-sm max-w-24 truncate">
            {profile?.name ?? "Guest"}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>
            <div className="font-medium">{profile?.name ?? "Guest"}</div>
            <div className="text-xs text-muted-foreground capitalize">
              {profile?.role ?? "Buyer"}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/onboarding")}>
            <Settings className="w-4 h-4 mr-2" />
            Edit preferences
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
