// Owner analytics: what a beacon may store, what it may not, and who may
// read the numbers. No database here, so storage reports honestly and the
// stats endpoint refuses rather than inventing an empty dashboard.
import { buildEvent, parseUA, refHost, isBot } from '../lib/analytics.js';
import { readFileSync } from 'node:fs';

const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const hdr = (ua, extra = {}) => new Headers({ 'user-agent': ua, 'x-vercel-ip-country': 'ae', 'x-vercel-ip-city': 'Dubai', 'x-vercel-ip-country-region': 'DU', 'x-forwarded-for': '203.0.113.9', ...extra });
const body = (o = {}) => ({ kind: 'pageview', tab: 'overview', vid: 'abcdef0123456789abcdef01', sid: '0123456789abcdef01234567', ref: 'https://www.linkedin.com/feed/some/post?x=1', newVisitor: true, ...o });

// What is kept
const ok = buildEvent(body(), hdr(CHROME_MAC), 'felicity-world-map.vercel.app').event;
check(ok && ok.country === 'AE' && ok.city === 'Dubai' && ok.device === 'desktop' && ok.browser === 'Chrome' && ok.os === 'macOS', `geo and device kept (${JSON.stringify(ok)})`);
check(ok.ref === 'linkedin.com', 'referrer reduced to its host');
check(ok.isNew === true && ok.tab === 'overview', 'new visitor and tab kept');

// What is never kept
const flat = JSON.stringify(ok);
check(!flat.includes('203.0.113.9'), 'no IP address in the stored row');
check(!flat.includes('Mozilla') && !flat.includes('feed/some/post'), 'no raw user agent, no full referrer URL');

// What is dropped
check(buildEvent(body(), hdr('Mozilla/5.0 (compatible; Googlebot/2.1)'), 'x').skip === 'bot', 'search crawler dropped');
check(buildEvent(body(), hdr('WhatsApp/2.23'), 'x').skip === 'bot', 'link-preview fetcher dropped');
check(buildEvent(body(), hdr('Mozilla/5.0 HeadlessChrome/129.0'), 'x').skip === 'bot', 'headless browser dropped');
check(buildEvent(body(), hdr(''), 'x').skip === 'bot', 'no user agent dropped');
check(buildEvent(body({ kind: 'drop table' }), hdr(CHROME_MAC), 'x').skip === 'bad kind', 'unknown kind rejected');
check(buildEvent(body({ vid: '<script>' }), hdr(CHROME_MAC), 'x').skip === 'bad ids', 'malformed visitor id rejected');
check(buildEvent(null, hdr(CHROME_MAC), 'x').skip === 'bad body', 'non-object body rejected');
check(buildEvent(body({ tab: '<img onerror>' }), hdr(CHROME_MAC), 'x').event.tab === null, 'unknown tab stored as null, never as given');
check(buildEvent(body({ kind: 'leave', secs: 1e9 }), hdr(CHROME_MAC), 'x').event.secs === 21600, 'time on site capped at six hours');
check(refHost('https://felicity-world-map.vercel.app/x', 'felicity-world-map.vercel.app') === '' && refHost('javascript:alert(1)', 'x') === '', 'same-site and non-URL referrers are direct');

// Parsing
check(parseUA(IPHONE).device === 'mobile' && parseUA(IPHONE).os === 'iOS' && parseUA(IPHONE).browser === 'Safari', 'iPhone Safari parsed');
check(isBot('Mozilla/5.0 (compatible; bingbot/2.0)') && !isBot(CHROME_MAC), 'bot test');

// Routes (edge-style)
const { default: data } = await import('../api/data.js');
delete process.env.DATABASE_URL;
const hit = await data(new Request('http://localhost/api/data?layer=hit', { method: 'POST', headers: { 'user-agent': CHROME_MAC }, body: JSON.stringify(body()) }));
check(hit.status === 204, 'beacon always answers 204, even with no database');
const big = await data(new Request('http://localhost/api/data?layer=hit', { method: 'POST', headers: { 'user-agent': CHROME_MAC, 'content-length': '5000' }, body: 'x'.repeat(5000) }));
check(big.status === 204, 'oversized beacon ignored');
check((await data(new Request('http://localhost/api/data?layer=hit'))).status === 405, 'GET on the beacon is a 405');

delete process.env.ANALYTICS_KEY;
let st = await data(new Request('http://localhost/api/data?layer=stats'));
check(st.status === 503 && /ANALYTICS_KEY/.test((await st.json()).error), 'stats refuse when no key is configured');
process.env.ANALYTICS_KEY = 'owner-key-123456';
st = await data(new Request('http://localhost/api/data?layer=stats', { headers: { Authorization: 'Bearer wrong-key-1234567' } }));
check(st.status === 401, 'wrong key is a 401');
st = await data(new Request('http://localhost/api/data?layer=stats'));
check(st.status === 401, 'missing key is a 401');
st = await data(new Request('http://localhost/api/data?layer=stats', { headers: { Authorization: 'Bearer owner-key-123456' } }));
const sj = await st.json();
check(st.status === 503 && sj.ok === false && /DATABASE_URL/.test(sj.error), 'right key without a database reports why, never an empty dashboard');
delete process.env.ANALYTICS_KEY;

// The page side: opt-outs honoured, dashboard not indexed, values escaped
const tracker = readFileSync(new URL('../js/analytics.js', import.meta.url), 'utf8');
check(/doNotTrack/.test(tracker) && /globalPrivacyControl/.test(tracker) && /fi_owner/.test(tracker), 'tracker honours DNT, GPC and the owner flag');
const page = readFileSync(new URL('../analytics.html', import.meta.url), 'utf8');
check(/noindex/.test(page), 'dashboard is noindex');
const dash = readFileSync(new URL('../js/analytics-dashboard.js', import.meta.url), 'utf8');
check(/import \{ escapeHtml as esc \} from '\.\/safe\.js'/.test(dash) && !/\$\{v\.(city|ref|browser)\}/.test(dash), 'dashboard escapes visitor-supplied values');

if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('analytics: beacons keep geo/device/tab only, drop bots, never store IPs; stats need the owner key — all checks passed');
