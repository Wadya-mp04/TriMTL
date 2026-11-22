/**
 * The MapLibre page the Map tab renders in a WebView: a 3D basemap (extruded buildings, Mont Royal terrain and
 * hillshade) styled from theme.ts, with collection sectors and drop-off pins on top. The app calls window.receive(msg);
 * the page posts JSON back.
 * shortcut: MapLibre loads from a CDN and tiles come from OpenFreeMap and the AWS open terrain set, all free
 * with no key; bundle the library and pick a tile host with an SLA before release.
 */
import { APP_PALETTES, bins, colors, radius, type ThemeKey } from '../theme';

/** Drop-off places take what the "special" bin means in the rest of the app, so they wear its colours;
 * the icon tells them apart, and pharmacies take the app's forest. */
export const PLACE_STYLE = {
  ecocentre: { label: 'Écocentre', icon: 'warehouse', color: bins.special.fg },
  battery: { label: 'Battery drop-off', icon: 'battery-charging-full', color: bins.special.deep },
  pharmacy: { label: 'Pharmacy', icon: 'local-pharmacy', color: colors.forest },
} as const;

/** Garbage is a solid line, recycling a dashed one, a shared day both: shape carries the meaning, not only colour. */
export const LANE_STYLE = {
  garbage: { label: 'Garbage', color: bins.garbage.fg, dash: undefined as string | undefined },
  recycling: { label: 'Recycling', color: bins.recycling.fg, dash: '9 9' },
} as const;

/** Basemap built from the app's own tokens rather than a stock style. */
function style(theme: ThemeKey) {
  const [hi, mid, low] = APP_PALETTES[theme].canvas;
  const label = { 'text-color': colors.inkMuted, 'text-halo-color': hi, 'text-halo-width': 1.4 };
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
      dem: {
        type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 14,
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        attribution: 'Terrain: Mapzen, AWS Open Data',
      },
    },
    terrain: { source: 'dem', exaggeration: 1.8 },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': mid } },
      { id: 'green', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': colors.forest, 'fill-opacity': 0.12 } },
      { id: 'wood', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass']]], paint: { 'fill-color': colors.forest, 'fill-opacity': 0.1 } },
      { id: 'shade', type: 'hillshade', source: 'dem', paint: { 'hillshade-shadow-color': colors.forestDeep, 'hillshade-highlight-color': hi, 'hillshade-accent-color': colors.forest, 'hillshade-exaggeration': 0.45 } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': bins.recycling.border } },
      { id: 'road-casing', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['!=', ['get', 'class'], 'rail'],
        paint: { 'line-color': low, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, 1, 18, 22] } },
      { id: 'road', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['!=', ['get', 'class'], 'rail'],
        paint: { 'line-color': hi, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, 0.5, 18, 18] } },
      { id: 'buildings', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 13,
        paint: {
          'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 6], 0, hi, 40, mid, 120, low],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, ['coalesce', ['get', 'render_height'], 6]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.9,
        } },
      { id: 'street-names', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 15,
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'symbol-placement': 'line' }, paint: label },
      { id: 'places', type: 'symbol', source: 'omt', 'source-layer': 'place', maxzoom: 15, filter: ['in', ['get', 'class'], ['literal', ['neighbourhood', 'suburb', 'quarter']]],
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-letter-spacing': 0.08, 'text-transform': 'uppercase' }, paint: label },
      { id: 'park-names', type: 'symbol', source: 'omt', 'source-layer': 'park', filter: ['==', ['geometry-type'], 'Point'],
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12 }, paint: { ...label, 'text-color': colors.forest } },
    ],
  };
}

