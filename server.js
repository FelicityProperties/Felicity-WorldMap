// ═══════════════════════════════════════════════════════════
// SERVER — local development host for the Vercel functions
// ═══════════════════════════════════════════════════════════
//
// Serves the static site and mounts every function under api/ at the
// same route Vercel gives it, so local development runs the SAME code
// as production. An earlier version carried its own copies of the intel
// and stock-brief prompts — stale duplicates that drifted from api/ and
// still told the model to be "data-driven" with no data. Nothing here
// owns a prompt any more; api/ does.
//
// Usage:
//   ANTHROPIC_API_KEY=sk-... FINNHUB_API_KEY=... node server.js
//
// Route mapping mirrors Vercel's filesystem routing:
//   api/intel.js             → /api/intel
//   api/desk/ask.js          → /api/desk/ask
//   api/invest/[action].js   → /api/invest/:action
// ═══════════════════════════════════════════════════════════

import express from 'express';
import { readdirSync, statSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join, relative } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ── CORS headers for API routes ──
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Mount api/**/*.js exactly as Vercel would ──
function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.js') ? [full] : [];
  });
}

const apiDir = join(__dirname, 'api');
for (const file of walk(apiDir)) {
  const route = '/api/' + relative(apiDir, file)
    .replace(/\.js$/, '')
    .split(/[\\/]/)
    .map(seg => seg.replace(/^\[(.+)\]$/, ':$1'))
    .join('/');
  const { default: handler } = await import(pathToFileURL(file).href);
  if (typeof handler !== 'function') continue;
  // Express 4 does not catch async rejections; without the .catch a throw
  // outside the handler's own try would take the dev server down.
  app.all(route, (req, res, next) => Promise.resolve(handler(req, res)).catch(next));
  console.log(`  mounted ${route}`);
}

// ── Static file serving ──
app.use(express.static(__dirname));

// ── SPA fallback — serve index.html for all non-API routes ──
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Felicity Intelligence dev server on http://localhost:${PORT}`);
});
