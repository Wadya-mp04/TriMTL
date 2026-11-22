/**
 * The MapLibre page the Map tab renders in a WebView: a 3D basemap (extruded buildings, Mont Royal terrain and
 * hillshade) styled from theme.ts, with lanes and drop-off pins on top. The app calls window.receive(msg);
 * the page posts JSON back.
 * shortcut: MapLibre loads from a CDN and tiles come from OpenFreeMap and the AWS open terrain set, all free
 * with no key; bundle the library and pick a tile host with an SLA before release.
 */
import { bins, canvasGradients, colors, radius } from '../theme';

export const DROPOFF_STYLE = {
  recycling: { label: 'Recycling', icon: 'recycling', color: bins.recycling.fg },
  ewaste: { label: 'E-waste', icon: 'devices', color: bins.special.fg },
  hazardous: { label: 'Hazardous', icon: 'warning', color: bins.special.deep },
  compost: { label: 'Compost', icon: 'compost', color: bins.compost.fg },
  donation: { label: 'Donation', icon: 'volunteer-activism', color: colors.forest },
} as const;

/** Garbage is a solid line, recycling a dashed one, a shared day both: shape carries the meaning, not only colour. */
export const LANE_STYLE = {
  garbage: { label: 'Garbage', color: bins.garbage.fg, dash: undefined as string | undefined },
  recycling: { label: 'Recycling', color: bins.recycling.fg, dash: '9 9' },
} as const;

