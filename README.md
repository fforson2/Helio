# Helio

**AI-powered real estate operating system. From search to signed — in one session.**

Built for the LA market. Combines interactive property search, a proprietary Deal Score engine, AI-powered comparison, voice-enabled chat, 3D cinematic property tours, AI-generated floor plans, and downloadable reports — all in a single unified interface.

---

## Quick Start

```bash
npm install
cp .env.local.example .env.local   # fill in your API keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui (dark, new-york) |
| Maps | Google Maps JavaScript API + Mapbox GL JS |
| AI — chat & analysis | Gemini 2.0 Flash + OpenAI GPT-4o |
| AI — image generation | OpenAI gpt-image-1 (floor plans) |
| AI — video generation | Google Veo 3.0 Fast (cinematic tours) |
| Voice — TTS | ElevenLabs |
| Voice — STT | Groq Whisper → OpenAI Whisper fallback |
| 3D rendering | Three.js + React Three Fiber + Drei |
| 3D models | Sketchfab embed (archetype selected by AI) |
| Image CDN | Cloudinary (hosting, floor plan persistence, tour snapshots) |
| Reports | jsPDF + html2canvas |
| Email | Resend |
| Animations | Framer Motion |

---

## Features

### Onboarding
- Buyer preference wizard — budget range, neighborhood selection, must-haves, lifestyle priorities
- Preferences persist across sessions and ground all AI features

### Property Search & Map
- **Google Maps view** — custom price markers color-coded by Deal Score, property selection panel
- **Mapbox view** — alternate vector-rendered map with 3D buildings
- **Search & filter** — price range, beds, baths, property type, days on market
- **AI intent parsing** — natural language search ("3BR under $1.2M near Silver Lake")

### Deal Score Engine
- Proprietary 0–100 score across five weighted factors:
  - Value 30% · Location 25% · Condition 20% · Market Momentum 15% · Risk 10%
- Full breakdown with label ("Great Deal", "Fair Value", etc.) and plain-language summary
- Powers map marker colors, property card badges, and comparison rankings

### Property Detail
- Full stats panel: beds, baths, sqft, year built, $/sqft, days on market
- Financial overview: AVM estimated value, rental estimate, HOA, property tax
- Neighborhood signals: Walk Score, Transit Score, Bike Score, school rating
- Risk profile: flood, fire, and earthquake risk levels
- Price history and market context (neighborhood median, YoY price change)

### Comparison
- Side-by-side table for up to 3 properties across 16 data points
- **AI-powered winner** — OpenAI analyzes candidates against buyer preferences and picks the best match with reasons and tradeoffs
- "Best match" badge on the winning column

### AI Assistant
- Chat-based Q&A grounded in the active search session and property context
- Gemini 2.0 Flash primary, OpenAI GPT-4o fallback
- **Voice input** via Groq Whisper (STT) and **voice responses** via ElevenLabs (TTS)

### Property Reports
- AI-generated property analysis with full listing context
- Downloadable as PDF (jsPDF + html2canvas)
- **Floor plan schematics** — OpenAI gpt-image-1 generates a 2D architectural blueprint per property
  - Saved permanently to Cloudinary (`helio/floor-plans/`) on first generation
  - Subsequent requests return instantly from Cloudinary — no OpenAI call needed

### 3D Property Tours
- **Three.js walkthrough** — procedurally generated interior tour built from property data
  - Zones: entry, living room, kitchen, bedrooms, pool, garage
  - Furniture grade adapts to price tier (basic / mid / luxury)
  - Color palette and ceiling height derived from year built and sqft
  - CatmullRom spline camera path with play/pause and fullscreen controls
- **Sketchfab mode** — AI selects the best-matching 3D model archetype and embeds an interactive Sketchfab viewer
- **Tour narration** — ElevenLabs TTS plays an AI-written audio description synchronized to the walkthrough
- **Save to Cloudinary** — one-click snapshot of any 3D frame saved to `helio/tours/`

### Cloudinary Image CDN
- All property images served via `CldImage` with automatic WebP conversion and CDN delivery
- `deliveryType="fetch"` proxies and caches external images through Cloudinary's global CDN
- Floor plans and tour screenshots stored permanently with stable, shareable URLs

### Email Export
- AI-generated property summary emailed via Resend
- Includes shortlisted properties, Deal Scores, and buyer preference match reasoning

---

## API Routes

| Route | Description |
|---|---|
| `POST /api/chat` | AI chat — Gemini 2.0 Flash → OpenAI fallback |
| `POST /api/compare` | AI comparison winner with reasons and tradeoffs |
| `POST /api/email` | Email property summary via Resend |
| `POST /api/report` | Generate HTML/PDF property report |
| `POST /api/schematic` | Floor plan generation → Cloudinary upload |
| `POST /api/tts` | Text-to-speech via ElevenLabs |
| `POST /api/stt` | Speech-to-text via Groq → OpenAI fallback |
| `POST /api/tour/generate` | Veo 3.0 cinematic video tour generation |
| `POST /api/tour/screenshot` | Save Three.js frame to Cloudinary |
| `GET  /api/tour/description` | AI-written tour narration text |
| `GET  /api/tour/renderer` | Select tour mode (Three.js vs Sketchfab) |
| `GET  /api/listings/search` | Property search with filters |
| `GET  /api/listings/[id]` | Single property details |
| `GET  /api/agents/search` | Real estate agent search |
| `GET  /api/search/intent` | Natural language intent parsing |

---

## Environment Variables

```env
# Maps
NEXT_PUBLIC_MAPBOX_TOKEN=             # Mapbox GL JS

# AI — text
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# AI — image & video
OPENAI_IMAGE_MODEL=gpt-image-1        # Floor plan schematics

# Voice
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
GROQ_API_KEY=                         # Fast Whisper STT

# Cloudinary (image CDN + persistence)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Email
RESEND_API_KEY=
RESEND_FROM=


```

Everything runs without API keys — the map shows a placeholder, AI features return formatted demo responses, and reports use the listing description as analysis.

---

