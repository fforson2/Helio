"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ReactNode, useMemo } from "react";
import { resolvePropertiesById, usePropertyStore, useUserStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  formatFullPrice,
  formatPercent,
  formatPrice,
  formatSqft,
} from "@/lib/format";
import type { Property } from "@/types/property";
import {
  ArrowUpRight,
  Bath,
  Bed,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  Calculator,
  Heart,
  MoveRight,
  Sparkles,
  Target,
} from "lucide-react";

const MORTGAGE_RATE = 0.067;
const DEFAULT_INSURANCE_RATE = 0.0035;

const TIMELINE_LABELS = {
  asap: "ASAP",
  "1_3_months": "1-3 months",
  "3_6_months": "3-6 months",
  "6_12_months": "6-12 months",
  just_browsing: "Just browsing",
} as const;

function estimateMonthlyOwnershipCost(property: Property) {
  const downPayment = property.price * 0.2;
  const principal = Math.max(property.price - downPayment, 0);
  const monthlyRate = MORTGAGE_RATE / 12;
  const termMonths = 360;
  const monthlyMortgage =
    principal === 0
      ? 0
      : (principal * monthlyRate * (1 + monthlyRate) ** termMonths) /
        ((1 + monthlyRate) ** termMonths - 1);

  const taxRate = (property.taxRate ?? 1.1) / 100;
  const monthlyTaxes = (property.price * taxRate) / 12;
  const monthlyInsurance = (property.price * DEFAULT_INSURANCE_RATE) / 12;

  return monthlyMortgage + monthlyTaxes + monthlyInsurance + (property.hoaFee ?? 0);
}

