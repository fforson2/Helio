"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useUserStore } from "@/lib/store";
import { BuyerPreferences, UserProfile } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  Home,
  DollarSign,
  MapPin,
  Sparkles,
  ChevronRight,
  Check,
  Building,
  Building2,
  Layers,
  Zap,
  Bot,
} from "lucide-react";
import { formatPrice } from "@/lib/format";

const PROPERTY_TYPE_OPTIONS = [
  { value: "single_family", label: "House", icon: Home },
  { value: "condo", label: "Condo", icon: Building },
  { value: "townhouse", label: "Townhouse", icon: Building2 },
  { value: "multi_family", label: "Multi-Family", icon: Layers },
];

const MUST_HAVES = [
  "Pool", "Garage", "Backyard", "Updated kitchen",
  "Home office", "EV charging", "Solar panels", "ADU / Guest suite",
  "Mountain views", "Ocean views", "No HOA",
];

export default function OnboardingPage() {
  const router = useRouter();
  const { setProfile, completeOnboarding } = useUserStore();

  const [role, setRole] = useState<"buyer" | "renter">("buyer");
  const [propertyTypes, setPropertyTypes] = useState<string[]>(["single_family"]);
  const [priceRange, setPriceRange] = useState([500_000, 2_000_000]);
  const [beds, setBeds] = useState(2);
  const [baths, setBaths] = useState(1);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [mustHaves, setMustHaves] = useState<string[]>([]);

  function toggle<T extends string>(arr: T[], item: T, max?: number): T[] {
    if (arr.includes(item)) return arr.filter((x) => x !== item);
    if (max && arr.length >= max) return arr;
    return [...arr, item];
  }

  function finish() {
    const enteredLocation = [city.trim(), state.trim()].filter(Boolean).join(", ");

    const preferences: BuyerPreferences = {
      minPrice: priceRange[0],
      maxPrice: priceRange[1],
      minBeds: beds,
      minBaths: baths,
      propertyTypes: propertyTypes as BuyerPreferences["propertyTypes"],
      targetNeighborhoods: enteredLocation ? [enteredLocation] : [],
      mustHaves,
      dealBreakers: [],
      listingType: role === "buyer" ? "for_sale" : "for_rent",
    };
    const profile: UserProfile = {
      id: `user_${Date.now()}`,
      name: "Guest",
      email: "",
      role,
      preferences,
      createdAt: new Date().toISOString(),
    };
    setProfile(profile);
    completeOnboarding();
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Home className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">Helio</span>
        </div>
        <button
          onClick={finish}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Single-page form */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-10">

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <div className="inline-flex items-center gap-2 text-primary text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              AI-powered property search
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Find your perfect home
            </h1>
            <p className="text-muted-foreground">
              Tell Helio what you're looking for. Takes 30 seconds.
            </p>
          </motion.div>

          {/* Section: Looking to */}
          <Section label="I'm looking to" index={1}>
            <div className="grid grid-cols-2 gap-3">
              {([ 
                { v: "buyer", label: "Buy a property" },
                { v: "renter", label: "Rent a property" },
              ] as const).map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => setRole(v)}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left font-medium transition-all",
                    role === v
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border hover:border-primary/40 text-muted-foreground"
                  )}
                >
                  {role === v && <Check className="w-3.5 h-3.5 text-primary inline-block mr-1.5" />}
                  {label}
                </button>
              ))}
            </div>
          </Section>

          {/* Section: Property type */}
          <Section label="Property type" index={2}>
            <div className="grid grid-cols-4 gap-2">
              {PROPERTY_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() =>
                    setPropertyTypes(toggle(propertyTypes, value))
                  }
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                    propertyTypes.includes(value)
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5",
                      propertyTypes.includes(value)
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </Section>

          {/* Section: Budget */}
          <Section label="Budget" index={3}>
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Range</span>
                  <span className="text-sm font-mono font-semibold">
                    {formatPrice(priceRange[0])}{" "}
                    <span className="text-muted-foreground">–</span>{" "}
                    {formatPrice(priceRange[1])}
                  </span>
                </div>
                <Slider
                  min={200_000}
                  max={5_000_000}
                  step={50_000}
                  value={priceRange}
                  onValueChange={(v) =>
                    setPriceRange(Array.isArray(v) ? v : [v as number])
                  }
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>$200K</span><span>$5M+</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Min. bedrooms</Label>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setBeds(n)}
                        className={cn(
                          "flex-1 py-2 rounded-lg border text-sm font-medium transition-all",
                          beds === n
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {n}+
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Min. bathrooms</Label>
                  <div className="flex gap-1.5">
                    {[1, 1.5, 2, 3].map((n) => (
                      <button
                        key={n}
                        onClick={() => setBaths(n)}
                        className={cn(
                          "flex-1 py-2 rounded-lg border text-sm font-medium transition-all",
                          baths === n
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {n}+
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Section: Location */}
          <Section label="Location" sublabel="Enter the city and state" index={4}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city" className="text-xs">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="San Diego"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state" className="text-xs">State</Label>
                <Input
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="California"
                />
              </div>
            </div>
          </Section>

          {/* Section: Must-haves */}
          <Section label="Must-haves" sublabel="Optional" index={5}>
            <div className="flex flex-wrap gap-2">
              {MUST_HAVES.map((f) => (
                <button
                  key={f}
                  onClick={() => setMustHaves(toggle(mustHaves, f))}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                    mustHaves.includes(f)
                      ? "bg-primary/10 border-primary text-primary"
                      : "border-border hover:border-primary/40 text-muted-foreground"
                  )}
                >
                  {mustHaves.includes(f) && (
                    <Check className="w-3 h-3 inline-block mr-1" />
                  )}
                  {f}
                </button>
              ))}
            </div>
          </Section>

          {/* What you get */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: MapPin, label: "Smart map", sub: "Score-ranked pins" },
              { icon: Zap, label: "Deal Score", sub: "0–100 per property" },
              { icon: Bot, label: "Helio AI", sub: "Ask anything" },
            ].map(({ icon: Icon, label, sub }) => (
              <div
                key={label}
                className="p-3 rounded-xl bg-card border border-border text-center"
              >
                <Icon className="w-5 h-5 text-primary mx-auto mb-1.5" />
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{sub}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Button onClick={finish} size="lg" className="w-full gap-2 h-12 text-base">
            Find my properties
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  sublabel,
  index,
  children,
}: {
  label: string;
  sublabel?: string;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="space-y-3"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-bold text-primary/60 w-5">{index}</span>
        <div>
          <span className="font-semibold text-sm">{label}</span>
          {sublabel && (
            <span className="ml-2 text-xs text-muted-foreground">{sublabel}</span>
          )}
        </div>
      </div>
      <div className="pl-7">{children}</div>
    </motion.div>
  );
}
