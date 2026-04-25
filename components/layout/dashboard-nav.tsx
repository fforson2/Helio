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
] as const;

export function DashboardNav() {
  const { profile } = useUserStore();
  const router = useRouter();
  const pathname = usePathname();
  const initials = (profile?.name ?? "Guest")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="sticky top-0 z-50 flex h-12 items-center gap-4 border-b border-white/8 bg-[#111214]/95 px-4 backdrop-blur-xl">
      <button
        onClick={() => router.push("/")}
        className="flex shrink-0 items-center gap-2 pr-2"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#23173d] ring-1 ring-violet-400/20">
          <Home className="h-3.5 w-3.5 text-violet-300" />
        </div>
        <span className="hidden text-xs font-semibold tracking-[0.28em] text-white/90 sm:block">
          HELIO
        </span>
      </button>

      <div className="hidden h-5 w-px bg-white/8 sm:block" />

      <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
        {NAV_TABS.map(({ id, label, icon: Icon, href }) => {
          const isActive =
            (id === "dashboard" && pathname === "/dashboard") ||
            (id !== "dashboard" && pathname?.startsWith(href));

          return (
            <Link
              key={id}
              href={href}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                isActive
                  ? "bg-amber-400 text-black shadow-[0_0_18px_rgba(251,191,36,0.22)]"
                  : "text-white/55 hover:bg-white/6 hover:text-white"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden md:block">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300 md:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Live
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex shrink-0 items-center gap-2 rounded-full border border-white/8 bg-white/5 px-1.5 py-1 pr-2 text-sm font-medium text-white transition-colors hover:bg-white/10 focus:outline-none">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20 text-[11px] font-semibold text-violet-200">
              {initials || <User className="h-3 w-3" />}
            </div>
            <span className="hidden max-w-24 truncate text-xs text-white/80 sm:block">
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
      </div>
    </header>
  );
}