/** Basemap built from the app's own tokens rather than a stock style. */
function style() {
  const [hi, mid, low] = canvasGradients.pearl;
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

export function mapHtml() {
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
  .me{width:18px;height:18px;border-radius:9px;background:${colors.forest};border:3px solid ${colors.white};box-shadow:0 0 0 8px ${colors.forest}33}
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}`;

  const js = `
  // Looking south-west from the Plateau, so Mont Royal rises behind the lanes.
  const TILT = 62, FACE = 196;
  const post = (m) => window.ReactNativeWebView.postMessage(JSON.stringify(m));
  let reduce = false, pad = { top: 0, bottom: 0, left: 24, right: 24 }, lanes = [], pins = [], selected = null, me = null, framed = false, ready = false, queue = [];
  const map = new maplibregl.Map({
    container: 'map', style: ${JSON.stringify(style())},
    center: [-73.5800, 45.5238], zoom: 15, pitch: TILT, bearing: FACE, maxPitch: 70,
    attributionControl: false, dragRotate: true, touchPitch: true,
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'OpenFreeMap' }), 'bottom-right');
  // Start collapsed to the (i) button on every width; the credits open on tap.
  map.once('load', () => document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));

  let tileFails = 0, loadedOnce = false;
  map.on('error', (e) => { if (!loadedOnce && ++tileFails >= 4) post({ type: 'tiles', ok: false }); });
  map.once('idle', () => { loadedOnce = true; post({ type: 'tiles', ok: true }); });

  const cam = (o) => (reduce ? map.jumpTo(o) : map.flyTo({ ...o, duration: 700, curve: 1.3, essential: false }));
  const padding = () => ({ top: pad.top + 16, bottom: pad.bottom + 16, left: 24, right: 24 });

  function laneFeatures() {
    return { type: 'FeatureCollection', features: lanes.map((l) => ({
      type: 'Feature', geometry: { type: 'LineString', coordinates: l.path.map(([a, b]) => [b, a]) },
      properties: { id: l.id, name: l.name, kind: l.kind, sel: selected && selected.id === l.id ? 1 : 0, dim: l.dim ? 1 : 0 },
    })) };
  }

  map.on('load', () => {
    map.addSource('lanes', { type: 'geojson', data: laneFeatures() });
    const width = ['case', ['==', ['get', 'sel'], 1], 8, 5];
    const op = ['case', ['all', ['==', ['get', 'dim'], 1], ['==', ['get', 'sel'], 0]], 0.28, 1];
    map.addLayer({ id: 'lane-glow', type: 'line', source: 'lanes', filter: ['==', ['get', 'sel'], 1],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['match', ['get', 'kind'], 'garbage', '${LANE_STYLE.garbage.color}', '${LANE_STYLE.recycling.color}'], 'line-width': 22, 'line-blur': 10, 'line-opacity': 0.35 } });
    map.addLayer({ id: 'lane-casing', type: 'line', source: 'lanes', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '${colors.white}', 'line-width': ['+', width, 3], 'line-opacity': ['*', op, 0.9] } });
    map.addLayer({ id: 'lane-solid', type: 'line', source: 'lanes', filter: ['in', ['get', 'kind'], ['literal', ['garbage', 'both']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '${LANE_STYLE.garbage.color}', 'line-width': width, 'line-opacity': op } });
    map.addLayer({ id: 'lane-dash', type: 'line', source: 'lanes', filter: ['in', ['get', 'kind'], ['literal', ['recycling', 'both']]],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': '${LANE_STYLE.recycling.color}', 'line-width': width, 'line-opacity': op, 'line-dasharray': [1.6, 1.4] } });
    map.addLayer({ id: 'lane-hit', type: 'line', source: 'lanes', paint: { 'line-color': '#000', 'line-width': 30, 'line-opacity': 0 } });

    map.addSource('drops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 44, clusterMaxZoom: 15 });
    map.addLayer({ id: 'drops-anchor', type: 'circle', source: 'drops', paint: { 'circle-radius': 0, 'circle-opacity': 0 } });
    map.on('data', (e) => { if (e.sourceId === 'drops' && e.isSourceLoaded) syncMarkers(); });
    map.on('move', syncMarkers);

    map.on('click', (e) => {
      const hit = map.queryRenderedFeatures([[e.point.x - 14, e.point.y - 14], [e.point.x + 14, e.point.y + 14]], { layers: ['lane-hit'] })[0];
      post(hit ? { type: 'tap', kind: 'lane', id: hit.properties.id } : { type: 'tap', kind: null });
    });
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
          el.className = 'cluster'; el.setAttribute('role', 'button'); el.setAttribute('aria-label', p.point_count + ' drop-offs, zoom in');
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

  function frameAll() {
    const b = new maplibregl.LngLatBounds();
    lanes.forEach((l) => l.path.forEach(([a, o]) => b.extend([o, a])));
    map.jumpTo({ center: b.getCenter(), zoom: 15.5, padding: padding() });
  }

  window.receive = (m) => {
    if (!ready && m.type !== 'pad' && m.type !== 'motion') return void queue.push(m);
    if (m.type === 'pad') { pad = m; document.documentElement.style.setProperty('--sheet', m.bottom + 'px'); }
    if (m.type === 'motion') reduce = m.reduce;
    if (m.type === 'data') {
      lanes = m.lanes; pins = m.pins;
      map.getSource('lanes').setData(laneFeatures());
      for (const mk of markers.values()) mk.remove(); markers.clear();
      map.getSource('drops').setData({ type: 'FeatureCollection', features: pins.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: p })) });
      if (!framed && lanes.length) { framed = true; frameAll(); }
    }
    if (m.type === 'select') {
      selected = m.id ? m : null;
      map.getSource('lanes').setData(laneFeatures());
      for (const [k, mk] of markers) paintPin(k, mk);
      const l = m.kind === 'lane' && lanes.find((x) => x.id === m.id);
      const p = m.kind === 'dropoff' && pins.find((x) => x.id === m.id);
      if (l) {
        const b = new maplibregl.LngLatBounds();
        l.path.forEach(([a, o]) => b.extend([o, a]));
        // cameraForBounds gives up when the sheet's padding leaves too little room, so fit to the whole
        // canvas and step out by how much of it the search bar and sheet cover.
        map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
        const c = map.cameraForBounds(b, { padding: 40, bearing: map.getBearing() });
        const h = map.getCanvas().clientHeight, free = Math.max(120, h - pad.top - pad.bottom - 32);
        const zoom = Math.max(15.8, Math.min(17, (c ? c.zoom : 16.5) - Math.log2(h / free) * 0.45));
        cam({ center: b.getCenter(), zoom, bearing: map.getBearing(), pitch: map.getPitch(), padding: padding() });
      }
      if (p) cam({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 16.5), padding: padding() });
    }
    if (m.type === 'place') cam({ center: [m.lng, m.lat], zoom: 16.5, padding: padding() });
    if (m.type === 'me') {
      if (!me) { const el = document.createElement('div'); el.className = 'me'; el.setAttribute('aria-label', 'Your location'); me = new maplibregl.Marker({ element: el }); }
      me.setLngLat([m.lng, m.lat]).addTo(map);
      cam({ center: [m.lng, m.lat], zoom: 16, padding: padding() });
    }
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
