# Felicity Intelligence — Working Rules

## DATA INTEGRITY — THE STANDING RULE

**Never invent, estimate, or infer Dubai real-estate numbers. Ever.**

All Dubai market figures — prices, PSF, rents, yields, transaction counts,
market direction, signals — MUST come from **PropertyIndex (PIX)**, which
serves official **Dubai Land Department** registered-transaction evidence.
The account has **PIX© Pro**, so prices, sizes, PSF, rents, yields, tiers,
and signal magnitudes are all unlocked.

When asked for Dubai market data:

1. **Query PropertyIndex first.** Tools: `mcp__PropertyIndex__search`,
   `fetch`, `get_market_index`, `get_projects`, `propertyindex_query`,
   `propertyindex_catalog`. Never answer from memory or reasoning.
2. **If PropertyIndex is unreachable, say so.** Do not fall back on a
   plausible-sounding number. An honest "the connector is down" beats a
   fabricated figure every time.
3. **Label every figure** with its source, as-of date, and window.
   Registry values carry a `reg` marker in the UI; anything else carries
   `est` and must be visibly distinguishable.
4. **Never present an estimate as evidence.** If the registry has no
   coverage (e.g. too few registered rentals to compute a yield), show
   "unavailable" — do not fill the gap.
5. **Match cohorts.** Never divide apartment rents by villa sale prices.
   Compute yields within the same property type and same community over
   the same window.
6. **Preserve units and precision** (AED, AED/sqft, AED/year, %) and cite
   the absolute PropertyIndex URLs the tools return.

### Where the data lives

| File | Contents | Refresh |
|---|---|---|
| `js/pix-data.js` | PIX market index, 13-month series, per-area registry medians (PSF, price, rent, gross yield), villa cohorts | Monthly — DLD closes by calendar month |
| `js/pix-signals.js` | Real detected market signals (top sales, record PSF, yield leaders, discount trades) with detection dates | Weekly or on request |

Both files carry `*_AS_OF` constants. **Update them whenever you refresh**,
and re-run the verification below.

`buildDeskContext()` (pix-data.js) and `buildSignalContext()` (pix-signals.js)
are the single source of truth injected into the system prompts of **both**
`api/desk/ask.js` (Ask Felicity) and `api/brief.js` (Mon/Thu newsletter).
Refreshing the data files automatically updates what the AI says — never
hardcode market numbers into a prompt.

### Refresh procedure

When the user says "refresh the PIX data":

1. `get_market_index` for residential / apartment / villa (13+ months).
2. `propertyindex_query` on `sales` grouped by `community` (+ `property_type`)
   for median `sale_psf`, `sale_price`, `size_sqft` over the last 12 complete months.
3. Same on `rentals` for median `annual_rent`, `annual_rent_psf`.
4. Compute yield = rent PSF ÷ sale PSF, **cohort-matched**.
5. `propertyindex_query` on `signals` ordered by `score` for the live signal feed.
6. Rewrite `js/pix-data.js` and `js/pix-signals.js`, bump the AS_OF constants.
7. Verify, commit, push to `main` (Vercel auto-deploys).

Things the Sep 2026 refresh learned, so the next one does not relearn them:

- **Sales are windowed on `sale_date`; rentals on `registration_date`.**
  Using one for the other is rejected by the catalog.
- **Re-pull the whole 13-month series.** PropertyIndex restates history
  as late registrations land (Dec 2025 went from 223.2 to 219.2 between
  refreshes). Never append the new month to the old series.
- **Master-community boundaries move.** Expo City, Dubai Islands, MBR
  City and Meydan were once sub-scopes of other communities; they are
  now their own DLD communities. Confirm every `scope` label against the
  `projects` entity (`location_kind eq community`) and use the canonical
  `/dubai/<slug>` URLs it returns.
- **DIFC has no DLD coverage** (it runs its own register). It is left
  out of `pixAreas` on purpose so the card shows an `est` desk figure
  instead of a registry number that does not exist.
- **Jumeirah's apartment yield is not a yield.** Its apartment sales are
  brand-new ultra-prime stock and its apartment tenancies are old
  low-rise units, so the cohort-matched division yields ~1.6% and means
  nothing. The villa cohort is shown instead, with a note saying why.
