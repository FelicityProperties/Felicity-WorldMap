// ═══════════════════════════════════════════════════════════
// MAP — Leaflet Init, GeoJSON, Layers, Markers, Animation
// ═══════════════════════════════════════════════════════════

import { ciiScores, regionMap, flights, ships, confZones, events } from './data.js';
import { layerMeta } from './live-layers.js';
import { ciiColor } from './utils.js';
import { escapeHtml, safeUrl } from './safe.js';
// Vendored (js/vendor/topojson-client, BSD) so the map does not depend on a CDN
import { feature as topoFeature } from './vendor/topojson-client/index.js';

// ── Basemap ──
// CARTO's basemap tiles started demanding an API key ("API KEY REQUIRED"
// printed across every tile), which is what blanked the map. Esri's World
// Dark Gray Canvas is served without a key and requires attribution, so the
// attribution control is on. If Esri ever fails too, the second provider is
// OpenStreetMap's own tiles darkened with a CSS filter.
const BASEMAPS = [
  {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    options: { maxZoom: 16, attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ' },
    cssClass: '',
  },
  {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
    cssClass: 'map--osm-dark',
  },
];
let basemapIndex = 0, basemapLayer = null, tileErrors = 0;

function mountBasemap() {
  const b = BASEMAPS[basemapIndex];
  if (basemapLayer) map.removeLayer(basemapLayer);
  tileErrors = 0;
  document.getElementById('map')?.classList.toggle('map--osm-dark', b.cssClass === 'map--osm-dark');
  basemapLayer = L.tileLayer(b.url, b.options).addTo(map);
  basemapLayer.on('tileerror', () => {
    // A handful of failed tiles is normal; a burst means the provider is gone
    if (++tileErrors >= 8 && basemapIndex < BASEMAPS.length - 1) {
      console.warn('[map] basemap failing, switching provider');
      basemapIndex++;
      mountBasemap();
    }
  });
}

let map, geoLayer;
let fMarkers = [], sMarkers = [], cMarkers = [], eMarkers = [];
// Thousands of live aircraft are drawn on one canvas, not as DOM nodes
let canvas = null;
let layerState = { choropleth: true, conflicts: true, flights: true, ships: true, events: true };
let onCountryClick = null;

export function getMap() { return map; }
export function getLayerState() { return layerState; }

export function setCountryClickHandler(fn) {
  onCountryClick = fn;
}

// ── Map Init ──
export function initMap() {
  map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
    minZoom: 2,
  }).setView([20, 20], 2);
  map.attributionControl.setPrefix('');   // tiles and data credits only, no Leaflet flag
  mountBasemap();

  L.control.zoom({ position: 'bottomright' }).addTo(map);
  canvas = L.canvas({ padding: 0.3 });

  loadGeoJSON();
  return map;
}

// ── GeoJSON Loading ──
// Country geometry and names are served from this site (assets/geo — the
// Natural Earth 110m world atlas and the world-countries name table), not
// from jsDelivr/unpkg: two CDNs and a dynamic import were three separate ways
// for the choropleth to silently never appear.
async function loadGeoJSON() {
  try {
    const [topoRes, nameRes] = await Promise.all([
      fetch('assets/geo/countries-110m.json'),
      fetch('assets/geo/country-names.json'),
    ]);
    if (!topoRes.ok || !nameRes.ok) throw new Error(`geo assets HTTP ${topoRes.status}/${nameRes.status}`);
    const topo = await topoRes.json();
    const idToName = await nameRes.json();   // { "784": "United Arab Emirates", ... }
    const geo = fixAntimeridian(topoFeature(topo, topo.objects.countries));

    // Map world-countries common names to our ciiScores keys where they differ
    const nameAliases = {
      'United States': 'United States of America',
      'Congo': 'Congo',
      'DR Congo': 'Dem. Rep. Congo',
      'Czech Republic': 'Czechia',
      'Ivory Coast': "Côte d'Ivoire",
      'South Korea': 'S. Korea',
      'Timor-Leste': 'Timor-Leste',
      'Cabo Verde': 'Cape Verde',
      'Sao Tome and Principe': 'São Tomé and Príncipe',
      'Swaziland': 'Eswatini',
      'Macedonia': 'North Macedonia',
      'Myanmar': 'Myanmar',
      'Brunei Darussalam': 'Brunei',
    };

    // Reverse: map our ciiScores keys so lookups work both ways
    const resolvedIdToName = {};
    for (const [id, name] of Object.entries(idToName)) {
      resolvedIdToName[id] = name;
      // If the name from world-countries doesn't exist in ciiScores, try aliases
      if (!ciiScores[name]) {
        for (const [alias, canonical] of Object.entries(nameAliases)) {
          if (name === alias && ciiScores[canonical]) {
            resolvedIdToName[id] = canonical;
            break;
          }
        }
        // Also try matching our ciiScores keys by checking if any key is contained in the name
        if (!ciiScores[resolvedIdToName[id]]) {
          for (const key of Object.keys(ciiScores)) {
            if (name.includes(key) || key.includes(name)) {
              resolvedIdToName[id] = key;
              break;
            }
          }
        }
      }
    }

    renderGeo(geo, resolvedIdToName);
  } catch (e) {
    console.error('GeoJSON load failed:', e);
    updateCountryCount();
  }
}

