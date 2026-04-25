import { NextRequest, NextResponse } from "next/server";
import { getPropertyContext } from "@/lib/server/listings";
import { generateNarrative } from "@/lib/server/ai";
import { UserProfile } from "@/types/user";

export const runtime = "nodejs";

interface ReportRequest {
  propertyId: string;
  searchSessionId?: string | null;
  userProfile: UserProfile | null;
}

function generateReportHTML(property: NonNullable<ReturnType<typeof getPropertyContext>>["property"], userProfile: UserProfile | null, aiAnalysis: string): string {
  const score = property.dealScore;
  const scoreColor =
    (score?.total ?? 0) >= 85
      ? "#34d399"
      : (score?.total ?? 0) >= 70
        ? "#60a5fa"
        : (score?.total ?? 0) >= 55
          ? "#fbbf24"
          : "#f87171";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Helio Report — ${property.location.address}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #f1f1f1; line-height: 1.6; }
  .container { max-width: 800px; margin: 0 auto; padding: 40px 24px; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #222; }
  .logo { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #fff; }
  .logo span { color: #60a5fa; }
  .date { font-size: 12px; color: #666; }
  .property-hero { background: #111; border: 1px solid #222; border-radius: 16px; padding: 28px; margin-bottom: 28px; }
  .property-address { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
  .property-meta { color: #888; font-size: 14px; margin-top: 6px; }
  .property-price { font-size: 32px; font-weight: 900; margin-top: 12px; color: #60a5fa; }
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 20px; }
  .stat { background: #1a1a1a; border-radius: 10px; padding: 14px; text-align: center; }
  .stat-value { font-size: 18px; font-weight: 700; }
  .stat-label { font-size: 11px; color: #666; margin-top: 2px; }
  .score-card { background: #111; border: 1px solid #222; border-radius: 16px; padding: 28px; margin-bottom: 28px; }
  .score-header { display: flex; align-items: center; gap: 20px; }
  .score-big { font-size: 72px; font-weight: 900; line-height: 1; color: ${scoreColor}; }
  .score-label { font-size: 20px; font-weight: 700; color: ${scoreColor}; }
  .score-sub { font-size: 12px; color: #666; margin-top: 2px; }
  .score-summary { font-size: 14px; color: #aaa; margin-top: 16px; line-height: 1.7; }
  .breakdown { margin-top: 20px; display: grid; gap: 10px; }
  .breakdown-row { display: flex; align-items: center; gap: 12px; }
  .breakdown-label { width: 100px; font-size: 12px; color: #888; }
  .bar-track { flex: 1; height: 6px; background: #222; border-radius: 3px; }
  .bar-fill { height: 100%; border-radius: 3px; background: ${scoreColor}; }
  .breakdown-value { width: 30px; text-align: right; font-size: 12px; color: #888; font-family: monospace; }
  .section { background: #111; border: 1px solid #222; border-radius: 16px; padding: 28px; margin-bottom: 28px; }
  .section-title { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 20px; }
  .info-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #1a1a1a; font-size: 14px; }
  .info-row:last-child { border: none; }
  .info-label { color: #888; }
  .positive { color: #34d399; }
  .negative { color: #f87171; }
  .ai-analysis { font-size: 14px; line-height: 1.8; color: #bbb; white-space: pre-wrap; }
  .footer { text-align: center; font-size: 11px; color: #444; margin-top: 40px; padding-top: 24px; border-top: 1px solid #111; }
  @media print { body { background: white; color: black; } }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">Helio<span>.</span></div>
    <div class="date">
      ${userProfile?.name ? `Prepared for ${userProfile.name} · ` : ""}
      ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
    </div>
  </div>

  <div class="property-hero">
    <div class="property-address">${property.location.address}</div>
    <div class="property-meta">${property.location.neighborhood} · ${property.location.city}, ${property.location.state} ${property.location.zip}</div>
    <div class="property-price">$${property.price.toLocaleString()}</div>
    <div class="stats-grid">
      <div class="stat"><div class="stat-value">${property.details.beds}</div><div class="stat-label">Bedrooms</div></div>
      <div class="stat"><div class="stat-value">${property.details.baths}</div><div class="stat-label">Bathrooms</div></div>
      <div class="stat"><div class="stat-value">${property.details.sqft.toLocaleString()}</div><div class="stat-label">Sq Ft</div></div>
      <div class="stat"><div class="stat-value">${property.details.yearBuilt}</div><div class="stat-label">Year Built</div></div>
      <div class="stat"><div class="stat-value">$${Math.round(property.price / property.details.sqft)}</div><div class="stat-label">Per Sq Ft</div></div>
      <div class="stat"><div class="stat-value">${property.daysOnMarket}d</div><div class="stat-label">Days on Market</div></div>
    </div>
  </div>

  ${score ? `
  <div class="score-card">
    <div class="section-title">Helio Deal Score</div>
    <div class="score-header">
      <div class="score-big">${score.total}</div>
      <div>
        <div class="score-label">${score.label}</div>
        <div class="score-sub">out of 100</div>
      </div>
    </div>
    <p class="score-summary">${score.summary}</p>
    <div class="breakdown">
      ${Object.entries({
        Value: score.breakdown.valueScore,
        Location: score.breakdown.locationScore,
        Condition: score.breakdown.conditionScore,
        Momentum: score.breakdown.marketMomentumScore,
        Risk: score.breakdown.riskScore,
      })
        .map(
          ([label, value]) => `
      <div class="breakdown-row">
        <span class="breakdown-label">${label}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${value}%"></div></div>
        <span class="breakdown-value">${value}</span>
      </div>`
        )
        .join("")}
    </div>
  </div>
  ` : ""}

  <div class="section">
    <div class="section-title">AI Analysis</div>
    <div class="ai-analysis">${aiAnalysis}</div>
  </div>

  <div class="section">
    <div class="section-title">Property Details</div>
    <div class="info-row"><span class="info-label">Type</span><span>${property.details.propertyType.replace("_", " ")}</span></div>
    <div class="info-row"><span class="info-label">Lot size</span><span>${property.details.lotSqft?.toLocaleString() ?? "—"} sqft</span></div>
    <div class="info-row"><span class="info-label">Garage</span><span>${property.details.garage ? "Yes" : "No"}</span></div>
    <div class="info-row"><span class="info-label">Pool</span><span>${property.details.pool ? "Yes" : "No"}</span></div>
    ${property.hoaFee ? `<div class="info-row"><span class="info-label">HOA Fee</span><span>$${property.hoaFee.toLocaleString()}/month</span></div>` : ""}
  </div>

  <div class="section">
    <div class="section-title">Financial Overview</div>
    ${property.estimatedValue ? `<div class="info-row"><span class="info-label">Estimated Value (AVM)</span><span class="${property.estimatedValue > property.price ? "positive" : "negative"}">$${property.estimatedValue.toLocaleString()}</span></div>` : ""}
    ${property.rentalEstimate ? `<div class="info-row"><span class="info-label">Estimated Rental Income</span><span>$${property.rentalEstimate.toLocaleString()}/mo</span></div>` : ""}
    ${property.taxRate ? `<div class="info-row"><span class="info-label">Est. Annual Property Tax</span><span>$${Math.round((property.price * property.taxRate) / 100).toLocaleString()}</span></div>` : ""}
    <div class="info-row"><span class="info-label">Neighborhood Median Price</span><span>$${property.neighborhoodStats.medianPrice.toLocaleString()}</span></div>
    <div class="info-row"><span class="info-label">Price Trend (YoY)</span><span class="${property.neighborhoodStats.priceChangeYoY > 0 ? "positive" : "negative"}">${property.neighborhoodStats.priceChangeYoY > 0 ? "+" : ""}${property.neighborhoodStats.priceChangeYoY}%</span></div>
  </div>

  <div class="section">
    <div class="section-title">Neighborhood & Risk</div>
    ${property.walkScore !== undefined ? `<div class="info-row"><span class="info-label">Walk Score</span><span>${property.walkScore}/100</span></div>` : ""}
    ${property.transitScore !== undefined ? `<div class="info-row"><span class="info-label">Transit Score</span><span>${property.transitScore}/100</span></div>` : ""}
    ${property.schoolRating !== undefined ? `<div class="info-row"><span class="info-label">School Rating</span><span>${property.schoolRating}/10</span></div>` : ""}
    <div class="info-row"><span class="info-label">Fire Risk</span><span>${property.riskProfile.fireRisk}</span></div>
    <div class="info-row"><span class="info-label">Flood Risk</span><span>${property.riskProfile.floodRisk}</span></div>
    <div class="info-row"><span class="info-label">Earthquake Risk</span><span>${property.riskProfile.earthquakeRisk}</span></div>
  </div>

  <div class="footer">
    Report generated by Helio AI · ${new Date().toLocaleString()} · For informational purposes only. Not a substitute for professional real estate advice.
  </div>
</div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const { propertyId, userProfile }: ReportRequest = await req.json();
  const context = getPropertyContext(propertyId);

  if (!context) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const property = context.property;
  const analysisPrompt = `Write a professional property analysis report section for this listing. Be specific, analytical, and buyer-focused. Cover deal value, strengths, concerns, neighborhood context, and a final recommendation.

Property: ${property.location.address}, ${property.location.neighborhood}
Price: $${property.price.toLocaleString()} | AVM: $${property.estimatedValue?.toLocaleString() ?? "N/A"}
${property.details.beds}bd/${property.details.baths}ba | ${property.details.sqft.toLocaleString()} sqft | Built ${property.details.yearBuilt}
Days on market: ${property.daysOnMarket} | Neighborhood avg: ${property.neighborhoodStats.avgDaysOnMarket} days
Deal Score: ${property.dealScore?.total ?? "N/A"}/100 (${property.dealScore?.label ?? ""})
Neighborhood summary: ${context.neighborhoodSummary}
Market position: ${context.marketPosition}
Buyer profile: ${userProfile?.preferences ? `Budget $${userProfile.preferences.minPrice?.toLocaleString()}-$${userProfile.preferences.maxPrice?.toLocaleString()}, needs ${userProfile.preferences.minBeds}+ beds` : "Not provided"}

Write 3-4 focused paragraphs. Be direct and honest.`;

  const aiAnalysis = await generateNarrative({
    prompt: analysisPrompt,
    fallback: `${property.description}\n\n${context.neighborhoodSummary}\n${context.marketPosition}`,
  });

  const html = generateReportHTML(property, userProfile, aiAnalysis);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="helio-report-${property.id}.html"`,
    },
  });
}