- **The signal engine has more types than the four we started with.**
  `momentum` (3-month sales velocity), `psf_move` and `below_trend` now
  dominate the feed; `community_spotlight`, `daily_digest` and
  `pix_print` are summaries, not events, and are not shown. Each type
  has its own `value`/`baseline`/`magnitude` semantics — the header of
  `pix-signals.js` spells them out; read it before adding a type.
  Magnitudes arrive as fractions (0.3012) and are stored as percent.
- **Momentum flags parent projects and their buildings separately.**
  Keep the parent only, or the same registrations count twice.

### The AI is only allowed numbers it was handed

The first August test brief was audited line by line against the evidence.
Every registry figure was right. Three things were not, and all three were
the prompt's fault, not the model's:

1. **The macro section was written from memory.** "Fed on hold, dollar
   funding sticky, oil range-bound" — no level, date or headline had been
   supplied, so the model narrated the world it remembered. Now
   `lib/market-evidence.js` fetches nine benchmarks (DXY, VIX, US 10Y and
   3M, S&P 500, Brent, WTI, gold, BTC) from Yahoo plus Finnhub general
   headlines, and the block is injected into **both** `api/brief.js` (fresh
   per run) and `api/desk/ask.js` (5-minute cache). A benchmark that fails
   is listed as *unavailable* with an instruction to say nothing about it;
   the brief's test response reports `macroEvidence: "9/9 benchmarks live"`
   so an outage is visible, not papered over.
2. **The prompts demanded invented history.** "Every thesis cites a
   historical analog: 'Last time X happened, Y moved Z%'" produced "fell
   another 12-18% before basing" and "repriced +30-40%" — numbers from
   nowhere, in an email to paying subscribers. That line is gone from
   `brief.js`, `desk/ask.js`, `intel.js` and `stocks/[action].js`. Analogs
   are allowed in words; a percentage, AED figure or date may only be
   attached if it appears in the evidence. `api/intel.js` was worse — it
   told the model to "use exact numbers: GDP growth %, inflation rate,
   debt-to-GDP" with no data feed at all, and to "cite actual DLD
   transaction volumes" with no DLD evidence injected. It now says plainly
   that no country feed exists, and carries the PIX blocks for the Dubai
   side.
3. **It ranked by eye.** It called Dubai South's 4.8% "the highest villa
   yield in our entire register"; JVC's 5.2% was two lines up. Ranking is a
   computation, so `buildDeskContext()` now computes and prints the
   apartment and villa yield rankings, and the prompts say to use them
   before writing "highest" or "lowest".

Two more lessons from the second and third test briefs:

