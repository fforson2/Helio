# Helio

**AI-powered real estate operating system. From search to signed — in one session.**

Built for the LA market. Combines interactive property search, a proprietary Deal Score engine, side-by-side comparison, an AI chat assistant, and downloadable property reports.

## Quick Start

```bash
npm install
cp .env.local.example .env.local   # fill in your API keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 App Router + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui (dark, new-york) |
| State | Zustand (persisted) |
| Maps | Mapbox GL JS |
| AI (fast) | Groq LLaMA 3.3 70B |
| AI (rich) | OpenAI GPT-4o-mini |
| Reports | Server-side HTML generation |
| Data | Demo seed + live APIs optional |

## Features

### Phase 1 (live)
- **Onboarding wizard** — buyer preferences, budget range, neighborhood selection, must-haves
- **Interactive map** — Mapbox GL with property pins color-coded by Deal Score (shows map placeholder without token)
- **Property list** — filterable by price, beds, baths, and type
- **Property detail panel** — full stats, Deal Score breakdown, risk profile, financial overview

### Phase 2 (live)
- **Helio Deal Score** — 0-100 score across Value (30%), Location (25%), Condition (20%), Momentum (15%), Risk (10%)
- **Comparison view** — side-by-side table for up to 3 properties, best-match badge
- **Saved shortlist** — bookmark properties, accessible from nav

### Phase 3 (live)
- **AI Assistant** — chat-based Q&A grounded in actual property data; uses Groq first, falls back to OpenAI
- **Property reports** — downloadable HTML reports with AI-generated analysis section; graceful fallback without API keys

## Environment Variables

```env
# Required for live map
NEXT_PUBLIC_MAPBOX_TOKEN=

# Required for AI features (at least one)
GROQ_API_KEY=         # preferred — faster and free tier
OPENAI_API_KEY=       # fallback

# Optional
OPENAI_MODEL=gpt-4o-mini
```

Everything works without API keys — the map shows a placeholder, AI chat returns a formatted demo response, and reports use the listing description as the analysis.

## Project Structure

```
app/
  onboarding/        # Buyer preference wizard
  dashboard/         # Main app shell + tab routing
  api/chat/          # AI chat endpoint (Groq → OpenAI fallback)
  api/report/        # Report generation endpoint
components/
  layout/            # Nav bar
  map/               # Mapbox map + filters + search view
  property/          # Property cards, detail panel, saved view
  compare/           # Side-by-side comparison table
  assistant/         # Chat UI
  reports/           # Report generation UI
lib/
  demo-properties.ts # 8 rich LA properties with full data
  deal-score.ts      # Deal Score computation engine
  store.ts           # Zustand stores (property, user, chat, UI)
  format.ts          # Display formatters
types/
  property.ts        # Normalized property schema
  user.ts            # Buyer profile + preferences
  session.ts         # Chat session + messages
```

## Demo Data

8 pre-seeded LA properties covering:
- Beachwood Canyon, Silver Lake, Venice, Santa Monica (NOM), Hollywood Hills, Valley Village, Downtown LA, Culver City
- Price range: $699K – $4.8M
- Every property has a pre-computed Deal Score with breakdown and summary

## Roadmap

- [ ] Live listing API integration (RentCast, Zillow)
- [ ] Supabase persistence for saved properties and sessions
- [ ] LiveKit voice assistant
- [ ] 3D property environment viewer (Three.js)
- [ ] Knowledge graph visualization
- [ ] Offer letter / document generation
- [ ] Agent portal + shared session rooms
