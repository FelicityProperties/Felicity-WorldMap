# Felicity WorldMap

A real-time global intelligence dashboard built to track macro events, market shifts, and geopolitical movements — and translate them into actionable real estate opportunities in Dubai. This is not just data. This is decision-making power.

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

## Project Structure

```
Felicity-WorldMap/
├── index.html              Main entry point
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
│   ├── data.js             All static data (CII scores, markets, etc.)
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
# Option 1: Python
python3 -m http.server 8000

# Option 2: Node.js
npx serve .

# Option 3: VS Code
# Install "Live Server" extension, right-click index.html → Open with Live Server
```

Then open `http://localhost:8000` in your browser.

> **Note:** ES modules require a local server — opening `index.html` directly via `file://` won't work due to CORS restrictions.

## Deployment

| Platform | Steps |
|----------|-------|
| **GitHub Pages** | Settings → Pages → Source: main branch, root folder |
| **Netlify** | Drag & drop the project folder, or connect the repo |
| **Vercel** | `npx vercel` from the project directory |
| **Any static host** | Upload all files maintaining directory structure |

## Design System

The dashboard uses a comprehensive design token system defined in `css/tokens.css`:

- **Dark theme** with deep backgrounds (#06080c → #141c2b)
- **Accent**: Cyan (#00d4ff) with glow effects
- **Glass-morphism** panels with backdrop-filter blur
- **4px spacing grid** with consistent scale
- **Semantic colors** for status indicators (red/green/amber/blue)

## License

Proprietary — Felicity Properties
