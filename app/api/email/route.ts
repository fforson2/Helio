import { NextRequest, NextResponse } from "next/server";
import { Property } from "@/types/property";
import { UserProfile } from "@/types/user";

export const runtime = "nodejs";

interface EmailRequest {
  email: string;
  properties: Property[];
  userProfile: UserProfile | null;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function generateAISummary(
  properties: Property[],
  userProfile: UserProfile | null
): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!groqKey && !openaiKey) {
    return defaultSummary(properties, userProfile);
  }

  const prefs = userProfile?.preferences;
  const isRenting = prefs?.listingType === "for_rent";

  const prompt = `Write a concise, ${
    isRenting ? "renter" : "buyer"
  }-focused property email summary. Be direct, analytical, and reference specific numbers. Cover for each property: deal-value assessment, key strength, key concern, and a one-sentence recommendation. End with a final ranking.

${
  prefs
    ? `User profile: ${
        isRenting ? "Renting" : "Buying"
      } | Budget $${prefs.minPrice?.toLocaleString()}–$${prefs.maxPrice?.toLocaleString()} | ${
        prefs.minBeds
      }+ beds | Must-haves: ${prefs.mustHaves?.join(", ") || "none"}\n\n`
    : ""
}Properties (${properties.length}):
${properties
  .map(
    (p, i) =>
      `${i + 1}. ${p.location.address}, ${p.location.neighborhood}
   Price: $${p.price.toLocaleString()} | AVM: $${
        p.estimatedValue?.toLocaleString() ?? "N/A"
      }
   ${p.details.beds}bd/${p.details.baths}ba · ${p.details.sqft.toLocaleString()} sqft · Built ${
        p.details.yearBuilt
      }
   Days on market: ${p.daysOnMarket} | Deal Score: ${
        p.dealScore?.total ?? "N/A"
      }/100 (${p.dealScore?.label ?? ""})
   School: ${p.schoolRating}/10 | Walk: ${p.walkScore} | Fire risk: ${
        p.riskProfile.fireRisk
      }`
  )
  .join("\n\n")}

Write 2–4 short paragraphs. No fluff.`;

  const formattedMessages = [{ role: "user" as const, content: prompt }];

  if (groqKey) {
    try {
      const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: formattedMessages,
            max_tokens: 700,
            temperature: 0.6,
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      }
    } catch {
      // fall through
    }
  }

  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
          messages: formattedMessages,
          max_tokens: 700,
          temperature: 0.6,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      }
    } catch {
      // fall through
    }
  }

  return defaultSummary(properties, userProfile);
}

function defaultSummary(
  properties: Property[],
  _userProfile: UserProfile | null
): string {
  const lines = properties.map((p) => {
    const score = p.dealScore?.total;
    const summary =
      p.dealScore?.summary ?? p.description.split(".").slice(0, 1).join(".");
    return `• ${p.location.address}, ${p.location.neighborhood} — $${p.price.toLocaleString()}${
      score ? ` (Deal Score ${score}/100)` : ""
    }. ${summary}`;
  });
  return `Here is a snapshot of ${properties.length} ${
    properties.length === 1 ? "property" : "properties"
  } from your Helio search:\n\n${lines.join("\n\n")}`;
}