- **Fetch shape is part of correctness.** The first macro block fired nine
  per-symbol Yahoo requests at once and got one back ("1/9 benchmarks
  live"). `api/markets.js` had already learned this: one batch quote
  request, then a throttled per-symbol fallback only for misses, one retry
  on a 429. `lib/market-evidence.js` now does the same, and the test
  response lists `macroMissing` with each failure's reason so the next
  outage is diagnosed from the response, not inferred.
- **Units travel with the number.** With the full block in hand the model
  wrote "Brent AED 109.61/bbl" (the prompt talks AED everywhere else) and
  "10Y +3.52% on the day" (a percentage of a percentage). Each level is now
  rendered as `USD 109.61 per barrel`, and yield moves in basis points.

The pattern to keep: **fetch the evidence first, hand the model only that,
and tell it a number that is not in the block does not exist.** When a
prompt says "quantify everything", the evidence must contain everything it
could quantify — otherwise "quantify" means "invent".

To audit a test brief: trigger `/api/brief?test=1`, read the email that
lands (Gmail is connected), and check every number against
`buildDeskContext()`, `buildSignalContext()` and the macro block.
`tests/brief.test.mjs` (`npm test`) covers the code path with stubbed
upstreams; only a real send covers the model.

### What is still a desk opinion (and must stay labeled)

`dubaiAreas` in `js/data.js` carries `sentiment`, `priceDirection`,
`demandStrength`, `investorOutlook`, `opportunityScore` and the prose
descriptions. These are **Felicity desk assessments, not registry data**.
They are fine to keep — an intelligence product is allowed a view — but they
must never be presented as measured evidence, and any numeric field that PIX
can source should be migrated to PIX.

**A desk opinion may not contain a number the register does not hold.**
`js/prompts.js` once rendered the Overview's Active Calls with "JVC yield
7.2% vs prime 4.8%" (register: 6.1% and 3.4%), "DIFC rents up 18% YoY"
(no DIFC rents exist), and a Historical Playbook of "Prime +42% in 18
months"-style figures nobody could source. Now every number in a call is
read from `pixAreas` / `pixIndex` / `pixSignals` at load time and carries
a `reg` marker, the section subtitle says which parts are opinion, and
the playbook carries **directions only** — "prime fell hard; recovery
took years" — because no registered series exists for those years.
`tests/desk-view.test.mjs` asserts every number in a call appears in the
registry files and that the playbook holds no percentage at all.

`server.js` (the local dev host) used to carry its own copies of the
intel and stock-brief prompts, which drifted from `api/`. It now mounts
every `api/**/*.js` at its Vercel route and owns no prompt.

### Strait of Hormuz — what the page may claim

The Hormuz tab (`js/hormuz.js`, `lib/hormuz.js`, `/api/invest/hormuz`)
shows the **IMF PortWatch "Daily Chokepoints Transit Calls"** series for
`portid='chokepoint6'`, pulled from the public ArcGIS layer on
`services9.arcgis.com`. It is the only free, keyless, machine-readable
daily Hormuz series that exists; the research that established this is
in the session that built the page, and the alternatives (aisstream.io,
AISHub, MarineTraffic, Kpler, EIA, UKMTO, WTO, IEA) were each rejected
for coverage, licence, or not being a feed.

What the number is, and the rules that follow from it:

- **AIS-visible transit calls per UTC day.** A ship with its transponder
  off is invisible to it; during the 2026 crisis UKMTO's weekly reports
  put most Hormuz movements outside AIS. So every figure is a **floor**,
  and the page and the AI blocks say so. Never write "ships in the
  Strait".
- **Not today.** The daily series is published **weekly** with a lag of
  days, and recent rows are revised. The headline carries the date of
  the last row and its age; the subtitle says "published weekly,
  revised". No live dot, no ticking clock, no Refresh button (the
  endpoint is edge-cached for an hour and the feed changes weekly). The
  whole window is re-pulled every time — never append.
- **There is no honest live layer.** No free, licensed real-time count
  exists for a serverless function. The page states this in words. Do
  not add an aisstream/AIS-sample counter: the open-source trackers on
  that feed saw zero vessels in the Strait, its licence is unpublished,
  and datacenter connections are dropped.
- **Capacity is deadweight tonnage**, never barrels. Do not convert.
- **Means are ours.** 7-day and 30-day means, the year-earlier window
  and the 365-day high/low are Felicity arithmetic over the rows
  served, carry a `felicity calc` marker, and leave missing days
  missing. The `integrity` block in the payload reports rows received,
  parsed, dropped, duplicates, gaps and rows where total ≠ tankers +
  cargo — upstream mismatches are kept as served and counted, never
  corrected.
- **Attribution is required by the IMF terms:** "Source: International
  Monetary Fund, PortWatch, https://portwatch.imf.org/pages/chokepoint6"
  travels in the payload and is printed on the page.
- **The date field has changed format** (epoch ms → YYYY-MM-DD string);
  `parseDate` accepts both and prefers the integer year/month/day
  columns. A schema change (missing `n_total` etc.) fails loudly with the
  fields seen rather than rendering nonsense.
- **Stale path:** the browser keeps the last successful pull; if the
  fetch fails it is shown under a `STALE` banner with the failure time
  and the pull time. With nothing stored the page says unavailable.

The same block is injected into the brief and the desk prompts as
"STRAIT OF HORMUZ — IMF PortWatch daily transit calls"; when the fetch
fails the block says so and forbids any Hormuz figure. The brief's test
response reports `hormuzEvidence`.

**Persistence and the daily cron.** Every successful pull is stored in
Postgres (`hormuz_snapshots`, created on demand, last 30 kept). When
PortWatch fails, `/api/invest/hormuz` serves the stored pull with
`stale: true`, `staleAt` and `staleReason`, **uncached** — the first
version edge-cached its own failures for an hour, which the adversarial
review caught. `vercel.json` runs `/api/invest/hormuz?refresh=1` daily at
05:00 UTC so the stored copy trails the layer by at most a day.

