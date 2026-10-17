// The sixteen withheld markets (lib/index-heatmap.js): every constituent
// reader against rows copied from the real responses the deployed
// function fetched on 2026-10-17 (/api/invest/heatmap-sources and
// ?diag=members), the Yahoo quote rules (nulls stay null, caps checked
// against price × shares, foreign currencies converted, a share class
// carrying the whole company's value caught), the session and throttle
// rules, the memo, the route's cache headers and the renderer's escaping.
import {
  MARKETS, MARKET_IDS, fetchIndexHeatmap, _resetIndexHeatmap, membersFromWikitext, membersFromNiftyCsv, membersFromCnindex,
  membersFromKap, membersFromSsga, membersFromMoneyDj, pickSearchSymbol, capOf, parseQuote, localDay, rocDay, twseIndexLevel,
  lseSymbol, suffixed, euronextSymbol, sehkSymbol, QUOTE_BATCH,
} from '../lib/index-heatmap.js';
import { findTable, parseTable, cleanWiki, infoboxCount, splitTop } from '../lib/wikitable.js';
import { readXlsx } from '../lib/xlsx.js';
import { tileSummary, fmtCap } from '../js/index-heatmap.js';
import { tileHtml, layout } from '../js/own-heatmap.js';

const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

// ── Wikitext: the real table shapes ──
const FTSE = `{{Infobox Index
| name = FTSE 100
| constituents = 100 (June 2026)
}}
== Constituents ==
{| class="wikitable sortable" id="constituents"
|-
!|Company|| Ticker || FTSE industry classification benchmark sector<ref>{{cite web|url=http://www.londonstockexchange.com/x |title=FTSE 100 constituents}}</ref>
|-
|[[3i]]||III||Financial services
|-
|[[Aberdeen Group]]||ABDN||\tFinancial Services
|-
|[[BT Group]]|| BT.A || Telecommunications services
|-
|[[Burberry|Burberry Group]]|| BRBY || Personal goods
|-
|[[Not a share]]|| <!-- removed --> || x
|}`;
const f = membersFromWikitext(FTSE, MARKETS.ftse100.members);
check(f.members.map(m => m.symbol).join() === 'III.L,ABDN.L,BT-A.L,BRBY.L', `FTSE EPICs become Yahoo symbols, BT.A → BT-A.L (${f.members.map(m => m.symbol)})`);
check(f.members[3].name === 'Burberry Group' && f.rowsMalformed === 1 && f.infoboxCount === 100, 'piped link text is the name; a row with no ticker is counted, not kept; infobox count read');
check(lseSymbol('RR.') === 'RR.L' && lseSymbol('BP') === 'BP.L' && lseSymbol('') === null, 'EPIC edge cases');

const BEL = `== Constituents ==
{| class="wikitable sortable" style="text-align: center;" cellpadding=2 cellspacing=2
|-
! Company !! [[Industry Classification Benchmark|ICB]] Sector !! Ticker symbol !! Index weighting (%) !! In index since
|-
| [[AB InBev]] || Consumer Staples || {{EuronextBrussels|ABI|BE0974293251|XBRU}} || 11.75 ||{{dts|February 2002}}
|-
| {{ill|arGEN-X|nl|Argenx}} || Health Care || {{EuronextBrussels|ARGX|NL0010832176|XBRU}} || 12.56 ||{{dts|June 2018}}
|-
| [[Aperam]] || Basic Materials || {{EuronextAmsterdam|APAM|LU0569974404|XAMS}} || 1.22 ||{{dts|March 2026}}
|-
| {{ill|Warehouses De Pauw|lt=WDP|nl|Warehouses De Pauw}} || Real Estate || {{EuronextBrussels|WDP|BE0974349814|XBRU}} || 3.43 ||{{dts|March 2019}}
|}`;
const b = membersFromWikitext(BEL, MARKETS.bel20.members);
check(b.members.map(m => m.symbol).join() === 'ABI.BR,ARGX.BR,APAM.AS,WDP.BR', `the Euronext template's MIC decides the venue: Aperam trades in Amsterdam (${b.members.map(m => m.symbol)})`);
check(b.members[1].name === 'arGEN-X' && b.members[3].name === 'WDP', 'interlanguage links show their label');
check(!JSON.stringify(b).includes('11.75'), "Wikipedia's index weights are not carried");

const HSI = `{| class="wikitable sortable" border="1" id="constituents"
!Ticker
!Name
!Sub-index
|-
|{{SEHK|5}}
|[[HSBC Holdings plc]]
|Finance
|-
|{{SEHK|9988}}
|[[Alibaba Group]]
|Commerce & Industry
|}`;
const hm = membersFromWikitext(HSI, { page: 'x', table: { id: 'constituents' }, ticker: /^ticker$/i, name: /^name$/i, symbol: sehkSymbol });
check(hm.members.map(m => m.symbol).join() === '0005.HK,9988.HK', 'one-cell-per-line rows; SEHK codes padded to four digits');