function generateEmailHTML(
  properties: Property[],
  userProfile: UserProfile | null,
  aiSummary: string
): string {
  const isWatchlist = properties.length > 1;
  const title = isWatchlist
    ? `Watchlist Summary — ${properties.length} properties`
    : properties[0].location.address;

  const propertyRows = properties
    .map((p) => {
      const score = p.dealScore?.total;
      const scoreColor =
        (score ?? 0) >= 85
          ? "#10b981"
          : (score ?? 0) >= 70
          ? "#3b82f6"
          : (score ?? 0) >= 55
          ? "#f59e0b"
          : "#ef4444";
      return `
        <tr>
          <td style="padding:18px 20px;border-bottom:1px solid #e5e7eb;">
            <div style="font-size:16px;font-weight:700;color:#111827;margin-bottom:4px;">
              ${p.location.address}
            </div>
            <div style="font-size:13px;color:#6b7280;margin-bottom:10px;">
              ${p.location.neighborhood} · ${p.location.city}, ${p.location.state} ${p.location.zip}
            </div>
            <div style="display:inline-block;font-size:20px;font-weight:800;color:#111827;">
              $${p.price.toLocaleString()}
            </div>
            ${
              p.estimatedValue
                ? `<div style="display:inline-block;margin-left:12px;font-size:12px;color:${
                    p.estimatedValue >= p.price ? "#10b981" : "#ef4444"
                  };">
                AVM $${p.estimatedValue.toLocaleString()}
              </div>`
                : ""
            }
            <div style="margin-top:10px;font-size:13px;color:#374151;">
              ${p.details.beds}bd · ${p.details.baths}ba · ${p.details.sqft.toLocaleString()} sqft · Built ${p.details.yearBuilt}
            </div>
            <div style="margin-top:8px;font-size:12px;color:#6b7280;">
              ${p.daysOnMarket} days on market · School ${
        p.schoolRating ?? "—"
      }/10 · Walk Score ${p.walkScore ?? "—"}
            </div>
            ${
              score
                ? `
              <div style="margin-top:12px;display:inline-block;background:${scoreColor};color:#ffffff;padding:6px 12px;border-radius:8px;font-size:13px;font-weight:700;">
                Deal Score ${score} · ${p.dealScore?.label ?? ""}
              </div>
              <div style="margin-top:8px;font-size:13px;color:#4b5563;line-height:1.5;">
                ${p.dealScore?.summary ?? ""}
              </div>`
                : ""
            }
          </td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="padding:24px 28px;background:#0a0a0a;color:#ffffff;">
              <div style="font-size:22px;font-weight:900;letter-spacing:-0.5px;">
                Helio<span style="color:#3b82f6;">.</span>
              </div>
              <div style="font-size:12px;color:#9ca3af;margin-top:4px;">
                ${
                  userProfile?.name && userProfile.name !== "Guest"
                    ? `Prepared for ${userProfile.name} · `
                    : ""
                }${new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })}
              </div>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:28px 28px 8px 28px;">
              <div style="font-size:24px;font-weight:800;letter-spacing:-0.4px;color:#111827;">
                ${title}
              </div>
              <div style="font-size:13px;color:#6b7280;margin-top:6px;line-height:1.5;">
                ${
                  isWatchlist
                    ? `Snapshot of your saved properties on Helio.`
                    : "Property summary from your Helio search."
                }
              </div>
            </td>
          </tr>

          <!-- AI Analysis -->
          <tr>
            <td style="padding:18px 28px;">
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:18px;">
                <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6b7280;margin-bottom:10px;">
                  AI Analysis
                </div>
                <div style="font-size:14px;line-height:1.7;color:#1f2937;white-space:pre-wrap;">${aiSummary}</div>
              </div>
            </td>
          </tr>

          <!-- Properties -->
          <tr>
            <td style="padding:8px 28px 16px 28px;">
              <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6b7280;margin-bottom:4px;">
                ${isWatchlist ? "Properties" : "Listing Details"}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                ${propertyRows}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 28px;text-align:center;font-size:11px;color:#9ca3af;">
              Sent by Helio AI · For informational purposes only.<br>
              Not a substitute for professional real estate advice.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  let body: EmailRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { email, properties, userProfile } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError("A valid email address is required");
  }
  if (!properties || properties.length === 0) {
    return jsonError("At least one property is required");
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return jsonError(
      "Email is not configured. Add RESEND_API_KEY to .env.local to enable.",
      500
    );
  }

  const fromAddress =
    process.env.RESEND_FROM ?? "Helio <onboarding@resend.dev>";

  const aiSummary = await generateAISummary(properties, userProfile);
  const html = generateEmailHTML(properties, userProfile, aiSummary);

  const subject =
    properties.length === 1
      ? `Helio: ${properties[0].location.address} — Property Summary`
      : `Helio: Your watchlist summary (${properties.length} properties)`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return jsonError(
        `Email send failed: ${errText.slice(0, 200)}`,
        res.status
      );
    }

    const data = await res.json();
    return NextResponse.json({
      success: true,
      id: data.id,
      to: email,
      subject,
    });
  } catch (err) {
    return jsonError(
      `Email send failed: ${err instanceof Error ? err.message : "unknown"}`,
      500
    );
  }
}
