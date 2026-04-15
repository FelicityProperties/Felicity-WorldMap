-- ═══════════════════════════════════════════════════════════
-- Felicity WorldMap — Neon PostgreSQL Schema
-- ═══════════════════════════════════════════════════════════

-- Countries & CII Scores
CREATE TABLE IF NOT EXISTS countries (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  cii_score DECIMAL(3,1),
  region VARCHAR(50)
);

-- Market Instruments
CREATE TABLE IF NOT EXISTS markets (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(80) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  change_pct DECIMAL(6,2) NOT NULL DEFAULT 0,
  type VARCHAR(20) NOT NULL
);

-- News Feed
CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  category VARCHAR(20) NOT NULL,
  label VARCHAR(30) NOT NULL,
  title TEXT NOT NULL,
  region VARCHAR(50),
  time_ago VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Flights
CREATE TABLE IF NOT EXISTS flights (
  id SERIAL PRIMARY KEY,
  callsign VARCHAR(30) NOT NULL,
  origin VARCHAR(50) NOT NULL,
  destination VARCHAR(50) NOT NULL,
  lat DECIMAL(7,2) NOT NULL,
  lng DECIMAL(7,2) NOT NULL,
  altitude VARCHAR(20),
  type VARCHAR(10) NOT NULL DEFAULT 'com',
  heading INT DEFAULT 0
);

-- Ships / Vessels
CREATE TABLE IF NOT EXISTS ships (
  id SERIAL PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  type VARCHAR(20) NOT NULL,
  lat DECIMAL(7,2) NOT NULL,
  lng DECIMAL(7,2) NOT NULL,
  speed VARCHAR(20),
  destination VARCHAR(60)
);

-- Conflict Zones
CREATE TABLE IF NOT EXISTS conflict_zones (
  id SERIAL PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  lat DECIMAL(7,2) NOT NULL,
  lng DECIMAL(7,2) NOT NULL,
  severity INT NOT NULL CHECK (severity BETWEEN 1 AND 10)
);

-- Dubai RE Signals
CREATE TABLE IF NOT EXISTS dubai_signals (
  id SERIAL PRIMARY KEY,
  trigger_event VARCHAR(100) NOT NULL,
  chain TEXT NOT NULL,
  sector VARCHAR(80) NOT NULL,
  impact VARCHAR(20) NOT NULL,
  sentiment VARCHAR(10) NOT NULL CHECK (sentiment IN ('bullish', 'bearish')),
  time_ago VARCHAR(20)
);