const ESX = `{| class="wikitable sortable" id="constituents" style="white-space: nowrap"
! Ticker !! Main listing !! Name !! Corporate form !! Registered<br />office !! Sector !! Founded
|-
|ADS.DE || {{Flagicon|Germany}} {{FWB|ADS}} || [[Adidas]] || {{Flagicon|Germany}} ''[[Aktiengesellschaft]]'' || {{GER}} || Consumer Discretionary || 1924
|-
|WKL.AS || {{Flagicon|Netherlands}} {{EuronextAmsterdam|WKL|NL0000395903|XAMS}} ||[[Wolters Kluwer]] ||{{Flagicon|Netherlands}} ''[[Naamloze vennootschap]]'' ||{{NLD}} ||Industrials ||1968
|}`;
const e = membersFromWikitext(ESX, MARKETS.sx5e.members);
check(e.members.map(m => `${m.symbol}:${m.name}`).join() === 'ADS.DE:Adidas,WKL.AS:Wolters Kluwer', 'Yahoo-form tickers kept as written; names from links');
check(suffixed('.PA')('AC.PA') === 'AC.PA' && suffixed('.AS')('ASML') === 'ASML.AS' && suffixed('.PA')('a b') === 'AB.PA' && suffixed('.PA')('!!') === null, 'suffix rule');
check(euronextSymbol('{{EuronextParis|AI|FR0000120073|XPAR}}') === 'AI.PA' && euronextSymbol('ABI') === null, 'Euronext template rule');
let wikiErr = '';
try { membersFromWikitext(FTSE.replace('Ticker', 'Code'), MARKETS.ftse100.members); } catch (err) { wikiErr = err.message; }
check(/header changed/.test(wikiErr) && /Code/.test(wikiErr), 'a changed table header fails loudly with what it saw');
check(findTable('no table here', { id: 'constituents' }) === null, 'a missing table is null, not a guess');
check(splitTop('[[a|b]]||{{c|d}}||e', '||').length === 3 && cleanWiki("'''Bold''' <ref>x</ref>[[Link|Text]] {{nowrap|A B}}") === 'Bold Text A B', 'wikitext helpers');
check(infoboxCount('| constituents = up to 30 (since 2025)') === null && infoboxCount('| constituents = 88') === 88, 'only a plain infobox count is an expected count');
check(parseTable('{|\n! A !! B\n|-\n| style="x" | 1 || 2\n').rows[0].join() === '1,2', 'cell attributes are taken off');

// ── NSE, CNI, KAP, State Street, MoneyDJ, Invesco ──
const n = membersFromNiftyCsv('Company Name,Industry,Symbol,Series,ISIN Code\r\nAdani Enterprises Ltd.,Metals & Mining,ADANIENT,EQ,INE423A01024\r\nBajaj Auto Ltd.,Automobile and Auto Components,BAJAJ-AUTO,EQ,INE917I01010\r\nMahindra & Mahindra Ltd.,Automobile and Auto Components,M&M,EQ,INE101A01026\r\n');
check(n.members.map(m => m.symbol).join() === 'ADANIENT.NS,BAJAJ-AUTO.NS,M&M.NS' && n.members[0].name === 'Adani Enterprises Ltd.', 'NSE file rows (hyphen and ampersand symbols)');
let nseErr = '';
try { membersFromNiftyCsv('<html>blocked</html>'); } catch (err) { nseErr = err.message; }
check(/HTML/.test(nseErr), 'an HTML page in place of the NSE file is refused');

const c = membersFromCnindex({ code: 200, data: { total: 2, rows: [{ dateStr: '2026-10-16', seccode: '300750', secname: '宁德时代', trade: '工业', weight: '5.19' }, { dateStr: '2026-10-16', seccode: '002384', secname: '东山精密', trade: '信息技术', weight: '--' }] } });
check(c.members.map(m => m.symbol).join() === '300750.SZ,002384.SZ' && c.asOf === '2026-10-16' && c.members[0].localName === '宁德时代', 'CNI sample rows, dated');
check(!JSON.stringify(c).includes('5.19'), "CNI's weights are not carried");

