import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  try {
    const sql = neon(connectionString);

    // Fetch all tables in parallel
    const [countries, marketsData, newsData, flightsData, shipsData, conflictsData, signalsData] = await Promise.all([
      sql`SELECT name, cii_score, region FROM countries ORDER BY name`,
      sql`SELECT symbol, name, price, change_pct, type FROM markets ORDER BY id`,
      sql`SELECT category, label, title, region, time_ago FROM news ORDER BY id`,
      sql`SELECT callsign, origin, destination, lat, lng, altitude, type, heading FROM flights ORDER BY id`,
      sql`SELECT name, type, lat, lng, speed, destination FROM ships ORDER BY id`,
      sql`SELECT name, lat, lng, severity FROM conflict_zones ORDER BY id`,
      sql`SELECT trigger_event, chain, sector, impact, sentiment, time_ago FROM dubai_signals ORDER BY id`,
    ]);

    // Transform countries into the ciiScores / regionMap format the frontend expects
    const ciiScores = {};
    const regionMap = {};
    countries.forEach(c => {
      if (c.cii_score !== null) ciiScores[c.name] = parseFloat(c.cii_score);
      if (c.region) regionMap[c.name] = c.region;
    });

    // Transform markets
    const markets = marketsData.map(m => ({
      sym: m.symbol,
      name: m.name,
      price: parseFloat(m.price),
      chg: parseFloat(m.change_pct),
      type: m.type,
    }));

    // Transform news
    const news = newsData.map(n => ({
      cat: n.category,
      lbl: n.label,
      title: n.title,
      region: n.region,
      time: n.time_ago,
    }));

    // Transform flights
    const flights = flightsData.map(f => ({
      call: f.callsign,
      from: f.origin,
      to: f.destination,
      lat: parseFloat(f.lat),
      lng: parseFloat(f.lng),
      alt: f.altitude,
      type: f.type,
      hdg: f.heading,
    }));

    // Transform ships
    const ships = shipsData.map(s => ({
      name: s.name,
      type: s.type,
      lat: parseFloat(s.lat),
      lng: parseFloat(s.lng),
      speed: s.speed,
      dest: s.destination,
    }));

    // Transform conflict zones
    const confZones = conflictsData.map(c => ({
      name: c.name,
      lat: parseFloat(c.lat),
      lng: parseFloat(c.lng),
      sev: c.severity,
    }));

    // Transform Dubai signals
    const dubaiSignals = signalsData.map(s => ({
      trigger: s.trigger_event,
      chain: s.chain,
      sector: s.sector,
      impact: s.impact,
      sentiment: s.sentiment,
      time: s.time_ago,
    }));

    // Cache for 60 seconds
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

    return res.status(200).json({
      ciiScores,
      regionMap,
      markets,
      news,
      flights,
      ships,
      confZones,
      dubaiSignals,
    });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Failed to fetch data' });
  }
}
