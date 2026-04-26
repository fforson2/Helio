"use client";

import { Property } from "@/types/property";
import { usePropertyStore } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  formatFullPrice,
  formatBeds,
  formatBaths,
  formatSqft,
  formatDaysOnMarket,
  formatPrice,
  getRiskLabel,
  getRiskColor,
} from "@/lib/format";
import { getDealScoreColor, getDealScoreBg } from "@/lib/deal-score";
import {
  X,
  Bookmark,
  BookmarkCheck,
  MessageSquare,
  Compass,
  MapPin,
  Calendar,
  Home,
  TrendingUp,
  ShieldCheck,
  GraduationCap,
  Footprints,
  Bus,
  Bike,
  Flame,
  Waves,
  AlertTriangle,
  DollarSign,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface PropertyDetailPanelProps {
  property: Property;
  onClose: () => void;
}

export function PropertyDetailPanel({
  property,
  onClose,
}: PropertyDetailPanelProps) {
  const { saveProperty, unsaveProperty, isPropertySaved, selectProperty } =
    usePropertyStore();
  const router = useRouter();
  const saved = isPropertySaved(property.id);
  const score = property.dealScore;

  function openAssistant() {
    selectProperty(property.id);
    router.push("/dashboard/agent");
  }

  function openTour() {
    selectProperty(property.id);
    router.push("/dashboard/tour?focus=selected");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header image */}
      <div className="relative h-52 shrink-0 overflow-hidden">
        {property.photos[0] ? (
          <Image
            src={property.photos[0]}
            alt={property.location.address}
            fill
            className="object-cover"
            sizes="384px"
          />
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center">
            <Home className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors backdrop-blur-sm"
        >
          <X className="w-4 h-4 text-white" />
        </button>
        <div className="absolute bottom-3 left-3 right-3">
          <div className="text-white font-bold text-xl">
            {formatFullPrice(property.price)}
          </div>
          <div className="flex items-center gap-1 text-white/80 text-sm mt-0.5">
            <MapPin className="w-3.5 h-3.5" />
            {property.location.address}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 py-2 border-b border-border flex gap-2">
        <Button
          variant={saved ? "default" : "outline"}
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => (saved ? unsaveProperty(property.id) : saveProperty(property.id))}
        >
          {saved ? (
            <BookmarkCheck className="w-3.5 h-3.5" />
          ) : (
            <Bookmark className="w-3.5 h-3.5" />
          )}
          {saved ? "Saved" : "Save"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={openAssistant}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Ask AI
        </Button>
      </div>
      <div className="px-3 pb-2 border-b border-border">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={openTour}
        >
          <Compass className="w-3.5 h-3.5" />
          Tour
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Key stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Beds", value: String(property.details.beds) },
              { label: "Baths", value: String(property.details.baths) },
              { label: "Sqft", value: property.details.sqft.toLocaleString() },
              { label: "Built", value: String(property.details.yearBuilt) },
              { label: "$/sqft", value: `$${Math.round(property.price / property.details.sqft)}` },
              { label: "DOM", value: `${property.daysOnMarket}d` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-secondary/50 rounded-lg p-2 text-center">
                <div className="text-sm font-semibold">{value}</div>
                <div className="text-[10px] text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          {/* Deal Score */}
          {score && (
            <div className={cn("rounded-xl border p-4 space-y-3", getDealScoreBg(score.total))}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "text-3xl font-black leading-none",
                      getDealScoreColor(score.total)
                    )}
                  >
                    {score.total}
                  </div>
                  <div>
                    <div className={cn("text-sm font-bold", getDealScoreColor(score.total))}>
                      {score.label}
                    </div>
                    <div className="text-xs text-muted-foreground">Helio Deal Score</div>
                  </div>
                </div>
                <TrendingUp className={cn("w-5 h-5", getDealScoreColor(score.total))} />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {score.summary}
              </p>
              <div className="space-y-2">
                {[
                  { label: "Value", value: score.breakdown.valueScore },
                  { label: "Location", value: score.breakdown.locationScore },
                  { label: "Condition", value: score.breakdown.conditionScore },
                  { label: "Momentum", value: score.breakdown.marketMomentumScore },
                  { label: "Risk", value: score.breakdown.riskScore },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-18 text-[11px] text-muted-foreground shrink-0">
                      {label}
                    </span>
                    <Progress value={value} className="flex-1 h-1.5" />
                    <span className="text-[11px] font-mono w-6 text-right text-muted-foreground">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              About this home
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {property.description}
            </p>
          </div>

          <Separator />

          {/* Neighborhood signals */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Neighborhood
            </h4>
            <div className="space-y-2">
              {property.walkScore !== undefined && (
                <ScoreRow icon={Footprints} label="Walk Score" value={property.walkScore} />
              )}
              {property.transitScore !== undefined && (
                <ScoreRow icon={Bus} label="Transit Score" value={property.transitScore} />
              )}
              {property.bikeScore !== undefined && (
                <ScoreRow icon={Bike} label="Bike Score" value={property.bikeScore} />
              )}
              {property.schoolRating !== undefined && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                    Schools
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">{property.schoolRating}/10</span>
                    <div className="flex">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-1.5 h-3 rounded-sm ml-0.5",
                            i < (property.schoolRating ?? 0)
                              ? "bg-primary"
                              : "bg-secondary"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Risk factors */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Risk factors
            </h4>
            <div className="space-y-2">
              <RiskRow
                icon={Waves}
                label="Flood risk"
                level={property.riskProfile.floodRisk}
              />
              <RiskRow
                icon={Flame}
                label="Fire risk"
                level={property.riskProfile.fireRisk}
              />
              <RiskRow
                icon={AlertTriangle}
                label="Earthquake risk"
                level={property.riskProfile.earthquakeRisk}
              />
            </div>
          </div>

          <Separator />

          {/* Financials */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Financial overview
            </h4>
            <div className="space-y-2">
              {property.estimatedValue && (
                <InfoRow
                  label="Estimated value (AVM)"
                  value={formatFullPrice(property.estimatedValue)}
                  highlight={
                    property.estimatedValue > property.price
                      ? "positive"
                      : property.estimatedValue < property.price * 0.95
                      ? "negative"
                      : undefined
                  }
                />
              )}
              {property.rentalEstimate && (
                <InfoRow
                  label="Est. rental income"
                  value={`${formatPrice(property.rentalEstimate)}/mo`}
                />
              )}
              {property.hoaFee !== undefined && property.hoaFee > 0 && (
                <InfoRow
                  label="HOA fee"
                  value={`${formatPrice(property.hoaFee)}/mo`}
                />
              )}
              {property.taxRate && (
                <InfoRow
                  label="Est. property tax"
                  value={`${formatFullPrice(Math.round(property.price * property.taxRate / 100))}/yr`}
                />
              )}
            </div>
          </div>

          {/* Market stats */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Market context
            </h4>
            <div className="space-y-2">
              <InfoRow
                label="Neighborhood median"
                value={formatFullPrice(property.neighborhoodStats.medianPrice)}
              />
              <InfoRow
                label="Avg. days on market"
                value={`${property.neighborhoodStats.avgDaysOnMarket} days`}
              />
              <InfoRow
                label="Price change YoY"
                value={`${property.neighborhoodStats.priceChangeYoY > 0 ? "+" : ""}${property.neighborhoodStats.priceChangeYoY}%`}
                highlight={property.neighborhoodStats.priceChangeYoY > 0 ? "positive" : "negative"}
              />
            </div>
          </div>

          {/* Tags */}
          {property.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {property.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs capitalize">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* CTA */}
          <Button
            className="w-full gap-2"
            onClick={openAssistant}
          >
            <MessageSquare className="w-4 h-4" />
            Ask Helio AI about this property
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
}

function ScoreRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  const color =
    value >= 80
      ? "text-emerald-400"
      : value >= 60
      ? "text-blue-400"
      : value >= 40
      ? "text-amber-400"
      : "text-red-400";

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm">
        <Icon className="w-4 h-4 text-muted-foreground" />
        {label}
      </div>
      <div className="flex items-center gap-2">
        <Progress value={value} className="w-20 h-1.5" />
        <span className={cn("text-sm font-medium w-6 text-right", color)}>
          {value}
        </span>
      </div>
    </div>
  );
}

function RiskRow({
  icon: Icon,
  label,
  level,
}: {
  icon: React.ElementType;
  label: string;
  level: "minimal" | "low" | "moderate" | "high";
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm">
        <Icon className="w-4 h-4 text-muted-foreground" />
        {label}
      </div>
      <span className={cn("text-sm font-medium", getRiskColor(level))}>
        {getRiskLabel(level)}
      </span>
    </div>
  );
}

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "positive" | "negative";
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-medium",
          highlight === "positive" && "text-emerald-400",
          highlight === "negative" && "text-red-400"
        )}
      >
        {value}
      </span>
    </div>
  );
}