const kapText = JSON.stringify({ initialData: [{ code: 'XU100', content: [{ stockCode: 'BINHO', title: '1000 YATIRIMLAR HOLDİNG A.Ş.', mkkMemberOid: 'a' }, { stockCode: 'THYAO', title: 'TÜRK HAVA YOLLARI A.O.', mkkMemberOid: 'b' }, { stockCode: 'THYAO', title: 'dup', mkkMemberOid: 'b' }] }, { code: 'XU050', content: [{ stockCode: 'AKBNK', title: 'AKBANK T.A.Ş.' }] }] });
const half = Math.floor(kapText.length / 2);
const kapHtml = `<script>self.__next_f.push([1,${JSON.stringify(kapText.slice(0, half))}])</script><script>self.__next_f.push([1,${JSON.stringify(kapText.slice(half))}])</script>`;
const k = membersFromKap(kapHtml, 'XU100');
check(k.members.map(m => m.symbol).join() === 'BINHO.IS,THYAO.IS' && k.duplicates === 1 && k.members[1].name === 'TÜRK HAVA YOLLARI A.O.', 'KAP lists read across React chunks; only the asked index; repeats counted');
let kapErr = '';
try { membersFromKap(kapHtml, 'XU030'); } catch (err) { kapErr = err.message; }
check(/no XU030/.test(kapErr), 'a list KAP does not carry fails loudly');

const ssgaRows = [
  ['Fund Name:', 'State Street® SPDR® Straits Times Index ETF'], ['Ticker Symbol:', 'ES3'], ['Holdings as of:', '16-Oct-2026'],
  ['ISIN', 'SEDOL', 'Ticker', 'Stock Exchange', 'Trade Country Name', 'Security Name', 'Local Currency', 'Local Price', 'Number of Shares', 'Base Market Value', 'Weight %', 'Industry Classification'],
  ['SG1L01001701', '6175203', 'D05-SG', 'SINGAPORE', 'Singapore', 'DBS Group Holdings Ltd', 'SGD', '74.110000', '16095753', '1192856254.83', '29.728845', 'Financials'],
  ['BMG507361001', '6472119', 'J36-SG', 'SINGAPORE', 'Singapore', 'Jardine Matheson Holdings Limited', 'USD', '55.580000', '1471691', '104621924.51', '2.60743', 'Industrials'],
  ['', '', 'CASH_SGD', '', '', 'Cash', 'SGD'],
];
const ss = membersFromSsga(ssgaRows, '.SI');
check(ss.members.map(m => m.symbol).join() === 'D05.SI,J36.SI' && ss.asOf === '2026-10-16' && ss.rowsMalformed === 1, 'State Street holdings: dated, cash row counted not kept');
check(!JSON.stringify(ss).includes('29.728845'), "the fund's weights are not carried");

const dj = `<div class="eTitle"> 元大台灣50(0050.TW)-全部持股 <div id="ctl00_sdate3" align="right">資料日期：2026/10/16</div></div>
<tr class="even"> <td class="col05"><a href='/etf/ea/ETZCW.djhtm?c=1&etfid=2330.TW&back=0050.TW'>台積電(2330.TW)</a></td><td class="col06">56.66</td></tr>
<tr class="odd"> <td class="col05"><a href='/etf/ea/ETZCW.djhtm?c=1&etfid=2603.TW&back=0050.TW'>長榮(2603.TW)</a></td><td class="col06">0.28</td></tr>
<tr class="odd"> <td class="col05">台灣50ETF股票期貨 202610</td><td class="col06">0.03</td></tr>
<tr class="even"> <td class="col05"><a href='/etf/ea/ETZCW.djhtm?c=1&etfid=2330.TW&back=0056.TW'>台積電(2330.TW)</a></td></tr>`;
const d0 = membersFromMoneyDj(dj, '0050.TW');
check(d0.members.map(m => m.symbol).join() === '2330.TW,2603.TW' && d0.asOf === '2026-10-16' && d0.members[0].localName === '台積電', 'MoneyDJ holdings: only this fund\'s stock rows, futures left out, dated');
const dhk = membersFromMoneyDj(`<a href='/etf/ea/ETZCW.djhtm?c=1&etfid=0005.HK&back=2800.HK'>匯豐控股(0005.HK)</a>`, '2800.HK');
check(dhk.members[0].symbol === '0005.HK', 'Hong Kong codes keep four digits');

check(pickSearchSymbol({ quotes: [{ symbol: 'NOVN.SW', exchange: 'EBS', quoteType: 'EQUITY' }] }) === 'NOVN.SW', 'ISIN search: the primary listing');
check(pickSearchSymbol({ quotes: [{ symbol: 'STM', quoteType: 'EQUITY' }, { symbol: 'STMPA.PA', quoteType: 'EQUITY' }] }) === 'STMPA.PA', 'a European primary listing beats a US line');
check(pickSearchSymbol({ quotes: [{ symbol: 'X.F', quoteType: 'MUTUALFUND' }] }) === null && pickSearchSymbol({}) === null, 'no equity, no symbol');
check(pickSearchSymbol({ quotes: [{ symbol: 'FER', quoteType: 'EQUITY' }, { symbol: 'FER.MC', quoteType: 'EQUITY' }, { symbol: 'FER.AS', quoteType: 'EQUITY' }] }, 'NL0015001FS8') === 'FER.AS', "the ISIN's home venue wins over Yahoo's first answer");
check(pickSearchSymbol({ quotes: [{ symbol: 'FRE.F', quoteType: 'EQUITY' }] }, 'DE0005785604') === 'FRE.F', 'a secondary line is used only when it is the only one');

