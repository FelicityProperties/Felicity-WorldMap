# Felicity Intelligence (WorldMap)

A real-time global intelligence dashboard built to track macro events, market shifts, and geopolitical movements — and translate them into actionable real estate opportunities in Dubai. This is not just data. This is decision-making power.

**Live:** https://felicity-world-map.vercel.app · Deploys automatically from `main`.

## Environment Variables (Vercel → Settings → Environment Variables)

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Powers Ask Felicity, country intel, stock AI briefs, and the Mon/Thu newsletter brief (Claude) |
| `RESEND_API_KEY` | Yes | All email: welcome, lead notifications, and the newsletter broadcast |
| `FINNHUB_API_KEY` | Yes | Live S&P 500 quotes, earnings, ratings |
| `FROM_EMAIL` | **Recommended** | Sender for all email, e.g. `Felicity Intelligence <intel@felicitypro.com>`. Without it, emails send from Resend's test address, which **only delivers to the Resend account owner**. Verify the domain in Resend → Domains first. |
| `OWNER_EMAIL` | No | Where lead/subscriber notifications go (default `mouhannad@felicitypro.com`) |
| `STRIPE_SECRET_KEY` | For payments | Stripe Checkout subscriptions |
| `STRIPE_WEBHOOK_SECRET` | For payments | Stripe webhook verification |
| `CRON_SECRET` | No | If set, `/api/brief` only accepts scheduled runs from Vercel Cron |
| `RESEND_AUDIENCE_ID` | No | Pin the newsletter audience; otherwise auto-resolved by name |
| `DATABASE_URL` | No | Neon Postgres for `/api/data`; hardcoded fallback used if absent |

## Dubai Market Data (PIX / PropertyIndex)

