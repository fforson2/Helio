"use client";

import { useUIStore, usePropertyStore, useUserStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Map,
  List,
  Columns3,
  MessageSquare,
  FileText,
  Bookmark,
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
import { useRouter } from "next/navigation";

const NAV_TABS = [
  { id: "map", label: "Map", icon: Map },
  { id: "list", label: "List", icon: List },
  { id: "compare", label: "Compare", icon: Columns3 },
  { id: "assistant", label: "Assistant", icon: MessageSquare },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "saved", label: "Saved", icon: Bookmark },
] as const;

export function DashboardNav() {
  const { activeTab, setActiveTab } = useUIStore();
  const { comparisonIds, savedProperties } = usePropertyStore();
  const { profile } = useUserStore();
  const router = useRouter();

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
        {NAV_TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          const badge =
            id === "compare"
              ? comparisonIds.length
              : id === "saved"
              ? savedProperties.length
              : 0;

          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden md:block">{label}</span>
              {badge > 0 && (
                <span
                  className={cn(
                    "absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold",
                    isActive
                      ? "bg-background text-foreground"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  {badge}
                </span>
              )}
            </button>
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