// ── Quote rules ──
const q0 = parseQuote({ symbol: 'A', regularMarketPrice: null, regularMarketChangePercent: 1.2, marketCap: 0 });
check(q0.price === null && q0.changePct === null && q0.cap === null, 'Yahoo nulls stay null: no price means no move; a zero cap is no cap');
check(parseQuote({ symbol: 'A', regularMarketPrice: 10, regularMarketChangePercent: -1.98456 }).changePct === -1.98, 'moves to two decimals');
check(capOf({ price: 12446, currency: 'GBp', shares: 1.5509e9, cap: 1.93e11 }).basis === 'yahoo', 'London: price in pence, cap in pounds — consistent');
const whole = capOf({ price: 100, currency: 'KRW', shares: 1e8, cap: 1e14 });
check(whole.cap === 1e10 && /disagreed/.test(whole.basis), "a share class carrying the whole company's value is sized by its own price × shares");
check(capOf({ price: 5, currency: 'EUR', shares: 2e6, cap: null }).cap === 1e7 && capOf({ price: 5, currency: 'EUR' }).cap === null, 'cap from price × shares when Yahoo gives none; none when neither');
check(localDay('2026-10-16T23:30:00.000Z', 'Asia/Tokyo') === '2026-10-17' && localDay('2026-10-16T23:30:00.000Z', 'Europe/London') === '2026-10-17' && localDay('2026-10-16T22:30:00.000Z', 'Europe/London') === '2026-10-16', 'session days in the exchange time zone, DST included');
check(rocDay('1151016') === '2026-10-16' && rocDay('2026') === null, 'ROC calendar dates');
const tw = twseIndexLevel([{ Date: '1151016', Taiwan50Index: '43347.41' }, { Date: '1151015', Taiwan50Index: '43355.92' }], 'Taiwan50Index');
check(tw.level === 43347.41 && tw.changePct === -0.02 && tw.day === '2026-10-16', 'Taiwan 50 close and its close-to-close move');
let twErr = '';
try { twseIndexLevel([{ Date: '1151016', Other: '1' }], 'Taiwan50Index'); } catch (err) { twErr = err.message; }
check(/no Taiwan50Index field/.test(twErr), 'a TWSE schema change fails loudly');