**The live wire.** `/api/invest/hormuz-wire` is the part of the page that
is genuinely live: front-month Brent and WTI (Yahoo, same `quoteYahoo`
as the cockpit) and the newest online headlines mentioning "Strait of
Hormuz" (GDELT DOC 2.0, refreshed by GDELT every 15 minutes, served with a
10-minute edge cache, polled every 10 minutes while the page is visible
through the `startPolling` pair). It carries a LIVE badge with its fetch
time because it *is* live. It is labelled as oil and press, never as a
ship count. Do not let "live" leak from the wire onto the transit series.

Lessons from the review of the first version: the 7-day mean on the
chart must look back through the full series (not just the drawn range,
or the first week of every range is a 1-to-6-day mean); age is computed
at render time from the row date, never copied from a stored payload;
the year-earlier window is calendar-based (`oneYearBefore`, leap-safe)
and only compared when both windows have ≥20 days present; a lone data
day between gaps gets a dot; the unit is "transits", never "ships"; and
only a fixed reason category — never raw upstream text — reaches the AI
prompt.

`tests/hormuz.test.mjs` pins the parsing (both date formats, y/m/d
precedence), the integrity accounting, every summary number by hand, the
route's failure paths and the evidence text. The sandbox cannot reach
ArcGIS, so the first real check after any change to `lib/hormuz.js` is
to load the tab on the deployed site and read the integrity line.

### Global markets (the Investing Cockpit)

The same integrity rule applies outside Dubai. Every price and headline in
the Invest tab is fetched live, server-side, from a real provider — nothing
is simulated:

| Asset class | Live source | Route |
|---|---|---|
| US equities | Finnhub `/quote`, `/company-news` | `api/invest/[action].js` |
| Indices, FX, futures | Yahoo Finance chart API | same |
| Crypto | CoinGecko `/simple/price` | same |

`js/invest-data.js` defines the 145-instrument universe; each entry declares
its `source` so the server routes the quote correctly. The `drivers` field is
domain knowledge about what moves an instrument — never a price or forecast.

**Felicity Bot (`/api/invest/advise`)** fetches the live quote and real news
FIRST, then passes only that evidence to Claude. Its system prompt forbids
inventing any price, level or news event, and requires it to cite the supplied
figures. If the live price cannot be fetched, it returns an error instead of
analysing — never a guess. Output is framed as research with an explicit
"not personalised financial advice" line, and position size is expressed as a
percentage of a stated risk budget, never an absolute cash amount.

### No simulated movement, anywhere

An earlier build nudged macro values and ticker prices with `Math.random()`
on a timer so the dashboard "looked live" between real refreshes. That is
fabrication and has been removed. The rule generalises beyond Dubai:

- **A number either comes from a live feed or it is a labelled assessment.**
  Never interpolate, drift, or animate a value to imply movement.
- `js/macro.js` fetches USD Strength (DXY) and Market Volatility (VIX) live
  and marks them `live`. The other four cards are Felicity desk composites,
  are not measurable market prices, and carry a `desk` marker.
- If a live fetch fails, the previous real value stands and the marker shows
  it is stale. Nothing is invented to fill the gap.
- **Seeds are not values.** `js/data.js` once shipped twenty market prices
  (gold at $3,234 while the tape said $4,300) and twelve authored headlines
  with fake ages ("11m"); the topbar ticker scrolled them under a pulsing
  LIVE badge until the first fetch landed — and forever if it never did —
  and the hero banner rotated the fake headlines. Rendering the site
  against a stubbed, failing `/api/markets` is what exposed it. Now
  `markets` carries symbol metadata with `price: null`, `news` starts
  empty, `loadFromAPI()` no longer copies the static `/api/data` fixtures
  over them, the ticker and sidebar list only instruments with a fetched
  price (`live: true`), the topbar badge is driven by the fetch result
  (LIVE / `STALE · HH:MM` / NO FEED — the last two without a dot), and
  `tests/seed.test.mjs` fails the build if a seeded number returns.
- `Math.random()` in display code is a red flag. The only legitimate use in
  this repo is the cache-buster in `js/news-live.js`.
- **Randomness is not the only way to fabricate.** `animateTrackers()` in
  `js/map.js` drifted every flight and ship marker across the globe on a
  1.2s timer (`f.lat += cos(hdg) * 0.025`) over a hardcoded corridor set in
  `js/data.js`. It survived the `Math.random()` purge purely because it used
  arithmetic instead. Deterministic drift is the same lie. Removed.
