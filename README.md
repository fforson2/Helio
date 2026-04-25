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
| Maps | Google Maps JavaScript API |
| AI (search + analysis) | Gemini 2.0 Flash + OpenAI GPT-4o-mini |
| Reports | Server-side HTML generation |
| Data | SQLite-backed listing/session cache seeded from demo properties |

## Features

### Phase 1 (live)
- **Onboarding wizard** — buyer preferences, budget range, neighborhood selection, must-haves
- **Interactive map** — Google Maps with custom price markers color-coded by Deal Score (shows map placeholder without an API key)
- **Property list** — filterable by price, beds, baths, and type
- **Property detail panel** — full stats, Deal Score breakdown, risk profile, financial overview

### Phase 2 (live)
- **Helio Deal Score** — 0-100 score across Value (30%), Location (25%), Condition (20%), Momentum (15%), Risk (10%)
- **Comparison view** — side-by-side table for up to 3 properties, best-match badge
- **Saved shortlist** — bookmark properties, accessible from nav

### Phase 3 (live)
- **AI Assistant** — chat-based Q&A grounded in the active search session and neighborhood context; uses Gemini first, falls back to OpenAI
- **Property reports** — downloadable HTML reports with server-fetched property context and AI-generated analysis

## Environment Variables

```env
# Required for live map (Google Maps JavaScript API)
NEXT_PUBLIC_GOOGLE_MAPS_KEY=
# Optional: required for true 3D buildings + tilt/heading. Create a Map ID in
# Google Cloud Console → Map Management with the Vector renderer enabled.
# Without it, the 3D toggle falls back to tilted satellite imagery.
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=

# Required for AI features (at least one)
GEMINI_API_KEY=
OPENAI_API_KEY=

# Optional model overrides
GEMINI_MODEL=gemini-2.0-flash
OPENAI_MODEL=gpt-4o-mini

# Optional (Text-to-Speech)
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
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
  map/               # Google Maps view + filters + search view
  property/          # Property cards, detail panel, saved view
  compare/           # Side-by-side comparison table
  assistant/         # Chat UI
  reports/           # Report generation UI
lib/
  demo-properties.ts # 8 rich LA properties used to seed SQLite
  deal-score.ts      # Deal Score computation engine
  search-client.ts   # Client helpers for intent + listing search
  server/            # SQLite-backed listings/search/AI helpers
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