// ── End to end, against stubbed upstreams ──
const T = 1792165000;   // 2026-10-16T15:36:40Z
const wikiPage = (rows, extra = '') => `{{Infobox\n| constituents = ${rows.length}\n}}\n${extra}{| class="wikitable sortable" id="constituents"\n! Company !! Sector !! [[GICS]] Sub-Industry !! Ticker\n${rows.map(([name, t]) => `|-\n| [[${name}]] || x || y || ${t}`).join('\n')}\n|}`;
const CAC = Array.from({ length: 40 }, (_, i) => [i === 0 ? 'Accor' : i === 1 ? '<img src=x onerror=alert(1)>' : `Company ${i}`, i === 0 ? 'AC.PA' : i === 2 ? 'MT.AS' : `C${String(i).padStart(2, '0')}.PA`]);
let mode = 'ok';
const asked = [];
let authCalls = 0;
const quoteFor = (s, i) => {
  if (s === '^FCHI') return { symbol: s, shortName: 'CAC 40', regularMarketPrice: 7956.7, regularMarketChangePercent: 0.2772, regularMarketTime: T };
  if (s.endsWith('=X')) return { symbol: s, regularMarketPrice: s.startsWith('USD') ? 0.9 : s.startsWith('GBP') ? 1.15 : 1.05, regularMarketTime: T };
  if (mode === 'nulls' && s === 'C03.PA') return { symbol: s, regularMarketPrice: null, regularMarketChangePercent: null };
  if ((mode === 'nulls' || mode === 'summary') && s === 'C04.PA') return { symbol: s, regularMarketPrice: 10, regularMarketChangePercent: 1, regularMarketTime: T, currency: 'EUR' };
  if (mode === 'nulls' && s === 'C06.PA') return { symbol: s, regularMarketPrice: 10, regularMarketChangePercent: 1, regularMarketTime: T, marketCap: 2e9, financialCurrency: 'EUR', sector: 'Energy' };
  if (mode === 'nulls' && s === 'C08.PA') return { symbol: s, regularMarketPrice: 10, regularMarketChangePercent: 1, regularMarketTime: T, marketCap: 2e9, financialCurrency: 'USD', sector: 'Energy' };
  if (mode === 'nulls' && s === 'C05.PA') return { symbol: s, regularMarketPrice: 10, regularMarketChangePercent: 1, regularMarketTime: T - 86400, marketCap: 1e9, currency: 'EUR', sector: 'Energy' };
  if (s.endsWith('.NS')) return { symbol: s, longName: `${s} Ltd`, regularMarketPrice: 1211.2, regularMarketChangePercent: -0.31, regularMarketTime: T, currency: 'INR', sector: 'Energy' };
  if (s.endsWith('.BO')) return { symbol: s, regularMarketPrice: 1210, regularMarketTime: T, marketCap: 1.6e13, sharesOutstanding: 1.35e10, currency: 'INR' };
  return { symbol: s, shortName: s, longName: `${s} SA`, regularMarketPrice: 100 + i, regularMarketChangePercent: ((i * 7) % 9) - 4, regularMarketTime: T, marketCap: 1e10 * (i + 1), sharesOutstanding: 1e8, currency: s === 'MT.AS' ? 'USD' : s.endsWith('.L') ? 'GBp' : s.endsWith('.SW') ? 'CHF' : 'EUR', sector: ['Technology', 'Industrials', 'Financial Services', 'Healthcare'][i % 4], industry: 'Things' };
};
const stub = async (url, opts = {}) => {
  const u = String(url);
  asked.push(u);
  if (u.startsWith('https://fc.yahoo.com')) { authCalls++; return new Response('nf', { status: 404, headers: { 'set-cookie': 'A3=d=abc; Path=/; Domain=.yahoo.com' } }); }
  if (u.includes('/v1/test/getcrumb')) return new Response(mode === 'nocrumb' ? '' : 'Crumb123ab');
  if (u.includes('en.wikipedia.org')) {
    if (mode === 'wiki-down') return new Response('down', { status: 503 });
    return new Response(JSON.stringify({ query: { pages: [{ revisions: [{ revid: 1379195393, timestamp: '2026-10-08T13:51:15Z', slots: { main: { content: wikiPage(CAC) } } }] }] } }));
  }
  if (u.includes('/v7/finance/quote')) {
    if (mode === '401-once' && !stub.did401) { stub.did401 = true; return new Response('{}', { status: 401 }); }
    if (mode === '429') return new Response('{}', { status: 429 });
    const syms = decodeURIComponent(/symbols=([^&]+)/.exec(u)[1]).split(',');
    if (syms.length > QUOTE_BATCH) return new Response('too many', { status: 400 });
    const drop = mode === 'one-missing' ? ['C07.PA'] : [];
    return new Response(JSON.stringify({ quoteResponse: { result: syms.filter(s => !drop.includes(s)).map((s, i) => quoteFor(s, i)) } }));
  }
  if (u.includes('dng-api.invesco.com')) return new Response(JSON.stringify({ effectiveDate: '2026-10-07', holdings: [{ name: 'ASML HOLDING ORD', isin: 'NL0010273215', weight: 4.7744 }, { name: 'HSBC HOLDINGS ORD', isin: 'GB0005405286', weight: 2.1808 }, { name: 'NOVARTIS N ORD', isin: 'CH0012005267', weight: 1.865 }, { name: 'GHOST ORD', isin: 'XS0000000009', weight: 0.01 }] }));
  if (u.includes('/v1/finance/search')) {
    const isin = /q=([A-Z0-9]+)/.exec(u)[1];
    const map = { NL0010273215: 'ASML.AS', GB0005405286: 'HSBA.L', CH0012005267: 'NOVN.SW' };
    return new Response(JSON.stringify({ quotes: map[isin] ? [{ symbol: map[isin], quoteType: 'EQUITY' }] : [] }));
  }
  if (u.includes('niftyindices.com')) return new Response('Company Name,Industry,Symbol,Series,ISIN Code\nReliance Industries Ltd.,Oil Gas & Consumable Fuels,RELIANCE,EQ,INE002A01018\n', { headers: { 'last-modified': 'Fri, 16 Oct 2026 12:00:00 GMT' } });
  if (u.includes('/v10/finance/quoteSummary/C04.PA') && mode === 'summary') return new Response(JSON.stringify({ quoteSummary: { result: [{ price: { marketCap: { raw: 5e9 }, currency: 'EUR' }, defaultKeyStatistics: {} }] } }));
  if (u.includes('/v1/finance/screener')) {
    const body = JSON.parse(opts.body);
    const ex = body.query.operands[0].operands[1];
    const rows = ex === 'SAU' ? [{ symbol: '2222.SR', longName: 'Saudi Arabian Oil Co.' }, { symbol: '4330.SR', longName: 'Riyad REIT Fund' }, { symbol: '4339.SR', shortName: 'Alinma Hospitality REIT' }, { symbol: '9510.SR', longName: 'National Building and Marketing Co.' }]
      : [{ symbol: '005930.KS' }, { symbol: '005935.KS' }, { symbol: '0126Z0.KS' }];
    return new Response(JSON.stringify({ finance: { result: [{ total: rows.length, quotes: body.offset ? [] : rows }] } }));
  }
  if (u.includes('moneydj.com')) return new Response(dj);
  if (u.includes('openapi.twse.com.tw')) return new Response(JSON.stringify([{ Date: '1151015', Taiwan50Index: '43355.92' }, { Date: '1151016', Taiwan50Index: '43347.41' }]));
  return new Response('not stubbed', { status: 404 });
};
const NOW = Date.parse('2026-10-16T16:00:00Z');

