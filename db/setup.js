// ═══════════════════════════════════════════════════════════
// DB SETUP — Run schema + seed against Neon
// Usage: DATABASE_URL=<your-neon-url> node db/setup.js
// ═══════════════════════════════════════════════════════════

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function setup() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('ERROR: Set DATABASE_URL environment variable to your Neon connection string.');
    console.error('Example: DATABASE_URL=postgresql://user:pass@host/db node db/setup.js');
    process.exit(1);
  }

  const sql = neon(connectionString);

  console.log('Running schema.sql...');
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  // Split on semicolons and run each statement
  const schemaStatements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of schemaStatements) {
    await sql(stmt);
  }
  console.log('Schema created.');

  console.log('Running seed.sql...');
  const seed = readFileSync(join(__dirname, 'seed.sql'), 'utf-8');
  const seedStatements = seed.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of seedStatements) {
    await sql(stmt);
  }
  console.log('Seed data inserted.');

  console.log('Done! Database is ready.');
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