`js/pix-data.js` holds a snapshot of official **Dubai Land Department**
evidence modelled by [PropertyIndex](https://www.propertyindex.ae):

- **PIX Market Index** — residential / apartment / villa levels, YoY, MoM,
  median PSF, monthly transaction counts, plus a 13-month trend series.
- **Per-area registry medians** for all 19 tracked areas — median registered
  sale PSF, median registered price, median registered annual rent, and a
  **gross yield** computed as registered rent PSF ÷ registered sale PSF for
  the *same property-type cohort* in the *same community*, over the last 12
  complete months. Separate villa cohorts are carried where volume supports it.
- `buildDeskContext()` renders this into the system prompt for **both**
  Ask Felicity (`api/desk/ask.js`) and the newsletter brief (`api/brief.js`),
  so the AI quotes registry numbers rather than assuming market direction.

Card values marked **reg** are registered DLD evidence; **est** marks a
Felicity desk estimate used only where the registry has no rental evidence
in the window (currently Jumeirah, DIFC, Dubai Islands).

**Refreshing:** the snapshot is manual and dated. DLD data closes by calendar
month, so monthly is the natural cadence — ask Claude to "refresh the PIX
data" and it will re-query PropertyIndex and regenerate `js/pix-data.js`.
Update `PIX_AS_OF` and `PIX_WINDOW` when you do.

## Newsletter

Subscribers are stored in a Resend Audience ("Felicity Intelligence Brief").
A Vercel Cron (`vercel.json`) hits `/api/brief` every **Monday & Thursday
04:00 UTC (08:00 Dubai)**; Claude writes the brief and Resend broadcasts it
with per-contact unsubscribe links. Preview without emailing the list:
`GET /api/brief?test=1` (sends only to `OWNER_EMAIL`).

## Features

- **Interactive World Map** — Leaflet.js choropleth showing Country Instability Index (CII) scores for 100+ countries
- **Conflict Zone Tracking** — 14 active conflict zones with severity indicators
- **Live Flight Monitoring** — 15 tracked flights (commercial + military) with animated position updates
- **Maritime Tracking** — 11 vessels including cargo, tankers, and dark vessel detection
- **Market Ticker** — Real-time scrolling ticker with 8 major instruments (crypto, commodities, indices)
- **News Feed** — Categorized intelligence feed (Conflict, Politics, Markets, Energy)
- **Dubai RE Signals** — Geopolitical events translated into Dubai real estate opportunity signals
- **AI Intelligence Briefs** — Per-country intelligence summaries (requires Anthropic API key)
- **Modal System** — Proper modal dialogs replacing basic alerts
- **Responsive Design** — Desktop, tablet, and mobile layouts

## Tech Stack

- **HTML/CSS/JS** — Vanilla, no build tools required
- **Leaflet.js** — Interactive mapping
- **Inter + JetBrains Mono** — Typography (Google Fonts)
- **ES Modules** — Modular JavaScript architecture
- **CSS Custom Properties** — Full design token system
- **Neon PostgreSQL** — Serverless database for dashboard data
- **Vercel Serverless Functions** — API routes connecting frontend to Neon

## Project Structure

```
Felicity-WorldMap/
├── index.html              Main entry point
├── vercel.json             Vercel deployment config
├── package.json            Dependencies (@neondatabase/serverless)
├── api/
│   └── data.js             Vercel serverless function → Neon queries
├── db/
│   ├── schema.sql          Database table definitions
│   ├── seed.sql            Initial data population
│   └── setup.js            Script to run schema + seed on Neon
├── css/
│   ├── tokens.css          Design tokens (colors, spacing, typography)
│   ├── base.css            Reset, global styles, utilities
│   ├── layout.css          App grid, responsive breakpoints
│   ├── topbar.css          Header bar, ticker, logo
│   ├── nav.css             Navigation tabs
│   ├── map.css             Map container, overlays, Leaflet overrides
│   ├── sidebar.css         Sidebar, tabs, card components
│   ├── panels.css          Country panel, modal system
│   ├── statusbar.css       Bottom status bar
│   └── animations.css      Keyframes, transitions
├── js/
│   ├── app.js              Main init + orchestration
│   ├── data.js             Data layer (API fetch + hardcoded fallback)
│   ├── map.js              Leaflet map, GeoJSON, layers, markers
│   ├── sidebar.js          Tab switching, card rendering
│   ├── ticker.js           Market ticker logic
│   ├── panels.js           Country panel, modal system
│   └── utils.js            Clock, color helpers, formatting
└── assets/
    └── favicon.svg         Globe favicon
```

## Run Locally

No build step needed. Just serve the files:

```bash
npm install     # install dependencies (only needed once)
npm run dev     # serves at http://localhost:3000
```

The dashboard works fully with hardcoded data locally. When deployed to Vercel with a Neon database, it fetches live data from the API instead.

> **Note:** ES modules require a local server — opening `index.html` directly via `file://` won't work due to CORS restrictions.

## Deploy to Vercel + Neon

### 1. Create a Neon Database

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project and database
3. Copy your connection string (looks like `postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/dbname?sslmode=require`)

### 2. Seed the Database

```bash
DATABASE_URL="your-neon-connection-string" node db/setup.js
```

### 3. Deploy to Vercel

```bash
npm i -g vercel         # install Vercel CLI
vercel                  # deploy (follow prompts)
vercel env add DATABASE_URL  # add your Neon connection string as env var
vercel --prod           # deploy to production
```

Or connect your GitHub repo in the Vercel dashboard — it will auto-deploy on push.

### Architecture

```
Browser  →  Static HTML/CSS/JS (Vercel CDN)
             ↓ fetch('/api/data')
         →  Vercel Serverless Function (api/data.js)
             ↓ SQL queries
         →  Neon PostgreSQL
```

If the API is unavailable (local dev, no Neon), the frontend falls back to hardcoded data seamlessly.

## Design System

The dashboard uses a comprehensive design token system defined in `css/tokens.css`:

- **Dark theme** with deep backgrounds (#06080c → #141c2b)
- **Accent**: Cyan (#00d4ff) with glow effects
- **Glass-morphism** panels with backdrop-filter blur
- **4px spacing grid** with consistent scale
- **Semantic colors** for status indicators (red/green/amber/blue)

## License

Proprietary — Felicity Properties