_resetIndexHeatmap();
let p = await fetchIndexHeatmap('cac40', { fetchImpl: stub, now: NOW });
check(p.ok && p.complete && p.integrity.drawn === 40 && p.integrity.expected === 40, `a full CAC 40 pull is complete (${p.integrity.drawn}/${p.integrity.constituents}, errors ${p.integrity.batchErrors})`);
check(p.membersAsOf === '2026-10-08' && p.membersAsOfKind === 'revision' && /oldid=1379195393/.test(p.sources.constituents.url) && /CC BY-SA/.test(p.sources.constituents.name), 'the list is dated by its revision and linked by its permanent id');
check(p.index.level === 7956.7 && p.index.changePct === 0.28 && p.sessionDay === '2026-10-16', 'index level, move and session day');
const mt = p.tiles.find(t => t.symbol === 'MT.AS');
check(mt && p.integrity.fx.USD === 0.9 && mt.size === Number((mt.size).toPrecision(3)), 'a member quoted in dollars is converted at the spot rate; sizes carry three significant figures');
check(p.sectors[0] && p.tiles.every(t => p.sectors.includes(t.sector)), 'every tile sits in a listed sector');
check(!/"[a-z]*weight[a-z]*":/i.test(JSON.stringify(p)), 'no weight field anywhere in the payload');
const firstCalls = asked.length;
const [pa, pb] = await Promise.all([fetchIndexHeatmap('cac40', { fetchImpl: stub, now: NOW + 60e3 }), fetchIndexHeatmap('cac40', { fetchImpl: stub, now: NOW + 60e3 })]);
check(pa.servedFromMemo && pb.servedFromMemo && pa.memoAgeSec === 60 && asked.length === firstCalls, 'a complete pull is reused for two minutes, with its age');
const p2 = await fetchIndexHeatmap('cac40', { fetchImpl: stub, now: NOW + 121e3 });
check(!p2.servedFromMemo && asked.length > firstCalls && !asked.slice(firstCalls).some(u => u.includes('wikipedia')), 'after two minutes the quotes are pulled again; the constituent list is reused');

mode = 'nulls'; _resetIndexHeatmap();
p = await fetchIndexHeatmap('cac40', { fetchImpl: stub, now: NOW });
check(p.integrity.missing.includes('C03') && p.integrity.unsized.includes('C04') && !p.tiles.some(t => t.code === 'C03' || t.code === 'C04'), 'a member with no price is missing, one with no cap is unsized — neither drawn at an invented size');
check(p.tiles.some(t => t.code === 'C06' && t.currency === 'EUR') && p.integrity.currencyInferred.join() === 'C06' && p.integrity.unsized.includes('C08'), "a quote with no currency takes its reporting currency only when it is the index's own; otherwise unsized");
const c05 = p.tiles.find(t => t.code === 'C05');
check(c05?.stale && p.integrity.staleQuotes.some(s => s.code === 'C05' && s.day === '2026-10-15') && !p.complete, 'a last trade from an earlier session is flagged stale, the pull partial');

mode = 'summary'; _resetIndexHeatmap();
p = await fetchIndexHeatmap('cac40', { fetchImpl: stub, now: NOW });
check(p.tiles.find(t => t.code === 'C04')?.size === 5e9 && p.integrity.capsDerived.some(x => x.code === 'C04' && /key statistics/.test(x.basis)), "a member the batch quote left without a cap is sized from Yahoo's key statistics, and says so");

mode = 'one-missing'; _resetIndexHeatmap();
p = await fetchIndexHeatmap('cac40', { fetchImpl: stub, now: NOW });
check(p.ok && !p.complete && p.integrity.missing.join() === 'C07', 'one member Yahoo did not answer is listed; the pull is partial');

mode = '401-once'; stub.did401 = false; _resetIndexHeatmap(); authCalls = 0;
p = await fetchIndexHeatmap('cac40', { fetchImpl: stub, now: NOW });
check(p.ok && authCalls === 2, 'a refused crumb is renewed once and the call retried');

