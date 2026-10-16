// Every heatmap chip must carry a dataset TradingView actually serves to
// embeds. The embed menu was read out of the widget bundle
// (GET /api/invest/tv-datasets, 2026-09-26); a code outside it is drawn as
// the S&P 500 with no error, which is what three deploys of guessed codes
// did. Korean datasets and UK100 are remapped to SPX500 by the embed entry
// point and must never be offered.
import { HEATMAP_MARKETS, HEATMAP_KEYS, TV_HEATMAP_KEYS, TV_EMBED_DATASETS, TV_EMBED_WITHHELD } from '../js/tv-widgets.js';
import { extractTables, chunkUrls } from '../lib/tv-datasets.js';

const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

const embed = new Set(TV_EMBED_DATASETS);
for (const k of TV_HEATMAP_KEYS) check(embed.has(k), `chip ${k} is in TradingView's embed menu`);
// A chip TradingView cannot draw must be drawn by us — and must never be
// handed to the TradingView widget, which would draw the S&P 500 instead
const own = HEATMAP_MARKETS.flatMap(g => g.items).filter(m => m.own);
check(own.length >= 1 && own.every(m => m.own === 'nikkei' && !embed.has(m.key)), 'own-drawn chips carry a renderer and no TradingView code');
check(own.some(m => m.label === 'Nikkei 225'), 'the Nikkei 225 is offered, drawn by us');
check(new Set(HEATMAP_KEYS).size === HEATMAP_KEYS.length, 'no duplicate chips');
check(TV_HEATMAP_KEYS.length >= 25, `enough chips to be useful (${TV_HEATMAP_KEYS.length})`);
for (const bad of ['UK100', 'AllUK', 'KOSPI', 'KOSPI200', 'KOSDAQ', 'KOSDAQ150', 'AllKR', 'CAC40', 'NI225', 'HSI', 'NIFTY50', 'TADAWULTASI', 'DFMDFMGI', 'SX5E', 'AEX', 'TVCSTI']) {
  check(!embed.has(bad) && !HEATMAP_KEYS.includes(bad), `${bad} is withheld from embeds and offered nowhere`);
}
for (const g of HEATMAP_MARKETS) for (const m of g.items) check(typeof m.label === 'string' && (m.own ? /Nikkei Inc\./.test(m.evidence) : /embed menu/.test(m.evidence)), `${m.key} carries its evidence`);
check(TV_EMBED_WITHHELD.includes('FTSE 100') && TV_EMBED_WITHHELD.includes('Nikkei 225') && TV_EMBED_WITHHELD.includes('Tadawul TASI'), 'withheld list names the markets people will look for');

// The discovery helpers that produced the table
const sample = 'o.d(t,{DataSets:()=>a});var a=function(e){return e.ASX200="ASX200",e.DAX="DAX",e}({}) [E.DataSets.DAX]:()=>T({description:"DAX Index",pro_name:"XETR:DAX",short_name:"DAX"}) h(De.Germany,A.t(null,void 0,o(1)),[Y(E.DataSets.DAX),Y(E.DataSets.AllDE)])';
const t = extractTables(sample);
check(t.datasets.join() === 'ASX200,DAX' && t.labels.DAX === 'DAX Index (XETR:DAX)' && t.menus[0].group === 'Germany' && t.menus[0].codes.join() === 'DAX,AllDE', 'enum, label and menu extraction');
const rt = 'a.u=e=>"static/bundles/embed/"+({9756:"en"}[e]||e)+"."+{9756:"b0a51148f4d75ee4d509",37036:"20ed3a36fa7505fbb33c"}[e]+".js"';
check(chunkUrls(rt).join() === 'https://www.tradingview-widget.com/static/bundles/embed/en.9756.b0a51148f4d75ee4d509.js,https://www.tradingview-widget.com/static/bundles/embed/37036.20ed3a36fa7505fbb33c.js', 'runtime chunk map → URLs');

// 16 Oct: in a browser without CSS :has() the Nikkei map rendered 0px tall —
// its layout hung on :has() rules and a percentage height. Layout hooks are
// classes set by the picker, and the map carries its own height.
{
  const { readFileSync, readdirSync } = await import('node:fs');
  for (const f of readdirSync(new URL('../css/', import.meta.url))) {
    const css = readFileSync(new URL(`../css/${f}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    check(!css.includes(':has('), `css/${f} has no :has() selector (unsupported in older Firefox/Safari)`);
  }
  const inv = readFileSync(new URL('../css/invest.css', import.meta.url), 'utf8');
  check(/\.nkhm__map\s*\{[^}]*height:\s*clamp\(/.test(inv), 'the Nikkei map has an explicit height of its own');
}

if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log(`heatmap: ${TV_HEATMAP_KEYS.length} TradingView chips, all in its embed menu, plus ${HEATMAP_KEYS.length - TV_HEATMAP_KEYS.length} drawn by us; withheld markets named — all checks passed`);