function getInitials(name?: string | null) {
  if (!name) return "GU";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatPropertyType(propertyType?: Property["details"]["propertyType"]) {
  if (!propertyType) return "Flexible";
  return propertyType
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function clampPercent(value: number, min: number, max: number) {
  const percent = ((value - min) / (max - min)) * 100;
  return Math.min(100, Math.max(0, percent));
}

function Panel({
  title,
  eyebrow,
  action,
  className,
  children,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/8 bg-white/[0.03] shadow-[0_18px_60px_rgba(0,0,0,0.35)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/6 px-5 py-4">
        <div>
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-400/85">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 text-sm font-semibold text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/7 bg-white/[0.035] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-cyan-300">{value}</p>
      <p className="mt-2 text-xs text-white/40">{hint}</p>
    </div>
  );
}

function RailPropertyCard({
  property,
  saved,
  onOpen,
}: {
  property: Property;
  saved: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="group overflow-hidden rounded-2xl border border-white/8 bg-white/[0.035] text-left transition hover:border-cyan-400/40 hover:bg-white/[0.05]"
    >
      <div className="relative aspect-[1.45/1] overflow-hidden">
        <Image
          src={property.photos[0] ?? "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800"}
          alt={property.location.address}
          fill
          sizes="320px"
          className="object-cover transition duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-transparent" />
        <div className="absolute left-3 top-3 rounded-md bg-black/65 px-2 py-1 text-[11px] font-semibold text-white">
          {formatPrice(property.price)}
          {property.listingType === "for_rent" ? "/mo" : ""}
        </div>
        <div className="absolute right-3 top-3 rounded-md border border-white/10 bg-black/55 p-1.5 text-white/70">
          {saved ? <BookmarkCheck className="size-3.5 text-cyan-300" /> : <Bookmark className="size-3.5" />}
        </div>
      </div>
      <div className="space-y-2 px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="line-clamp-1 text-sm font-semibold text-white">
              {property.location.address}
            </h3>
            <p className="line-clamp-1 text-[11px] text-white/45">
              {property.location.city}, {property.location.state} · {formatSqft(property.details.sqft)}
            </p>
          </div>
          <span className="text-[11px] font-semibold text-emerald-400">
            +{property.dealScore?.total ?? 0}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-white/55">
          <span className="inline-flex items-center gap-1">
            <Bed className="size-3" />
            {property.details.beds}
          </span>
          <span className="inline-flex items-center gap-1">
            <Bath className="size-3" />
            {property.details.baths}
          </span>
          <span className="line-clamp-1">{formatPropertyType(property.details.propertyType)}</span>
        </div>
      </div>
    </button>
  );
}

function ProfileField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
        {label}
      </p>
      <p className="line-clamp-2 text-sm text-white/85">{value}</p>
    </div>
  );
}

function Meter({
  label,
  value,
  minLabel,
  maxLabel,
  percent,
}: {
  label: string;
  value: string;
  minLabel: string;
  maxLabel: string;
  percent: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-white/55">{label}</span>
        <span className="font-medium text-white">{value}</span>
      </div>
      <div className="relative h-7">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/12" />
        <div
          className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full border-2 border-[#0a0b0c] bg-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.5)]"
          style={{ left: `calc(${percent}% - 0.375rem)` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-white/25">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

export function DashboardHome() {
  const router = useRouter();
  const { properties, propertyMap, activePropertyIds, savedProperties, isPropertySaved, selectProperty } =
    usePropertyStore();
  const { profile } = useUserStore();
  const activeProperties = useMemo(
    () => resolvePropertiesById(activePropertyIds, propertyMap, properties),
    [activePropertyIds, propertyMap, properties]
  );

  const savedListings = useMemo(
    () =>
      savedProperties
        .map((saved) => propertyMap[saved.propertyId] ?? activeProperties.find((property) => property.id === saved.propertyId))
        .filter(Boolean) as Property[],
    [activeProperties, propertyMap, savedProperties]
  );

  const watchlist = savedListings.length > 0 ? savedListings : activeProperties.slice(0, 3);
  const portfolioSample = activeProperties
    .filter((property) => !watchlist.some((item) => item.id === property.id))
    .slice(0, 2);
  const activeProperty = savedListings[0] ?? activeProperties[0] ?? null;

  const watchlistCosts = watchlist.map(estimateMonthlyOwnershipCost);
  const totalPortfolioValue = savedListings.reduce((sum, property) => sum + property.price, 0);
  const averageMonthlyCost =
    watchlistCosts.length > 0
      ? watchlistCosts.reduce((sum, amount) => sum + amount, 0) / watchlistCosts.length
      : 0;
  const lowestMonthlyCost = watchlistCosts.length > 0 ? Math.min(...watchlistCosts) : 0;
  const averagePrice =
    watchlist.length > 0
      ? watchlist.reduce((sum, property) => sum + property.price, 0) / watchlist.length
      : profile?.preferences?.maxPrice ?? 950_000;

  const annualIncomeTarget = Math.round((averageMonthlyCost || averagePrice * 0.0058) * 12 / 0.31);
  const downPaymentTarget = Math.round(averagePrice * 0.2);
  const maxBuyPrice = annualIncomeTarget * 4.85;

  const marketTitle = activeProperty
    ? `${activeProperty.location.city} Market Context`
    : "Market Context";

  const marketStats = activeProperty?.neighborhoodStats;
  const targetNeighborhoods = profile?.preferences?.targetNeighborhoods?.length
    ? profile.preferences.targetNeighborhoods.join(", ")
    : activeProperty?.location.neighborhood ?? "California";

  const mustHaves = profile?.preferences?.mustHaves?.length
    ? profile.preferences.mustHaves.slice(0, 3).join(", ")
    : "Natural light, move-in ready, low maintenance";

  function openProperty(propertyId: string) {
    selectProperty(propertyId);
    router.push("/dashboard/map");
  }

  return (
    <div className="flex-1 min-h-0 bg-[#090a0b] text-white">
      <div className="grid h-full min-h-0 grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <aside className="min-h-0 border-b border-white/6 bg-[#121314] xl:border-r xl:border-b-0">
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-white/6 px-4 py-3">
              <div className="inline-flex rounded-xl bg-black/25 p-1">
                <button className="rounded-lg bg-cyan-400 px-4 py-1.5 text-xs font-semibold text-black">
                  Properties
                </button>
                <button className="rounded-lg px-4 py-1.5 text-xs font-medium text-white/45">
                  Watchlist
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-6">
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/25">
                        Listings
                      </p>
                      <p className="mt-1 text-xs text-white/45">Featured spaces ({watchlist.length})</p>
                    </div>
                    <span className="text-sm font-semibold text-cyan-300">{watchlist.length}</span>
                  </div>
                  <div className="space-y-3">
                    {watchlist.map((property) => (
                      <RailPropertyCard
                        key={property.id}
                        property={property}
                        saved={isPropertySaved(property.id)}
                        onOpen={() => openProperty(property.id)}
                      />
                    ))}
                  </div>
                </section>

                {portfolioSample.length > 0 ? (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/25">
                          Portfolio Sample
                        </p>
                        <p className="mt-1 text-xs text-white/45">Modeled from active inventory</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {portfolioSample.map((property) => (
                        <RailPropertyCard
                          key={property.id}
                          property={property}
                          saved={isPropertySaved(property.id)}
                          onOpen={() => openProperty(property.id)}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto bg-[#090a0b]">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 lg:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  Buyer Dashboard
                </h1>
                <p className="mt-1 text-sm text-white/45">
                  Track shortlist performance, affordability, and neighborhood context in one place.
                </p>
              </div>
              <div className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3 text-xs text-white/40">
                {savedListings.length > 0
                  ? "Your watchlist is live. Open any property from the rail to continue exploring on the map."
                  : "Save properties from the sidebar to populate your dashboard."}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              <MetricCard
                label="Watchlisted"
                value={watchlist.length.toString()}
                hint={`${savedListings.length} properties actively saved`}
              />
              <MetricCard
                label="Total Portfolio Value"
                value={savedListings.length > 0 ? formatPrice(totalPortfolioValue) : "—"}
                hint={savedListings.length > 0 ? "Based on your saved homes" : "Add homes to build a portfolio"}
              />
              <MetricCard
                label="Avg Monthly Cost"
                value={averageMonthlyCost > 0 ? `${formatPrice(Math.round(averageMonthlyCost))}/mo` : "—"}
                hint="Mortgage + tax + insurance + HOA"
              />
              <MetricCard
                label="Lowest Monthly"
                value={lowestMonthlyCost > 0 ? `${formatPrice(Math.round(lowestMonthlyCost))}/mo` : "—"}
                hint="Most affordable home in the rail"
              />
            </div>

            <Panel
              eyebrow="Saved Properties"
              title={savedListings.length > 0 ? "Shortlist snapshot" : "No properties saved yet"}
            >
              {savedListings.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {savedListings.slice(0, 4).map((property) => (
                    <button
                      key={property.id}
                      onClick={() => openProperty(property.id)}
                      className="group overflow-hidden rounded-2xl border border-white/8 bg-white/[0.035] text-left transition hover:border-cyan-400/40"
                    >
                      <div className="relative aspect-[1.8/1] overflow-hidden">
                        <Image
                          src={property.photos[0] ?? "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800"}
                          alt={property.location.address}
                          fill
                          sizes="600px"
                          className="object-cover transition duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
                        <div className="absolute left-4 bottom-4">
                          <p className="text-lg font-semibold text-white">{formatPrice(property.price)}</p>
                          <p className="text-xs text-white/65">
                            {property.location.address} · {property.location.city}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-white/55">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1">
                            <Bed className="size-3.5" />
                            {property.details.beds}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Bath className="size-3.5" />
                            {property.details.baths}
                          </span>
                          <span>{formatSqft(property.details.sqft)}</span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-cyan-300">
                          View on map
                          <ArrowUpRight className="size-3.5" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
                  <div className="rounded-full border border-white/8 bg-white/[0.04] p-5">
                    <Heart className="size-8 text-white/30" />
                  </div>
                  <p className="mt-5 text-base font-medium text-white/80">
                    No properties saved yet
                  </p>
                  <p className="mt-2 max-w-md text-sm text-white/40">
                    Click the bookmark icon on any listing in the sidebar to build a shortlist and unlock dashboard insights.
                  </p>
                </div>
              )}
            </Panel>
          </div>
        </section>

        <aside className="min-h-0 border-t border-white/6 bg-[#101112] xl:border-l xl:border-t-0">
          <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-4 py-5">
            <Panel
              eyebrow="Buyer Profile"
              title={profile?.name ? profile.name : "Guest buyer"}
              action={
                <button
                  onClick={() => router.push("/onboarding")}
                  className="text-xs font-medium text-white/45 transition hover:text-white"
                >
                  Edit
                </button>
              }
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-sm font-semibold text-cyan-300">
                    {getInitials(profile?.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {profile?.name?.trim() ? profile.name : "Guest Buyer"}
                    </p>
                    <p className="text-xs text-white/45">
                      {profile?.email?.trim() ? profile.email : "no-email@helio.local"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <ProfileField
                    label="Search Mode"
                    value={profile?.preferences?.listingType === "for_rent" ? "Renting" : "Buying"}
                  />
                  <ProfileField
                    label="Target Budget"
                    value={formatPrice(profile?.preferences?.maxPrice ?? Math.round(averagePrice))}
                  />
                  <ProfileField label="Target Area" value={targetNeighborhoods} />
                  <ProfileField
                    label="Home Type"
                    value={formatPropertyType(profile?.preferences?.propertyTypes?.[0])}
                  />
                  <ProfileField
                    label="Move Timeline"
                    value={profile?.timeline ? TIMELINE_LABELS[profile.timeline] : "1-3 months"}
                  />
                  <ProfileField
                    label="Max Commute"
                    value={
                      profile?.preferences?.maxCommuteMins
                        ? `${profile.preferences.maxCommuteMins} mins`
                        : "Flexible"
                    }
                  />
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
                    Must Haves
                  </p>
                  <p className="mt-2 text-sm text-white/75">{mustHaves}</p>
                </div>
              </div>
            </Panel>

            <Panel eyebrow="Affordability Calculator" title="What your current search supports">
              <div className="space-y-4">
                <Meter
                  label="Annual income"
                  value={`${formatPrice(annualIncomeTarget)}/yr`}
                  minLabel="$60k"
                  maxLabel="$500k"
                  percent={clampPercent(annualIncomeTarget, 60_000, 500_000)}
                />
                <Meter
                  label="Down payment"
                  value={formatPercent((downPaymentTarget / Math.max(averagePrice, 1)) * 100, 0)}
                  minLabel="5%"
                  maxLabel="30%"
                  percent={clampPercent((downPaymentTarget / Math.max(averagePrice, 1)) * 100, 5, 30)}
                />

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
                      Max rent budget
                    </p>
                    <p className="mt-2 text-xl font-semibold text-emerald-400">
                      {formatPrice(Math.round((annualIncomeTarget * 0.31) / 12))}/mo
                    </p>
                    <p className="mt-1 text-[11px] text-white/35">31% of gross income</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
                      Max buy price
                    </p>
                    <p className="mt-2 text-xl font-semibold text-cyan-300">
                      {formatPrice(Math.round(maxBuyPrice))}
                    </p>
                    <p className="mt-1 text-[11px] text-white/35">At current rate assumptions</p>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel eyebrow={marketTitle} title="Neighborhood pulse">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between text-white/75">
                  <span>Median home price</span>
                  <span className="font-medium text-white">
                    {marketStats ? formatPrice(marketStats.medianPrice) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-white/75">
                  <span>Avg mortgage rate (30y)</span>
                  <span className="font-medium text-white">6.7%</span>
                </div>
                <div className="flex items-center justify-between text-white/75">
                  <span>Avg price per sqft</span>
                  <span className="font-medium text-white">
                    {activeProperty?.pricePerSqft ? `${formatFullPrice(activeProperty.pricePerSqft)}/sqft` : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-white/75">
                  <span>Avg days on market</span>
                  <span className="font-medium text-white">
                    {marketStats ? `${marketStats.avgDaysOnMarket} days` : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-white/75">
                  <span>YoY price change</span>
                  <span className="font-medium text-emerald-400">
                    {marketStats ? formatPercent(marketStats.priceChangeYoY) : "—"}
                  </span>
                </div>
              </div>
            </Panel>

            <Panel eyebrow="Buyer Tips" title="Suggested next moves">
              <div className="space-y-3 text-sm text-white/65">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 size-4 text-cyan-300" />
                  <p>
                    Focus on homes with deal scores above 75 first. They combine stronger pricing with better long-term hold potential.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Calculator className="mt-0.5 size-4 text-cyan-300" />
                  <p>
                    Monthly cost in Helio includes mortgage, tax, insurance, and HOA, so use it instead of list price when comparing homes.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Target className="mt-0.5 size-4 text-cyan-300" />
                  <p>
                    Shortlist at least three homes in the same neighborhood before making a move. It sharpens your comp baseline and negotiation range.
                  </p>
                </div>
              </div>
            </Panel>

            <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.06] p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-cyan-400/12 p-2 text-cyan-300">
                  <BriefcaseBusiness className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Keep exploring</p>
                  <p className="mt-1 text-xs text-white/55">
                    Jump back into search, map, or reports from the top nav to keep building your buying thesis.
                  </p>
                  <button
                    onClick={() => router.push("/dashboard/map")}
                    className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-cyan-300 transition hover:text-cyan-200"
                  >
                    Open map
                    <MoveRight className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