mode = '429'; _resetIndexHeatmap();
p = await fetchIndexHeatmap('cac40', { fetchImpl: stub, now: NOW });
check(!p.ok && p.integrity.batchErrors.some(x => /429/.test(x)) && !p.tiles.length, 'a throttled Yahoo yields no tiles and says why');
const quotesAsked = asked.filter(u => u.includes('/v7/finance/quote')).length;
mode = 'ok';
p = await fetchIndexHeatmap('aex', { fetchImpl: stub, now: NOW + 46e3 }).catch(err => ({ error: err.message }));
check(asked.filter(u => u.includes('/v7/finance/quote')).length === quotesAsked, 'during the throttle cooldown no market asks Yahoo again');

mode = 'nocrumb'; _resetIndexHeatmap();
p = await fetchIndexHeatmap('cac40', { fetchImpl: stub, now: NOW });
check(!p.ok && p.integrity.batchErrors.some(x => /crumb/i.test(x)), 'no crumb, no quotes — said plainly');

mode = 'ok'; _resetIndexHeatmap();
await fetchIndexHeatmap('cac40', { fetchImpl: stub, now: NOW });
mode = 'wiki-down';
p = await fetchIndexHeatmap('cac40', { fetchImpl: stub, now: NOW + 13 * 3600e3 });
check(p.ok && /HTTP 503/.test(p.integrity.membersRefreshError) && p.integrity.membersCached && !p.complete, 'a failed list refresh keeps the dated list, says so, and is not complete');
_resetIndexHeatmap();
let listErr = '';
try { await fetchIndexHeatmap('cac40', { fetchImpl: stub, now: NOW }); } catch (err) { listErr = err.message; }
check(/Wikipedia HTTP 503/.test(listErr), 'with no list at all the map fails — no member list is invented');

mode = 'ok'; _resetIndexHeatmap();
p = await fetchIndexHeatmap('stoxx600', { fetchImpl: stub, now: NOW });
check(p.integrity.unresolved.join() === 'GHOST' && p.integrity.drawn === 3 && p.membersAsOf === '2026-10-07', 'ISINs resolve to listings through Yahoo search; one with no listing is named, not guessed');
check(p.integrity.fx.GBP === 1.15 && p.integrity.fx.CHF === 1.05 && !p.complete, 'pounds and francs converted to euros; 3 of 600 is not complete');
check(!JSON.stringify(p).includes('4.7744'), "Invesco's index weights are not carried");
const searches = asked.filter(u => u.includes('/v1/finance/search')).length;
await fetchIndexHeatmap('stoxx600', { fetchImpl: stub, now: NOW + 50e3 });
check(asked.filter(u => u.includes('/v1/finance/search')).length === searches + 1, 'a resolved ISIN is not searched again; only the unresolved one is retried');

_resetIndexHeatmap();
p = await fetchIndexHeatmap('nifty50', { fetchImpl: stub, now: NOW });
const rel = p.tiles.find(t => t.symbol === 'RELIANCE.NS');
check(rel && rel.size === 1.6e13 && p.integrity.capsDerived.some(x => x.code === 'RELIANCE' && /BO/.test(x.basis)) && p.membersAsOf === '2026-10-16', 'an NSE line with no cap takes the BSE line\'s cap, and says so; the file is dated by Last-Modified');

_resetIndexHeatmap();
p = await fetchIndexHeatmap('kospi', { fetchImpl: stub, now: NOW });
check(p.integrity.constituents === 2 && p.integrity.leftOut === 1 && p.integrity.listed === 3 && !p.tiles.some(t => t.symbol === '005935.KS'), 'KOSPI: common shares only, the preferred line left out and counted');

_resetIndexHeatmap();
p = await fetchIndexHeatmap('tasi', { fetchImpl: stub, now: NOW });
check(p.integrity.constituents === 1 && p.tiles[0]?.symbol === '2222.SR' && p.integrity.leftOut === 3, 'Tadawul: main-market company shares only — REIT funds and Nomu left out, and counted');

_resetIndexHeatmap();
p = await fetchIndexHeatmap('tw50', { fetchImpl: stub, now: NOW });
check(p.index?.close && p.index.level === 43347.41 && p.index.changePct === -0.02 && p.membersAsOf === '2026-10-16' && p.integrity.constituents === 2, "Taiwan 50: TWSE's official close as the level, the fund's dated holdings as the members");

// Batching: no request carries more than fifty symbols
check(asked.filter(u => u.includes('/v7/finance/quote')).every(u => decodeURIComponent(/symbols=([^&]+)/.exec(u)[1]).split(',').length <= QUOTE_BATCH), 'quotes are asked fifty symbols at a time');
check(MARKET_IDS.length === 16 && MARKET_IDS.every(id => MARKETS[id].tz && MARKETS[id].currency && MARKETS[id].city && (MARKETS[id].index || MARKETS[id].indexTwse)), 'sixteen markets, each with a zone, currency, city and an index level source');