- **Aircraft are live now; ships are not.** `lib/live-layers.js` pulls
  OpenSky Network ADS-B state vectors (`/api/data?layer=flights`, edge-
  cached 20 minutes — anonymous OpenSky allows 400 credits/day and a global
  pull costs 4; set `OPENSKY_CLIENT_ID`/`OPENSKY_CLIENT_SECRET` for a
  free account's 4,000) and GDELT GEO conflict-news locations for the last
  24 hours (`?layer=events`, 15 minutes). `js/live-layers.js` fills the
  `flights`/`events` arrays (both start empty — the old authored corridor
  set is retired) and the sidebar header says LIVE with the fetch time,
  STALE when a refresh failed and earlier positions stand, or NO FEED.
  Aircraft outside OpenSky's sensor coverage (oceans, parts of Africa and
  Asia) are not in the feed; the sidebar says so. Events are places the
  press is writing about, sized by article count — not verified incidents.
  Ships remain a **fixed reference set** with a `REFERENCE` badge, no live
  dot, no clock, no Refresh: there is no free, licensed AIS feed. The
  sidebar's RE Signals tab follows the same rule: it is a dated snapshot of
  `pix-signals.js`, so it carries a plain `DLD` badge with the detection
  date — no pulse, no Refresh.
- **TradingView's ticker tape does drop US feeds after all.** `TVC:DXY`
  and `NASDAQ:NDX` rendered a red "!" (user screenshots, Sep 2026), and
  `TVC:US10Y`/`TVC:VIX` are the same class of feed. The tape now uses the
  CFD mirrors TradingView's own demo uses (`FOREXCOM:SPXUSD`,
  `FOREXCOM:NSXUSD`, `CAPITALCOM:DXY`, `CAPITALCOM:VIX`, `CAPITALCOM:UK100`,
  `CAPITALCOM:J225`) and the exchange-listed T-note future `CBOT:ZN1!` for
  the 10-year. Treat any tape symbol showing "!" the same way — switch
  provider, do not remove the instrument.
- **The World Map's basemap and geometry are ours to serve.** CARTO's
  basemap tiles began printing "API KEY REQUIRED" across every tile, which
  blanked the map; the choropleth also depended on jsDelivr, unpkg and a
  dynamic CDN import, any of which failing left no countries at all. Now:
  Esri's keyless World Dark Gray Canvas (attribution control on — Esri
  requires it) with an automatic fall-through to OpenStreetMap tiles
  darkened by CSS after a burst of tile errors; Natural Earth 110m
  geometry, the country-name table, topojson-client and Leaflet 1.9.4 are
  vendored under `assets/geo/` and `js/vendor/` with their licences. Do
  not reintroduce a CDN for anything the map needs to draw at all.
- **Heatmaps are a picker over ~30 markets** (`HEATMAP_MARKETS` in
  `js/tv-widgets.js`). The `dataSource` keys could not be verified from
  this sandbox (TradingView's docs, widget host and every third-party
  write-up are egress-blocked). The first attempt shipped index-style keys
  and the owner reported every chip still drawing the S&P 500 — TradingView
  falls back to SPX500 on a key it does not know. The picker now prints the
  requested key under the chips and tells the reader that the widget's own
  header must name the market; the country-wide `All<ISO2>` datasets are
  offered alongside the index ones. Confirm keys against the widget header
  on the deployed site and fix, rather than remove, any that fall back.
- **Broadcasts embed by channel**, via YouTube's own
  `/embed/live_stream?channel=<id>` resolver, with the broadcaster's live
  page and the YouTube channel linked under every frame. The old
  three-proxy video-id discovery is gone (slow, flaky, one proxy dead). Sky
  News's channel id was wrong and never resolved; Bloomberg's handle was
  stale; CNBC and TRT World were added.

### Polling stops when nobody is looking

Markets (60s), news (3min) and the macro cards (60s) once polled forever,
including in a background tab — roughly 200 upstream calls an hour from a
tab nobody is watching, spending the free-tier quotas that serve real
visitors. `startPolling`/`stopPolling` in `js/app.js` are driven by
`visibilitychange`: hidden stops every loop, visible restarts them with an
immediate fetch so returning shows fresh data rather than a stale value and
a wait. `startPolling` calls `stopPolling` first, so a timer can never be
orphaned. Any new recurring fetch belongs in that pair, not in a bare
`setInterval`.

