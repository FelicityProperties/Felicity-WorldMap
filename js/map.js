// ═══════════════════════════════════════════════════════════
// MAP — Leaflet Init, GeoJSON, Layers, Markers, Animation
// ═══════════════════════════════════════════════════════════

import { ciiScores, regionMap, flights, ships, confZones } from './data.js';
import { ciiColor } from './utils.js';

let map, geoLayer;
let fMarkers = [], sMarkers = [], cMarkers = [];
let layerState = { choropleth: true, conflicts: true, flights: true, ships: true };
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
    attributionControl: false
  }).setView([20, 20], 2);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  loadGeoJSON();
  return map;
}

// ── GeoJSON Loading ──
async function loadGeoJSON() {
  try {
    const [topoRes, nameRes] = await Promise.all([
      fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json'),
      fetch('https://unpkg.com/world-countries@5.0.0/dist/world-countries.json')
    ]);
    const topo = await topoRes.json();
    const nameData = await nameRes.json();
    const { feature } = await import('https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js');
    const geo = feature(topo, topo.objects.countries);

    const idToName = {};
    nameData.forEach(c => {
      if (c.ccn3) idToName[parseInt(c.ccn3)] = c.name.common;
    });

    renderGeo(geo, idToName);
  } catch (e) {
    console.error('GeoJSON load failed:', e);
    updateCountryCount();
  }
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
  // Clear existing
  fMarkers.forEach(m => map.removeLayer(m));
  sMarkers.forEach(m => map.removeLayer(m));
  cMarkers.forEach(m => map.removeLayer(m));
  fMarkers = [];
  sMarkers = [];
  cMarkers = [];

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

  // Flight markers
  if (layerState.flights) {
    flights.forEach(f => {
      const col = f.type === 'mil' ? '#ef4444' : '#3b82f6';
      const sz = f.type === 'mil' ? 10 : 7;
      const m = L.marker([f.lat, f.lng], {
        icon: mkIcon(col, sz, true)
      }).addTo(map);
      m.bindTooltip(
        `<b>${f.call}</b><br>${f.from} \u2192 ${f.to}<br>${f.alt} \u00b7 ${f.type === 'mil' ? 'Military' : 'Commercial'}`,
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

// ── Animate Trackers ──
export function animateTrackers() {
  flights.forEach((f, i) => {
    if (!fMarkers[i] || !layerState.flights) return;
    const r = f.hdg * Math.PI / 180;
    f.lat += Math.cos(r) * 0.025;
    f.lng += Math.sin(r) * 0.04;
    if (f.lat > 82) f.lat = 5;
    if (f.lat < -55) f.lat = 5;
    if (f.lng > 180) f.lng = -180;
    if (f.lng < -180) f.lng = 180;
    fMarkers[i].setLatLng([f.lat, f.lng]);
  });

  ships.forEach((s, i) => {
    if (!sMarkers[i] || !layerState.ships) return;
    s.lng += 0.005;
    if (s.lng > 180) s.lng = -180;
    sMarkers[i].setLatLng([s.lat, s.lng]);
  });
}

// ── Status Updates ──
function updateCountryCount() {
  const el = document.getElementById('ctrycount');
  if (el) el.textContent = Object.keys(ciiScores).length + ' countries';
}

function updateStatusCounts() {
  const fc = document.getElementById('fcount');
  const sc = document.getElementById('scount');
  const cc = document.getElementById('ccount');
  if (fc) fc.textContent = flights.length + ' flights';
  if (sc) sc.textContent = ships.length + ' vessels';
  if (cc) cc.textContent = confZones.length + ' conflicts';
  updateCountryCount();
}