// ── The route ──
const realFetch = globalThis.fetch;
globalThis.fetch = (u, o) => stub(u, o);
const { default: invest } = await import('../api/invest/[action].js');
const mkRes = () => { const r = { code: 0, payload: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end() {} }; r.status = x => { r.code = x; return r; }; r.json = x => { r.payload = x; return r; }; return r; };
const call = async q => { const r = mkRes(); await invest({ method: 'GET', url: `/api/invest/index-heatmap${q}`, headers: { host: 'localhost', 'x-forwarded-for': '8.8.4.4' } }, r); return r; };
mode = 'ok'; _resetIndexHeatmap();
let r = await call('?market=cac40');
check(r.code === 200 && r.payload.ok && r.headers['Cache-Control'] === 's-maxage=120', 'complete pull cached two minutes');
mode = 'one-missing'; _resetIndexHeatmap();
r = await call('?market=cac40');
check(r.payload.ok && !r.payload.complete && r.headers['Cache-Control'] === 's-maxage=30', 'partial pull cached thirty seconds');
mode = 'wiki-down'; _resetIndexHeatmap();
r = await call('?market=cac40');
check(r.payload.ok === false && /503/.test(r.payload.error) && r.headers['Cache-Control'] === 'no-store', 'failure is honest and uncached');
r = await call('?market=<script>');
check(r.code === 400 && !/<script>/.test(r.payload.error), 'an unknown market is refused without echoing markup');
globalThis.fetch = realFetch;

// ── Renderer ──
mode = 'ok'; _resetIndexHeatmap();
p = await fetchIndexHeatmap('cac40', { fetchImpl: stub, now: NOW });
check(!p.tiles.some(t => /<img|onerror/.test(t.name)), 'markup in a Wikipedia cell is taken off before it becomes a name');
const hostile = { ...p.tiles[0], name: '<img src=x onerror=alert(1)>', code: '"><b>', industry: '<script>', rect: { x: 0, y: 0, w: 300, h: 120 } };
const html = tileHtml(hostile, 9, t => tileSummary(t, 'EUR'));
check(!/<img|<script|<b>/.test(html) && /&lt;img/.test(html), 'a hostile name is escaped in the tile and its label');
check(/market cap €/.test(tileSummary(p.tiles[0], 'EUR')) && fmtCap(5.67e11, 'EUR') === '€567B' && fmtCap(1.54e9, 'EUR') === '€1.5B' && fmtCap(1e9, 'XXX1').startsWith('XXX1'), 'tile summary carries the market cap in the index currency');
const groups = layout(p, 1000, 600);
check(groups.reduce((s, g) => s + g.tiles.length, 0) === p.tiles.length, 'every sized tile is laid out');

// ── The xlsx reader on a real-shaped workbook ──
{
  const { deflateRawSync } = await import('node:zlib');
  const files = {
    'xl/workbook.xml': '<x:workbook xmlns:x="m" xmlns:r="r"><x:sheets><x:sheet name="holdings" sheetId="1" r:id="rId1"/></x:sheets></x:workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<x:sst><x:si><x:t>Ticker</x:t></x:si><x:si><x:r><x:t>D05</x:t></x:r><x:r><x:t>-SG</x:t></x:r></x:si></x:sst>',
    'xl/worksheets/sheet1.xml': '<x:worksheet><x:sheetData><x:row r="1"><x:c r="B1" t="s"><x:v>0</x:v></x:c></x:row><x:row r="2"><x:c r="B2" t="s"><x:v>1</x:v></x:c><x:c r="C2"><x:v>74.11</x:v></x:c></x:row></x:sheetData></x:worksheet>',
  };
  const parts = [], central = [];
  let off = 0;
  for (const [name, text] of Object.entries(files)) {
    const nm = Buffer.from(name), data = deflateRawSync(Buffer.from(text));
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt16LE(nm.length, 26);
    parts.push(lh, nm, data);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, nm);
    off += 30 + nm.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  const book = readXlsx(Buffer.concat([...parts, cd, end]));
  check(book.sheets[0].name === 'holdings' && book.sheets[0].rows[1].join('|') === '|D05-SG|74.11', `xlsx: namespaced parts, rich text, sparse columns (${JSON.stringify(book.sheets[0]?.rows)})`);
  let zipErr = '';
  try { readXlsx(Buffer.from('not a zip')); } catch (err) { zipErr = err.message; }
  check(/not a ZIP/.test(zipErr), 'a file that is not a workbook is refused');
}

if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('index heatmaps: sixteen markets, every constituent reader, quote rules, sessions, throttle, memo, route and escaping — all checks passed');
