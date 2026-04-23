// ═══════════════════════════════════════════════════════════
// PROMPTS — Hedge Fund Analytical Engine
// Shared prompt module, desk calls, historical analogs,
// and conviction ladder utilities.
// ═══════════════════════════════════════════════════════════

export const HEDGE_FUND_SYSTEM_PROMPT = `You are the senior macro strategist at Felicity Intelligence. Your clients are Dubai real estate investors with AED 5M-500M portfolios. They pay for conviction, not balance.

Rules:
- Take positions. Every answer ends with a directional call: LONG / SHORT / AVOID / ACCUMULATE / TRIM / HOLD.
- Quantify everything: % moves, AED billion flows, basis points, historical correlations. Never say 'significant' when you can say '+12%'.
- Name specific Dubai areas (Palm Jumeirah, DIFC, Downtown, Marina, Creek Harbour, JVC, Dubai Hills, Dubai South, Emaar Beachfront, Meydan, Arjan, JLT, Business Bay) and developers (Emaar, DAMAC, Nakheel, Sobha, Binghatti, Aldar, Meraas).
- Every thesis cites a historical analog: 'Last time X happened, Y moved Z%'.
- Embrace second-order effects. The obvious impact is already priced.
- No disclaimers, no 'investors should consider', no 'it depends', no 'consult advisor'.
- End every call with conviction: LOW / MODERATE / HIGH / VERY HIGH / MAXIMUM with reasoning.
- Think in probabilities: 'Base case 60%: X. Bull case 25%: Y. Bear case 15%: Z.'
- If the user's question framing is weak, reject it and redirect to the right question.
- Tone: Druckenmiller meets local Dubai RE domain depth. Every response reads like a PM note to his book.`;

export const HISTORICAL_ANALOGS = [
  { event: "2008 GFC", impact: "Dubai prime -54%, recovery 5 years", lesson: "Flight capital dried up, leverage unwound" },
  { event: "2011 Arab Spring", impact: "+18% flight capital premium in 12 months", lesson: "Regional instability = Dubai safe-haven bid" },
  { event: "2014 Oil Crash", impact: "Secondary -22%, luxury -8%", lesson: "Oil sensitivity highest in mid-market, luxury more resilient" },
  { event: "2017 Saudi Corruption Purge", impact: "Dubai luxury +11% single quarter", lesson: "Saudi HNW moved fast, Palm + Downtown primary beneficiaries" },
  { event: "2020 COVID", impact: "-18% then +89% from trough over 24 months", lesson: "Dubai was the fastest recovering RE market globally" },
  { event: "2022 Russia-Ukraine War", impact: "Prime +42% in 18 months", lesson: "European + Russian HNW flight capital transformed the luxury segment" },
  { event: "2023 UK Non-Dom Signaling", impact: "DIFC commercial +16%, British buyers +31%", lesson: "Tax policy changes drive immediate relocation decisions" },
  { event: "2024 BRICS Expansion", impact: "Creek Harbour +24%, Indian buyer surge", lesson: "Geopolitical realignment creates new capital corridors to Dubai" },
];

export const DESK_CALLS = [
  { area: "Emaar Pre-Launch Pipeline", call: "LONG", conviction: 4, thesis: "Oil above $80 + Saudi PIF deployment + Expo legacy tailwind. Emaar 2026 launches in Creek Harbour and Dubai Hills priced 12-18% below achievable resale.", risk: "Oil to $60 kills the sovereign spending thesis", horizon: "18 months", segment: "Premium" },
  { area: "DAMAC Off-Plan Secondary", call: "AVOID", conviction: 4, thesis: "Secondary trades at 8-14% premium to developer direct. Delivery pipeline oversupply 2026-27. Capital better deployed into primary.", risk: "Surprise demand from new buyer cohort", horizon: "12 months", segment: "Mid-market" },
  { area: "Palm Jumeirah Villas", call: "ACCUMULATE", conviction: 5, thesis: "Scarcity constraint hard-capped. Russian + European HNW flight capital sticky. Last time this dynamic ran (2014), villas lifted 44% over 24 months.", risk: "Global recession severe enough to reverse HNW migration", horizon: "36 months", segment: "Ultra-Luxury" },
  { area: "Dubai South Residential", call: "SHORT", conviction: 3, thesis: "Expo residual supply still absorbing. Logistics play is real but residential thesis is 2027+. Earlier entry is a trap.", risk: "Al Maktoum airport catalyst arrives earlier than expected", horizon: "Near-term", segment: "Affordable" },
  { area: "DIFC Commercial", call: "LONG", conviction: 4, thesis: "UK non-dom reform forcing relocation. 400+ firms signaling Dubai HQ. Grade A supply tight. Rents up 18% YoY with no new supply until 2028.", risk: "Global recession halts corporate relocation", horizon: "24 months", segment: "Commercial" },
  { area: "JVC — Contrarian", call: "ACCUMULATE", conviction: 3, thesis: "Consensus says oversupply. Reality: Indian NRI demand 2025 beating forecasts by 22%. Yield 7.2% vs prime 4.8%. Mean-reversion setup.", risk: "Actual oversupply materializes beyond absorption capacity", horizon: "18 months", segment: "Mid-market" },
];

export function renderConvictionBadge(level) {
  const levels = { 'MAXIMUM': 5, 'VERY HIGH': 4, 'HIGH': 3, 'MODERATE': 2, 'LOW': 1 };
  const n = levels[level?.toUpperCase()] || 0;
  const labels = { 5: 'Bet the book', 4: 'Size up', 3: 'Meaningful position', 2: 'Small allocation', 1: 'Watch, don\'t position' };
  const dots = Array.from({length: 5}, (_, i) =>
    `<span class="conviction-dot ${i < n ? 'conviction-dot--active' : ''}"></span>`
  ).join('');
  return `<div class="conviction-badge"><div class="conviction-dots">${dots}</div><span class="conviction-level">${level || 'N/A'}</span><span class="conviction-desc">${labels[n] || ''}</span></div>`;
}

export function extractConviction(text) {
  const match = text.match(/\b(MAXIMUM|VERY HIGH|HIGH|MODERATE|LOW)\b/i);
  return match ? match[1].toUpperCase() : null;
}
