// Every heatmap chip must carry a dataset TradingView actually serves to
// embeds. The embed menu was read out of the widget bundle
// (GET /api/invest/tv-datasets, 2026-09-26); a code outside it is drawn as
// the S&P 500 with no error, which is what three deploys of guessed codes
// did. Korean datasets and UK100 are remapped to SPX500 by the embed entry
// point and must never be offered.
import { HEATMAP_MARKETS, HEATMAP_KEYS, TV_EMBED_DATASETS, TV_EMBED_WITHHELD } from '../js/tv-widgets.js';
import { extractTables, chunkUrls } from '../lib/tv-datasets.js';

const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

const embed = new Set(TV_EMBED_DATASETS);
for (const k of HEATMAP_KEYS) check(embed.has(k), `chip ${k} is in TradingView's embed menu`);
check(new Set(HEATMAP_KEYS).size === HEATMAP_KEYS.length, 'no duplicate chips');
check(HEATMAP_KEYS.length >= 25, `enough chips to be useful (${HEATMAP_KEYS.length})`);
for (const bad of ['UK100', 'AllUK', 'KOSPI', 'KOSPI200', 'KOSDAQ', 'KOSDAQ150', 'AllKR', 'CAC40', 'NI225', 'HSI', 'NIFTY50', 'TADAWULTASI', 'DFMDFMGI', 'SX5E', 'AEX', 'TVCSTI']) {
  check(!embed.has(bad) && !HEATMAP_KEYS.includes(bad), `${bad} is withheld from embeds and offered nowhere`);
}
for (const g of HEATMAP_MARKETS) for (const m of g.items) check(typeof m.label === 'string' && /embed menu/.test(m.evidence), `${m.key} carries its evidence`);
check(TV_EMBED_WITHHELD.includes('FTSE 100') && TV_EMBED_WITHHELD.includes('Nikkei 225') && TV_EMBED_WITHHELD.includes('Tadawul TASI'), 'withheld list names the markets people will look for');

// The discovery helpers that produced the table
const sample = 'o.d(t,{DataSets:()=>a});var a=function(e){return e.ASX200="ASX200",e.DAX="DAX",e}({}) [E.DataSets.DAX]:()=>T({description:"DAX Index",pro_name:"XETR:DAX",short_name:"DAX"}) h(De.Germany,A.t(null,void 0,o(1)),[Y(E.DataSets.DAX),Y(E.DataSets.AllDE)])';
const t = extractTables(sample);
check(t.datasets.join() === 'ASX200,DAX' && t.labels.DAX === 'DAX Index (XETR:DAX)' && t.menus[0].group === 'Germany' && t.menus[0].codes.join() === 'DAX,AllDE', 'enum, label and menu extraction');
const rt = 'a.u=e=>"static/bundles/embed/"+({9756:"en"}[e]||e)+"."+{9756:"b0a51148f4d75ee4d509",37036:"20ed3a36fa7505fbb33c"}[e]+".js"';
check(chunkUrls(rt).join() === 'https://www.tradingview-widget.com/static/bundles/embed/en.9756.b0a51148f4d75ee4d509.js,https://www.tradingview-widget.com/static/bundles/embed/37036.20ed3a36fa7505fbb33c.js', 'runtime chunk map → URLs');

if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log(`heatmap: ${HEATMAP_KEYS.length} chips, all in TradingView's embed menu; withheld markets named — all checks passed`);
