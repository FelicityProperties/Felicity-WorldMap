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

### What is still a desk opinion (and must stay labeled)

`dubaiAreas` in `js/data.js` carries `sentiment`, `priceDirection`,
`demandStrength`, `investorOutlook`, `opportunityScore` and the prose
descriptions. These are **Felicity desk assessments, not registry data**.
They are fine to keep — an intelligence product is allowed a view — but they
must never be presented as measured evidence, and any numeric field that PIX
can source should be migrated to PIX.

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
- `Math.random()` in display code is a red flag. The only legitimate use in
  this repo is the cache-buster in `js/news-live.js`.

---

## Project

Vanilla HTML/CSS/JS SPA (no build step), ES modules, deployed on Vercel from
`main`. Live: https://felicity-world-map.vercel.app

- **Vercel Hobby caps serverless functions at 12.** Currently 10 in `api/`.
  Consolidate with `[action].js` dynamic routes rather than adding files.
- Claude model: `claude-opus-4-8` for desk-grade output.
- Env vars are documented in `README.md` — `FROM_EMAIL` must be a
  domain-verified Resend sender or email only reaches the account owner.

## Verification before every push

```bash
for f in api/*.js api/*/*.js; do node --check "$f"; done
for f in js/*.js; do node --input-type=module --check < "$f"; done
node -e "Promise.all([import('./api/desk/ask.js'),import('./api/brief.js')])"
```

The last line matters: the API endpoints import `js/pix-data.js` and
`js/pix-signals.js`, so a break in a browser module breaks the serverless
functions too.