// A ring that touches both −180° and +180° (Russia's Chukotka piece, Fiji,
// Kiribati) is drawn by Leaflet as a band across the whole world. Shifting
// that ring's western longitudes by +360° keeps it a compact shape past the
// dateline, which Leaflet wraps correctly.
function fixAntimeridian(geo) {
  const fixRing = ring => {
    let min = Infinity, max = -Infinity;
    for (const [lng] of ring) { if (lng < min) min = lng; if (lng > max) max = lng; }
    return (max - min > 300) ? ring.map(([lng, lat]) => [lng < 0 ? lng + 360 : lng, lat]) : ring;
  };
  for (const f of geo.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') g.coordinates = g.coordinates.map(fixRing);
    else if (g.type === 'MultiPolygon') g.coordinates = g.coordinates.map(poly => poly.map(fixRing));
  }
  return geo;
}

// ── Choropleth Rendering ──
function renderGeo(geo, idToName) {
  if (geoLayer) map.removeLayer(geoLayer);
  if (!layerState.choropleth) {
    updateCountryCount();
    return;
  }

  geoLayer = L.geoJSON(geo, {
    style: f => {
      const name = idToName[parseInt(f.id)] || '';
      const score = ciiScores[name];
      return {
        fillColor: ciiColor(score),
        fillOpacity: 0.8,
        color: '#0a1020',
        weight: 0.5
      };
    },
    onEachFeature: (f, layer) => {
      const name = idToName[parseInt(f.id)] || 'Unknown';
      const score = ciiScores[name];
      const reg = regionMap[name] || '';

      layer.bindTooltip(
        `<b>${name}</b>${score ? '<br>CII ' + score.toFixed(1) + '/10' : ''}`,
        { sticky: true, direction: 'top' }
      );

      layer.on('click', () => {
        if (onCountryClick) onCountryClick(name, score, reg);
      });

      layer.on('mouseover', e => {
        e.target.setStyle({
          fillOpacity: 1,
          weight: 1.5,
          color: '#00d4ff'
        });
        e.target.bringToFront();
      });

      layer.on('mouseout', e => {
        geoLayer.resetStyle(e.target);
      });
    }
  }).addTo(map);

  updateCountryCount();
}

// ── Marker Icon Factory ──
function mkIcon(color, size = 8, square = false) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border-radius:${square ? '2px' : '50%'};
      border:1.5px solid rgba(255,255,255,0.5);
      box-shadow:0 0 8px ${color}44;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

