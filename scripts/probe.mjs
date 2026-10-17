// Fetches each target from a GitHub runner and prints what came back —
// status, content type and the head of the body — so a new upstream is
// built against its real response, not a guess. Diagnostics only: nothing
// is stored or pushed anywhere. Run by .github/workflows/probe.yml.
//
// PROBE_TARGETS: whitespace-separated. A plain URL is fetched as-is.
// "yahoo-crumb:SYM,SYM" runs Yahoo's cookie + crumb handshake and asks
// the v7 quote endpoint for those symbols with it.
// "post:URL::BASE64" POSTs the base64-decoded body (JSON) to URL.
// PROBE_TIMEOUT: per-request timeout in ms (default 15000).

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const HEAD = Number(process.env.PROBE_HEAD || 3000);
const TIMEOUT = Number(process.env.PROBE_TIMEOUT || 15000);

async function show(label, res, t0) {
  const text = await res.text();
  console.log(`\n=== ${label}`);
  console.log(`status ${res.status} · ${Date.now() - t0} ms · ${res.headers.get('content-type') || '?'} · ${text.length} bytes`);
  console.log(text.slice(0, HEAD));
  return text;
}

async function plain(url) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(TIMEOUT) });
    await show(url, res, t0);
  } catch (e) {
    console.log(`\n=== ${url}\nERROR ${e.message}${e.cause ? ` (${e.cause.code || e.cause.message})` : ''}`);
  }
}

async function post(spec) {
  const [url, b64] = spec.split('::');
  const t0 = Date.now();
  try {
    const body = Buffer.from(b64 || '', 'base64').toString('utf8');
    const res = await fetch(url, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json' }, body, signal: AbortSignal.timeout(TIMEOUT) });
    await show(`POST ${url} ${body.slice(0, 160)}`, res, t0);
  } catch (e) {
    console.log(`\n=== POST ${url}\nERROR ${e.message}${e.cause ? ` (${e.cause.code || e.cause.message})` : ''}`);
  }
}

async function yahooCrumb(symbols) {
  try {
    const t0 = Date.now();
    const seed = await fetch('https://fc.yahoo.com/', { headers: { 'User-Agent': UA }, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT) });
    const cookies = (seed.headers.getSetCookie?.() || []).map(c => c.split(';')[0]);
    console.log(`\n=== yahoo cookie seed: status ${seed.status}, cookies: ${cookies.map(c => c.split('=')[0]).join(', ') || 'none'} (${Date.now() - t0} ms)`);
    const cookie = cookies.join('; ');
    const cr = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': UA, Cookie: cookie }, signal: AbortSignal.timeout(TIMEOUT) });
    const crumb = (await cr.text()).trim();
    console.log(`=== yahoo crumb: status ${cr.status}, length ${crumb.length}`);
    if (cr.status !== 200 || !crumb) return;
    const q = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&crumb=${encodeURIComponent(crumb)}`,
      { headers: { 'User-Agent': UA, Cookie: cookie, Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT) });
    await show(`yahoo v7 quote WITH crumb: ${symbols}`, q, Date.now());
  } catch (e) {
    console.log(`\n=== yahoo crumb flow ERROR ${e.message}${e.cause ? ` (${e.cause.code || e.cause.message})` : ''}`);
  }
}

const targets = (process.env.PROBE_TARGETS || '').split(/\s+/).filter(Boolean);
if (!targets.length) { console.log('No PROBE_TARGETS given.'); process.exit(0); }
for (const t of targets) {
  if (t.startsWith('yahoo-crumb:')) await yahooCrumb(t.slice('yahoo-crumb:'.length));
  else if (t.startsWith('post:')) await post(t.slice('post:'.length));
  else await plain(t);
}