### Felicity Bot is reachable everywhere

`js/felicity-bot.js` mounts a floating launcher beside the WhatsApp button on
every tab, opening a conversation against `/api/desk/ask` — the same desk brain
as the Overview panel, which now sits directly under the hero.

The endpoint accepts a `history` array so the thread has memory. That history
comes from the client, so it is **untrusted**: roles are whitelisted to
user/assistant, content is coerced to a string and truncated, the turn count is
capped, and the sequence is repaired to alternate and end on the new question.
Never pass client turns to the Messages API unchecked.

The transcript lives in `sessionStorage` only and is never persisted server-side.

### The S&P 500 tab is gone — its data lives in the cockpit

It duplicated the cockpit's price, chart, news and AI analysis. What was
genuinely unique — Finnhub fundamentals, earnings against consensus, the
analyst range, and the printable brief — moved to `js/equity-fundamentals.js`
and renders inside the Invest detail pane for US-listed equities. Finnhub's
free tier does not cover Europe/Korea/Japan listings, so the section is not
offered there rather than being shown empty.

`css/sp500.css` is gone too — 84 of its 89 selectors were dead once the tab
went. The five live ones (the chart frame) moved into `css/invest.css` as
`.invest-chart*`. `js/sp500-data.js` stays: it supplies the S&P constituents
to the instrument universe.

### Forms must never claim success they did not achieve

`/api/subscribe` used to return `{success:true}` unconditionally — no API key,
a rejected send, an unresolvable audience, all produced "Subscribed! Check your
inbox" and no email. `/api/leads` did the same, promising a callback for a lead
that reached nobody. That is the same sin as printing a market number we never
fetched.

Both endpoints now check every Resend response and report what actually
happened. A subscription that stores but whose welcome email bounces returns
`success:true, welcomeSent:false` and says so. A lead whose owner notification
fails returns `success:false` and points the visitor at WhatsApp. The
front-end honours both — no more "silently continue, show success regardless".

**The subscriber list does not live in Resend.** It lives in Postgres
(`subscribers` table, created on demand by `lib/subscribers.js`) and is
mirrored into the Resend Audience when the key allows it. Either store alone
is enough. A Resend key created with **"Sending access"** cannot call the
Audiences or Broadcasts API at all — that is what silently lost every signup
— so `DATABASE_URL` is the reliable store, and `/api/brief` sends one message
per subscriber (permitted by a send-only key) whenever the list comes from
Postgres, falling back to a Resend broadcast only when the audience resolves.

Individual sends carry a **signed unsubscribe link** (`unsubUrl`, HMAC-keyed)
handled by `GET /api/subscribe?unsubscribe=…&t=…`. A broadcast uses Resend's
own placeholder. Every message must carry one of the two — never neither.

`lib/` exists because anything under `api/` becomes a serverless function and
Hobby allows twelve. Shared server code goes in `lib/`, never `api/`.

**`GET /api/subscribe?diagnose=1`** answers "why is the newsletter not
working?" — it checks the keys, asks Resend which domains are verified,
resolves the audience and counts the stored subscribers. It never echoes a
secret. Run it first whenever email misbehaves.

The diagnostic must **measure**, never assume. It once checked that
`FROM_EMAIL` was set and reported "the newsletter is ready" while every send
was being rejected 403 for an unverified domain — the same sin as printing an
unfetched market number. A send-only key cannot read `/domains`, so in that
case it reports the sender as **unknown** and offers `&probe=1`, which sends
one real message to the owner and reports what Resend actually said.

The usual answer is `FROM_EMAIL`: without it, mail goes out from Resend's
`onboarding@resend.dev`, which **only delivers to the Resend account owner**.
Everyone else silently gets nothing.

### Rendering untrusted data

`js/safe.js` is the only correct escaper. Use it everywhere external data
reaches markup — news headlines and URLs from Finnhub or RSS, and anything
from `/api/data`.

- `escapeHtml()` escapes `& < > " '`. The old textContent→innerHTML trick
  left **quotes unescaped**, which is safe in a text node and unsafe inside
  `href="…"`. Never reintroduce it.
- `safeUrl()` must wrap every URL placed in an `href`, and `isSafeUrl()`
  every URL handed to `window.open()`. Both reject anything that is not
  http/https, so a `javascript:` link cannot execute.

### TradingView embeds — what they can and cannot show