/** The map page, in the colours of the chosen neighbourhood theme. */
export function mapHtml(theme: ThemeKey) {
  const css = `
  html,body,#map{margin:0;height:100%;background:${colors.mintCanvas};-webkit-tap-highlight-color:transparent}
  .maplibregl-ctrl-attrib,.maplibregl-ctrl-attrib-inner{background:rgba(255,255,255,.72)!important;font:10px/1.4 'Plus Jakarta Sans',system-ui;color:${colors.inkMuted};border-radius:${radius.xl}px}
  .maplibregl-ctrl-attrib a{color:${colors.inkMuted}}
  .maplibregl-ctrl-bottom-right{bottom:var(--sheet,0px);transition:bottom .25s cubic-bezier(.2,.8,.2,1)}
  .pin{width:44px;height:44px;display:flex;align-items:center;justify-content:center;outline:none;cursor:pointer}
  .pin i{width:34px;height:34px;border-radius:17px;background:${colors.white};display:flex;align-items:center;justify-content:center;
    box-shadow:0 4px 10px -2px rgba(18,41,31,.28),0 0 0 2px rgba(255,255,255,.9);
    transition:transform .22s cubic-bezier(.2,.8,.2,1),background-color .22s}
  .pin span{font-family:'Material Icons';font-size:19px;font-style:normal;line-height:1;transition:color .22s}
  .pin.sel i{transform:scale(1.22)}
  .pin.sel span{color:${colors.white}!important}
  .pin:focus-visible i{box-shadow:0 0 0 3px ${colors.ink}}
  .cluster{width:44px;height:44px;display:flex;align-items:center;justify-content:center;cursor:pointer}
  .cluster b{min-width:34px;height:34px;border-radius:17px;background:${colors.ink};color:${colors.white};font:700 13px 'Plus Jakarta Sans',system-ui;
    display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px rgba(255,255,255,.7),0 6px 14px -4px rgba(18,41,31,.4)}
  .spot{width:16px;height:16px;border-radius:8px;background:${colors.ink};border:3px solid ${colors.white};box-shadow:0 0 0 6px ${colors.ink}26,0 4px 10px rgba(18,41,31,.3)}
  .me{width:18px;height:18px;border-radius:9px;background:${colors.forest};border:3px solid ${colors.white};box-shadow:0 0 0 8px ${colors.forest}33}
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}`;

  const js = `
  // Looking south-west from the Plateau, so Mont Royal rises behind it.
  const TILT = 62, FACE = 196;
  const post = (m) => window.ReactNativeWebView.postMessage(JSON.stringify(m));
  let reduce = false, pad = { top: 0, bottom: 0, left: 24, right: 24 }, pins = [], selected = null, me = null, spot = null, framed = false, ready = false, queue = [], states = {}, tiltOn = true, fitToken = 0;
  const map = new maplibregl.Map({
    container: 'map', style: ${JSON.stringify(style(theme))},
    center: [-73.5800, 45.5238], zoom: 15, pitch: TILT, bearing: FACE, maxPitch: 70,
    attributionControl: false, dragRotate: true, touchPitch: true,
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'OpenFreeMap · Ville de Montréal' }), 'bottom-right');
  // Start collapsed to the (i) button on every width; the credits open on tap.
  map.once('load', () => document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));

  let tileFails = 0, loadedOnce = false;
  map.on('error', (e) => { if (!loadedOnce && ++tileFails >= 4) post({ type: 'tiles', ok: false }); });
  map.once('idle', () => { loadedOnce = true; post({ type: 'tiles', ok: true }); });

  const cam = (o) => (reduce ? map.jumpTo(o) : map.flyTo({ ...o, duration: 700, curve: 1.3, essential: false }));
  const padding = () => ({ top: pad.top + 16, bottom: pad.bottom + 16, left: 24, right: 24 });
  const st = (name) => ['boolean', ['feature-state', name], false];

  map.on('load', () => {
    // Collection sectors: fills sit under the buildings, outlines over them so a sector reads in 3D.
    map.addSource('zones', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'key' });
    const G = '${LANE_STYLE.garbage.color}', R = '${LANE_STYLE.recycling.color}';
    // A selected sector has to win against 3D buildings and every other outline: both streams get a tinted
    // fill (they overlap on the block itself), a white casing under a heavy outline, and a wide glow, while
    // every other sector fades back.
    map.addLayer({ id: 'zone-fill', type: 'fill', source: 'zones',
      paint: { 'fill-color': ['match', ['get', 'stream'], 'garbage', G, R],
        'fill-opacity': ['case', st('sel'), 0.3, ['==', ['get', 'stream'], 'recycling'], 0, st('hot'), 0.16, st('dim'), 0.015, 0.05] } }, 'buildings');
    map.addLayer({ id: 'zone-glow', type: 'line', source: 'zones', layout: { 'line-join': 'round' },
      paint: { 'line-color': ['match', ['get', 'stream'], 'garbage', G, R], 'line-width': 26, 'line-blur': 12, 'line-opacity': ['case', st('sel'), 0.55, 0] } }, 'street-names');
    map.addLayer({ id: 'zone-casing', type: 'line', source: 'zones', layout: { 'line-join': 'round' },
      paint: { 'line-color': '${colors.white}', 'line-width': 9, 'line-opacity': ['case', st('sel'), 0.95, 0] } }, 'street-names');
    map.addLayer({ id: 'zone-garbage', type: 'line', source: 'zones', filter: ['==', ['get', 'stream'], 'garbage'], layout: { 'line-join': 'round' },
      paint: { 'line-color': G, 'line-width': ['case', st('sel'), 5, st('hot'), 2.5, 2], 'line-opacity': ['case', st('sel'), 1, st('dim'), 0.18, 0.9] } }, 'street-names');
    map.addLayer({ id: 'zone-recycling', type: 'line', source: 'zones', filter: ['==', ['get', 'stream'], 'recycling'], layout: { 'line-join': 'round' },
      paint: { 'line-color': R, 'line-width': ['case', st('sel'), 5, st('hot'), 2.5, 2.2], 'line-opacity': ['case', st('sel'), 1, st('dim'), 0.18, 0.95], 'line-dasharray': [2, 1.6] } }, 'street-names');

    map.addSource('drops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 44, clusterMaxZoom: 15 });
    map.addLayer({ id: 'drops-anchor', type: 'circle', source: 'drops', paint: { 'circle-radius': 0, 'circle-opacity': 0 } });
    map.on('data', (e) => { if (e.sourceId === 'drops' && e.isSourceLoaded) syncMarkers(); });
    map.on('move', syncMarkers);

    // Any tap on the map asks the app which sectors cover that spot.
    map.on('click', (e) => post({ type: 'tap', kind: null, lat: e.lngLat.lat, lng: e.lngLat.lng }));
    ready = true;
    queue.forEach(window.receive); queue = [];
    post({ type: 'ready' });
  });

  // Pins are HTML so they stay crisp, focusable and labelled; clusters come from the GeoJSON source.
  const markers = new Map();
  function syncMarkers() {
    const seen = new Set();
    for (const f of map.querySourceFeatures('drops')) {
      const p = f.properties, c = f.geometry.coordinates;
      const key = p.cluster ? 'c' + p.cluster_id : p.id;
      if (seen.has(key)) continue;
      seen.add(key);
      let m = markers.get(key);
      if (!m) {
        const el = document.createElement('div');
        if (p.cluster) {
          el.className = 'cluster'; el.setAttribute('role', 'button'); el.setAttribute('aria-label', p.point_count + ' ' + labels.cluster);
          el.innerHTML = '<b>' + p.point_count + '</b>';
          el.onclick = (ev) => { ev.stopPropagation(); map.getSource('drops').getClusterExpansionZoom(p.cluster_id).then((z) => cam({ center: c, zoom: z + 0.5, padding: padding() })); };
        } else {
          el.className = 'pin'; el.tabIndex = 0; el.setAttribute('role', 'button'); el.setAttribute('aria-label', p.a11y);
          el.innerHTML = '<i><span style="color:' + p.color + '">' + p.icon + '</span></i>';
          el.onclick = (ev) => { ev.stopPropagation(); post({ type: 'tap', kind: 'dropoff', id: p.id }); };
          el.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') el.onclick(ev); };
          el.dataset.color = p.color;
        }
        m = new maplibregl.Marker({ element: el }).setLngLat(c).addTo(map);
        markers.set(key, m);
      }
      paintPin(key, m);
    }
    for (const [k, m] of markers) if (!seen.has(k)) { m.remove(); markers.delete(k); }
  }
  function paintPin(key, m) {
    const el = m.getElement();
    if (el.className.indexOf('pin') !== 0) return;
    const sel = selected && selected.id === key;
    el.classList.toggle('sel', !!sel);
    el.firstChild.style.background = sel ? el.dataset.color : '${colors.white}';
    m.getElement().style.zIndex = sel ? 2 : 1;
  }

  function setStates(next) {
    for (const k of Object.keys(states)) map.removeFeatureState({ source: 'zones', id: k });
    states = next;
    for (const [k, v] of Object.entries(states)) map.setFeatureState({ source: 'zones', id: k }, v);
  }

  // Zoom out until the whole selected area sits between the search bar and the sheet.
  const mercY = (lat) => 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);
  function allVisible(b) {
    const W = map.getCanvas().clientWidth, H = map.getCanvas().clientHeight;
    return [[b[0][0], b[0][1]], [b[0][0], b[1][1]], [b[1][0], b[0][1]], [b[1][0], b[1][1]]].every((c) => {
      const p = map.project(c);
      return p.x >= 8 && p.x <= W - 8 && p.y >= pad.top + 8 && p.y <= H - pad.bottom - 8;
    });
  }
  function fitArea(m) {
    const b = m.bounds;
    if (!b) return cam({ center: [m.lng, m.lat], zoom: Math.max(map.getZoom(), 16), padding: padding() });
    const W = map.getCanvas().clientWidth, H = map.getCanvas().clientHeight;
    const boxW = W - 48, boxH = Math.max(120, H - pad.top - pad.bottom - 48);
    const fx = Math.max((b[1][0] - b[0][0]) / 360, 1e-9), fy = Math.max(Math.abs(mercY(b[0][1]) - mercY(b[1][1])), 1e-9);
    // A flat first guess; the check below corrects for the tilt and rotation, which hide the far edge.
    const zoom = Math.max(10, Math.min(17, Math.log2(Math.min(boxW / (512 * fx), boxH / (512 * fy)))));
    // Big areas lose their far side to the horizon, so they are viewed from higher up.
    const pitch = tiltOn ? (zoom < 15 ? 40 : TILT) : 0;
    cam({ center: [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2], zoom, pitch, padding: padding() });
    const token = ++fitToken;
    const settle = (tries) => map.once('moveend', () => {
      if (token !== fitToken || allVisible(b) || tries >= 5 || map.getZoom() <= 10) return;
      map.easeTo({ zoom: map.getZoom() - 0.35, duration: reduce ? 0 : 300 });
      settle(tries + 1);
    });
    settle(0);
  }

  let labels = { spot: 'Selected spot', location: 'Your location', cluster: 'drop-offs, zoom in' };
  function dot(lat, lng) {
    if (!spot) { const el = document.createElement('div'); el.className = 'spot'; el.setAttribute('aria-label', labels.spot); spot = new maplibregl.Marker({ element: el }); }
    spot.setLngLat([lng, lat]).addTo(map);
  }

  window.receive = (m) => {
    if (!ready && m.type !== 'pad' && m.type !== 'motion') return void queue.push(m);
    if (m.type === 'language') {
      labels = m; document.documentElement.lang = m.lang;
      if (spot) spot.getElement().setAttribute('aria-label', m.spot);
      if (me) me.getElement().setAttribute('aria-label', m.location);
      for (const mk of markers.values()) if (mk.getElement().className === 'cluster') mk.getElement().setAttribute('aria-label', mk.getElement().textContent + ' ' + m.cluster);
    }
    if (m.type === 'pad') { pad = m; document.documentElement.style.setProperty('--sheet', m.bottom + 'px'); }
    if (m.type === 'motion') reduce = m.reduce;
    if (m.type === 'zones') {
      map.getSource('zones').setData({ type: 'FeatureCollection', features: m.zones.map((z) => ({
        type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: z.polygons }, properties: { key: z.key, stream: z.stream } })) });
      if (!framed) { framed = true; map.jumpTo({ center: [-73.5800, 45.5238], zoom: 15.3, padding: padding() }); }
    }
    if (m.type === 'pins') {
      pins = m.pins;
      for (const mk of markers.values()) mk.remove(); markers.clear();
      map.getSource('drops').setData({ type: 'FeatureCollection', features: pins.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: p })) });
    }
    if (m.type === 'zoneState') setStates(m.states);
    if (m.type === 'select') {
      selected = m.id ? m : null;
      for (const [k, mk] of markers) paintPin(k, mk);
      if (m.kind !== 'area' && spot) spot.remove();
      if (m.kind === 'area') { dot(m.lat, m.lng); fitArea(m); }
      const p = m.kind === 'dropoff' && pins.find((x) => x.id === m.id);
      if (p) cam({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 16.5), padding: padding() });
    }
    if (m.type === 'place') cam({ center: [m.lng, m.lat], zoom: 16.5, padding: padding() });
    if (m.type === 'me') {
      if (!me) { const el = document.createElement('div'); el.className = 'me'; el.setAttribute('aria-label', labels.location); me = new maplibregl.Marker({ element: el }); }
      me.setLngLat([m.lng, m.lat]).addTo(map);
      cam({ center: [m.lng, m.lat], zoom: 16, padding: padding() });
    }
    if (m.type === 'tilt') tiltOn = m.on;
    if (m.type === 'tilt') cam({ pitch: m.on ? TILT : 0, bearing: m.on ? FACE : 0, padding: padding() });
  };`;

  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700&family=Material+Icons&display=block">
<style>${css}</style></head><body><div id="map"></div>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script>${js}</script></body></html>`;
}