// ── Dynamic Layer Rendering ──
export function renderDynLayers() {
  if (!map) return;   // a live-layer refresh can land before the map tab has ever been opened
  // Clear existing
  fMarkers.forEach(m => map.removeLayer(m));
  sMarkers.forEach(m => map.removeLayer(m));
  cMarkers.forEach(m => map.removeLayer(m));
  eMarkers.forEach(m => map.removeLayer(m));
  fMarkers = [];
  sMarkers = [];
  cMarkers = [];
  eMarkers = [];

  // Live conflict-news locations (GDELT, last 24h) — sized by article count
  if (layerState.events) {
    events.forEach(e => {
      const n = e.count || 1;
      const r = Math.min(16, 4 + Math.log2(n + 1) * 2);
      const m = L.circleMarker([e.lat, e.lng], {
        renderer: canvas, radius: r, color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.22, weight: 1,
      }).addTo(map);
      const link = e.url ? `<br><a href="${safeUrl(e.url)}" target="_blank" rel="noopener" style="color:#00d4ff">${escapeHtml(e.title || 'Lead article')} ↗</a>` : '';
      m.bindPopup(`<b>${escapeHtml(e.name)}</b><br>${n} article${n === 1 ? '' : 's'} in the last 24h · GDELT${link}`);
      m.bindTooltip(`${escapeHtml(e.name)} · ${n}`, { direction: 'top' });
      eMarkers.push(m);
    });
  }

  // Conflict zones
  if (layerState.conflicts) {
    confZones.forEach(c => {
      const r = c.sev > 8 ? 14 : c.sev > 6 ? 10 : 8;
      const m = L.circleMarker([c.lat, c.lng], {
        radius: r,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.25,
        weight: 1.5
      }).addTo(map);
      const reInfo = c.reCapitalFlow ? `<br><span style="color:#d4af37">Capital Flow:</span> ${c.reCapitalFlow}` : '';
      const reAreasInfo = c.reAreas ? `<br><span style="color:#d4af37">Dubai Areas:</span> ${c.reAreas.join(', ')}` : '';
      const reHistInfo = c.reHistoricalImpact ? `<br><span style="color:#d4af37;font-size:10px">${c.reHistoricalImpact}</span>` : '';
      m.bindTooltip(
        `<b>${c.name}</b><br>Severity ${c.sev}/10${reInfo}${reAreasInfo}${reHistInfo}`,
        { direction: 'top' }
      );
      m.on('click', () => {
        if (onCountryClick) {
          onCountryClick(c.name, ciiScores[c.name], regionMap[c.name] || '');
        }
      });
      cMarkers.push(m);
    });
  }

  // Live aircraft (OpenSky ADS-B). Thousands of points, so they go on the
  // canvas renderer as small circles; the tooltip carries what the feed
  // actually reports \u2014 callsign, registry country, altitude, speed, track.
  if (layerState.flights) {
    flights.forEach(f => {
      const m = L.circleMarker([f.lat, f.lng], {
        renderer: canvas, radius: 2.2, color: '#3b82f6', fillColor: '#60a5fa', fillOpacity: 0.85, weight: 0.6,
      }).addTo(map);
      const alt = f.alt != null ? `${Math.round(f.alt * 3.281).toLocaleString('en-US')} ft` : 'alt n/a';
      const spd = f.vel != null ? `${Math.round(f.vel * 1.944)} kn` : '';
      const hdg = f.hdg != null ? `${f.hdg}\u00b0` : '';
      m.bindTooltip(
        `<b>${escapeHtml(f.call || f.icao)}</b><br>${escapeHtml(f.country)}<br>${alt}${spd ? ' \u00b7 ' + spd : ''}${hdg ? ' \u00b7 ' + hdg : ''}`,
        { direction: 'top' }
      );
      fMarkers.push(m);
    });
  }

  // Ship markers
  if (layerState.ships) {
    ships.forEach(s => {
      const col = s.type === 'tanker' ? '#f59e0b' : s.type === 'dark' ? '#ef4444' : '#22c55e';
      const sz = s.type === 'dark' ? 10 : 7;
      const m = L.marker([s.lat, s.lng], {
        icon: mkIcon(col, sz)
      }).addTo(map);
      const extra = s.type === 'dark'
        ? '<br><span style="color:#ef4444">\u26a0 AIS transponder offline</span>'
        : '';
      m.bindTooltip(
        `<b>${s.name}</b><br>${s.speed} \u2192 ${s.dest}${extra}`,
        { direction: 'top' }
      );
      sMarkers.push(m);
    });
  }

  updateStatusCounts();
}

// ── Layer Toggle ──
export function toggleLayer(name, btn) {
  layerState[name] = !layerState[name];
  btn.classList.toggle('active');

  if (name === 'choropleth') {
    if (geoLayer) {
      layerState.choropleth ? map.addLayer(geoLayer) : map.removeLayer(geoLayer);
    }
  } else {
    renderDynLayers();
  }
}

// ── No simulated movement ──
// Aircraft positions are OpenSky state vectors and move only when a new
// fetch lands. An earlier build drifted a hardcoded corridor set across the
// map on a timer (`f.lat += cos(hdg) * 0.025`) to look live; that was
// fabrication and is gone. Ships remain a labelled reference set — there is
// no free, licensed AIS feed.
// ── Status Updates ──
function updateCountryCount() {
  const el = document.getElementById('ctrycount');
  if (el) el.textContent = Object.keys(ciiScores).length + ' countries';
}

function updateStatusCounts() {
  const fc = document.getElementById('fcount');
  const sc = document.getElementById('scount');
  const cc = document.getElementById('ccount');
  const ec = document.getElementById('ecount');
  // The reason for a missing feed rides on the label's tooltip so an outage
  // can be read from the status bar without opening the console
  if (fc) {
    fc.textContent = layerMeta.flights.ok || flights.length ? `${flights.length.toLocaleString('en-US')} aircraft` : 'aircraft: no feed';
    fc.title = layerMeta.flights.ok ? `OpenSky ADS-B · fetched ${layerMeta.flights.fetchedAt || ''}` : `OpenSky: ${layerMeta.flights.error || 'not fetched yet'}`;
  }
  if (sc) sc.textContent = ships.length + ' ref. vessels';
  if (cc) cc.textContent = confZones.length + ' conflicts';
  if (ec) {
    ec.textContent = layerMeta.events.ok || events.length ? `${events.length} event locations` : 'events: no feed';
    ec.title = layerMeta.events.ok ? `GDELT GEO 24h · fetched ${layerMeta.events.fetchedAt || ''}` : `GDELT: ${layerMeta.events.error || 'not fetched yet'}`;
  }
  updateCountryCount();
}