TradingView's **advanced-chart and market-quotes embeds silently drop the
US index, commodity and Treasury-yield feeds** — `SP:SPX`, `DJ:DJI`,
`TVC:GOLD`, `TVC:USOIL`, `TVC:US02Y`, `TVC:US10Y` and friends. The iframe
renders, the symbol is dropped, and there is no error: an empty chart, or a
group header with nothing under it. This cost three separate bug reports
before the pattern was clear.

**The restriction is on the US market data, not on the `TVC:` prefix.** The
same widget renders `TVC:JP10Y`, `TVC:CN10Y`, `TVC:KR10Y`, `TVC:IN10Y`,
`TVC:SG10Y`, `TVC:ID10Y` and `TVC:AU10Y` perfectly — that was observed
directly: the Bond Desk's Japan group streamed while its US group sat
empty, in the same widget, in the same screenshot. Do not "fix" the Asian
rows by removing them; they work.

What this means in practice:

- **Embeds fine:** exchange-listed equities (`NASDAQ:TLT`, bare US
  tickers), COINBASE crypto pairs, FX pairs, and non-US sovereign yields.
- **Must be drawn by us:** US indices, US commodities, US Treasury yields.
  `usesOwnChart()` in `js/invest.js` is the gate, fed by the `candles`
  action on `api/invest/[action].js` (real Yahoo daily closes). The Bond
  Desk's US strip does the same through its own quote cards.
- The **ticker-tape** widget is unaffected and does show US TVC symbols.

Before adding any symbol to an advanced-chart or market-quotes embed, check
it against this list — and if it is a US index, commodity or yield, route it
through `usesOwnChart()` instead.

### Backtesting — the honesty rules

`/api/invest/backtest` is a historical simulation, and a simulation is
trivially easy to make lie. Three rules hold it straight:

1. **No lookahead.** A signal computed on the close of bar *i* is executed
   at the **open of bar i+1**. Never let a fill use the same bar's close, or
   any high/low the rule could not have known at decision time.
2. **Always report buy-and-hold on the same axis.** A strategy returning
   40% where holding returned 60% *lost*. `edgeVsBuyHoldPct` is the number
   that matters and it is never omitted, never buried, and never hidden when
   it is negative.
3. **Costs are charged.** Fees on entry and exit, default 0.1% per side.
   A zero-cost backtest is a marketing asset, not a result.

A rule that never triggers reports **0 trades** — it does not get its
parameters quietly loosened until it produces something. Every response
carries a `method` string stating it is a simulation, not a prediction,
and the UI states plainly that slippage, liquidity, taxes and the
discipline to actually follow the rule are not modelled.

The screener (`/api/invest/scan`) computes RSI, volume-versus-20-day,
moving averages and 52-week position from real Yahoo daily OHLCV at scan
time. Instruments whose history could not be fetched are returned in
`failed` and shown — never silently dropped, which would make a partial
scan look complete.

---

## Project

Vanilla HTML/CSS/JS SPA (no build step), ES modules, deployed on Vercel from
`main`. Live: https://felicity-world-map.vercel.app

- **Always merge finished work to `main`.** Standing instruction from the
  owner. Feature branches are a staging step, never the destination — work
  that stops on a branch is not deployed, because Vercel builds from `main`.
  Verify, merge, push `main`.
- **Vercel Hobby caps serverless functions at 12.** Currently 11 in `api/`.
  Consolidate with `[action].js` dynamic routes rather than adding files.
- Claude model: `claude-opus-4-8` for desk-grade output.
- Env vars are documented in `README.md` — `FROM_EMAIL` must be a
  domain-verified Resend sender or email only reaches the account owner.

## Verification before every push

```bash
for f in api/*.js api/*/*.js lib/*.js; do node --check "$f"; done
for f in js/*.js; do node --input-type=module --check < "$f"; done
node -e "Promise.all([import('./api/desk/ask.js'),import('./api/brief.js')])"
npm test
```

The import line matters: the API endpoints import `js/pix-data.js` and
`js/pix-signals.js`, so a break in a browser module breaks the serverless
functions too. `npm test` runs `tests/*.test.mjs` — the brief, desk and
intel endpoints against stubbed upstreams (including a Yahoo outage and
a 429), and the Overview desk view against the registry files. The tests
live in the repo, not a scratchpad, so they survive the session. No
external dependencies are needed to run them.
