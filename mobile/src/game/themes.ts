/**
 * Six built-in game themes: five corners of Montréal, plus Vieux-Québec. Each has its own palette and a backdrop
 * drawn from that area's architecture. Backdrops are 480×300 SVGs anchored to the bottom
 * (`slice`), so the bottom fifth sits behind the sidewalk and the landmarks live above the bins.
 */

export type ThemeKey = 'plateau' | 'saint-laurent' | 'mont-royal' | 'mile-end' | 'nuit' | 'vieux-quebec';

export interface GameTheme {
  key: ThemeKey;
  name: { en: string; fr: string };
  /** The theme's signature gradient: shown on the picker swatch and used for the architecture. */
  gradient: [string, string];
  accent: string;
  /** Text and icons placed on the accent. */
  onAccent: string;
  /** The throw lane (sidewalk) and its snowbank. */
  lane: string;
  snow: string;
  snowShade: string;
  /** Item name and hint on the lane. */
  laneInk: string;
  laneMuted: string;
  backdrop: string;
}

/**
 * Every backdrop goes through `mute` so the six neighbourhoods share the app's soft undertone, the way
 * Mile End's sage sky and greystone already do: saturation above 30% is compressed hard (a red brick
 * stays brick but stops shouting), the darkest inks lift a little, and everything leans 10% toward a
 * paper-coloured air. Already-quiet colours barely move, so Mile End is close to unchanged.
 */
const hex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
export function muteColor(hex: string, air: string) {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(...v), mn = Math.min(...v), l = (mx + mn) / 2, d = mx - mn;
  let h = 0;
  const s0 = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d) h = mx === v[0] ? ((v[1] - v[2]) / d + 6) % 6 : mx === v[1] ? (v[2] - v[0]) / d + 2 : (v[0] - v[1]) / d + 4;
  const s1 = s0 <= 0.3 ? s0 : 0.3 + (s0 - 0.3) * 0.4, l1 = 0.08 + l * 0.9;
  const c = (1 - Math.abs(2 * l1 - 1)) * s1, x = c * (1 - Math.abs((h % 2) - 1)), m = l1 - c / 2;
  const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  const a = [1, 3, 5].map((i) => parseInt(air.slice(i, i + 2), 16));
  return '#' + [r, g, b].map((ch, i) => hex2((ch + m) * 255 * 0.9 + a[i] * 0.1)).join('');
}
const PAPER = '#F3F1EA', NIGHT_AIR = '#1E2433';
const mute = (xml: string, air = PAPER) => xml.replace(/#[0-9A-Fa-f]{6}\b/g, (c) => muteColor(c, air));

/** Sky drawn above the scene (viewBox units), so the real sky, not a flat fill, runs up behind the header. */
export const SKY_EXT = 300;
const svg = (body: string) => `<svg viewBox="0 -${SKY_EXT} 480 ${300 + SKY_EXT}" preserveAspectRatio="xMidYMax slice">${body}</svg>`;
/** The scene's own gradient over 0..300, held at its top colour above that. */
const sky = (id: string, stops: [number, string][]) =>
  `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="-${SKY_EXT}" x2="0" y2="300"><stop offset="0" stop-color="${stops[0][1]}"/>${stops.map(([o, c]) => `<stop offset="${((SKY_EXT + o * 300) / (SKY_EXT + 300)).toFixed(3)}" stop-color="${c}"/>`).join('')}</linearGradient></defs><rect y="-${SKY_EXT}" width="480" height="${300 + SKY_EXT}" fill="url(#${id})"/>`;
/** Deterministic scatter so a backdrop is identical on every render. */
const rand = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// ---------- Plateau: a row of brick triplexes, drawn from the ones on rue de Bullion and avenue de
// l'Esplanade. Pressed-metal cornices on carved brackets, a slate mansard with a dormer, limestone
// lintels over segmental windows, two storeys of painted wooden galleries on thin iron posts, paired
// upstairs doors with transoms, and the curved iron outside stair that is the neighbourhood's signature.
function plateau() {
  const snow = '#FFFFFF', stone = '#E9E1D0', stoneShade = '#C9BFA9', iron = '#23272B', glass = '#BFDDF2', lit = '#FFE3A1';
  const GROUND = 265, FLOOR = 75; // street level and storey height, in viewBox units
  let s = sky('pl', [[0, '#7DBDEB'], [0.7, '#CFE7F7'], [1, '#EEF7FC']]);
  s += `<defs><pattern id="brk" width="16" height="8" patternUnits="userSpaceOnUse"><path d="M0 7.5h16M8 0v3.5M0 4v3.5M16 4v3.5" stroke="#000" stroke-width=".8" opacity=".13"/><path d="M0 3.75h16" stroke="#000" stroke-width=".8" opacity=".13"/></pattern>`
    + `<pattern id="slate" width="8" height="7" patternUnits="userSpaceOnUse"><path d="M0 7a4 4 0 0 1 8 0M-4 3.5a4 4 0 0 1 8 0M4 3.5a4 4 0 0 1 8 0" fill="none" stroke="#1B2230" stroke-width=".9" opacity=".55"/></pattern></defs>`;
  // the mountain and its cross, seen down the street over the roofs
  s += `<path d="M-10 70Q150 18 260 26T490 62V120H-10z" fill="#9CC3DA" opacity=".7"/><rect x="331" y="12" width="2.4" height="16" fill="#FFFFFF" opacity=".9"/><rect x="327" y="17" width="10" height="2" fill="#FFFFFF" opacity=".9"/>`;

  type House = { x: number; w: number; brick: string; trim: string; gallery: string; doors: [string, string, string]; roof: 'cornice' | 'mansard'; stair: boolean };
  const houses: House[] = [
    { x: -30, w: 170, brick: '#C2603F', trim: '#1E6E5C', gallery: '#2BA7A0', doors: ['#D7263D', '#2BA7A0', '#F2B632'], roof: 'cornice', stair: false },
    { x: 140, w: 200, brick: '#B04A36', trim: '#2A2F3A', gallery: '#F2B632', doors: ['#2457A6', '#D7263D', '#6B4FA0'], roof: 'mansard', stair: true },
    { x: 340, w: 170, brick: '#D27A45', trim: '#E8E2D2', gallery: '#6B4FA0', doors: ['#1E6E5C', '#F2B632', '#D7263D'], roof: 'cornice', stair: false },
  ];

  // segmental-arch window with a limestone lintel and sill
  const win = (x: number, y: number, w: number, h: number, glow: boolean) =>
    `<path d="M${x - 4} ${y + 2}Q${x + w / 2} ${y - 10} ${x + w + 4} ${y + 2}v5Q${x + w / 2} ${y - 5} ${x - 4} ${y + 7}z" fill="${stone}"/>`
    + `<path d="M${x} ${y + 6}Q${x + w / 2} ${y - 2} ${x + w} ${y + 6}V${y + h}H${x}z" fill="${glow ? lit : glass}" stroke="#F4EFE4" stroke-width="2.5"/>`
    + `<path d="M${x + w / 2} ${y + 3}V${y + h}M${x} ${y + h * 0.55}H${x + w}" stroke="#F4EFE4" stroke-width="1.6"/>`
    + (glow ? '' : `<path d="M${x + 4} ${y + h - 6}l${w * 0.35} -${h * 0.5}" stroke="#FFFFFF" stroke-width="2" opacity=".5"/>`)
    + `<rect x="${x - 4}" y="${y + h}" width="${w + 8}" height="4" fill="${stone}"/><rect x="${x - 4}" y="${y + h + 4}" width="${w + 8}" height="1.5" fill="${stoneShade}"/>`;
  // painted door with a transom and a lit glass panel
  const door = (x: number, y: number, c: string) =>
    `<rect x="${x - 3}" y="${y - 14}" width="28" height="12" fill="${stone}"/><rect x="${x}" y="${y - 11}" width="22" height="8" fill="${lit}" opacity=".85"/>`
    + `<rect x="${x}" y="${y}" width="22" height="46" fill="${c}"/><rect x="${x + 4}" y="${y + 5}" width="14" height="16" fill="${glass}" opacity=".85"/>`
    + `<rect x="${x + 4}" y="${y + 26}" width="14" height="14" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="1.2"/><circle cx="${x + 18}" cy="${y + 25}" r="1.4" fill="#F4D58A"/>`;
  // a wooden gallery: deck, turned balusters, top rail, and the iron posts down to the deck below
  const gallery = (x: number, w: number, y: number, c: string) => {
    let g = `<rect x="${x}" y="${y}" width="${w}" height="5" fill="${c}"/><rect x="${x}" y="${y + 5}" width="${w}" height="2" fill="#000" opacity=".2"/>`;
    g += `<rect x="${x}" y="${y - 20}" width="${w}" height="3.5" fill="${c}"/>`;
    for (let k = 4; k < w - 2; k += 6) g += `<rect x="${x + k}" y="${y - 17}" width="2.6" height="17" rx="1.2" fill="${c}"/>`;
    g += `<rect x="${x}" y="${y - 23}" width="${w}" height="3" rx="1.5" fill="${snow}"/>`;
    for (const px of [x + 2, x + w - 4]) g += `<rect x="${px}" y="${y + 7}" width="2.4" height="${FLOOR - 7}" fill="${iron}"/>`;
    return g;
  };

  for (const h of houses) {
    const top = GROUND - 3 * FLOOR; // 40
    s += `<rect x="${h.x}" y="${top}" width="${h.w}" height="${GROUND - top}" fill="${h.brick}"/><rect x="${h.x}" y="${top}" width="${h.w}" height="${GROUND - top}" fill="url(#brk)"/>`;
    s += `<rect x="${h.x + h.w - 3}" y="${top}" width="3" height="${GROUND - top}" fill="#000" opacity=".12"/>`;
    // roof
    if (h.roof === 'mansard') {
      s += `<path d="M${h.x - 4} ${top}L${h.x + 10} ${top - 30}H${h.x + h.w - 10}L${h.x + h.w + 4} ${top}z" fill="#3B4A63"/><path d="M${h.x - 4} ${top}L${h.x + 10} ${top - 30}H${h.x + h.w - 10}L${h.x + h.w + 4} ${top}z" fill="url(#slate)"/>`;
      s += `<rect x="${h.x + 8}" y="${top - 33}" width="${h.w - 16}" height="4" rx="2" fill="${snow}"/>`;
      const dx = h.x + h.w / 2 - 16;
      s += `<path d="M${dx - 4} ${top - 24}L${dx + 16} ${top - 40}L${dx + 36} ${top - 24}z" fill="${h.trim}"/><rect x="${dx}" y="${top - 24}" width="32" height="22" fill="${h.trim}"/><rect x="${dx + 6}" y="${top - 20}" width="20" height="16" fill="${lit}"/><path d="M${dx + 16} ${top - 20}v16" stroke="${h.trim}" stroke-width="2"/>`;
      s += `<path d="M${dx - 6} ${top - 24}L${dx + 16} ${top - 42}L${dx + 38} ${top - 24}" fill="none" stroke="${snow}" stroke-width="3" stroke-linecap="round"/>`;
      s += `<rect x="${h.x - 6}" y="${top - 2}" width="${h.w + 12}" height="8" fill="${h.trim}"/>`;
    } else {
      s += `<rect x="${h.x - 6}" y="${top - 16}" width="${h.w + 12}" height="10" fill="${h.trim}"/><rect x="${h.x - 2}" y="${top - 6}" width="${h.w + 4}" height="6" fill="${h.trim}"/>`;
      for (let k = 0; k < h.w; k += 5) s += `<rect x="${h.x + k}" y="${top - 6}" width="2.6" height="3" fill="#000" opacity=".25"/>`;
      for (let k = 6; k < h.w; k += 26) s += `<path d="M${h.x + k} ${top - 6}h7v8q-3.5 4 -7 0z" fill="${h.trim}" stroke="#000" stroke-opacity=".25" stroke-width=".8"/>`;
      s += `<rect x="${h.x - 8}" y="${top - 21}" width="${h.w + 16}" height="6" rx="3" fill="${snow}"/>`;
    }
    // storeys, top to bottom: windows on the left, a door (or a tall window) on the right, galleries on floors 2 and 3
    for (let fl = 0; fl < 3; fl++) {
      const y = top + 14 + fl * FLOOR, glow = (fl + h.x) % 2 === 0;
      s += win(h.x + 16, y, 30, 40, glow) + win(h.x + 58, y, 30, 40, !glow);
      if (h.w > 180) s += win(h.x + 100, y, 30, 40, glow);
      s += door(h.x + h.w - 40, y + 2 + (fl === 2 ? 0 : 0), h.doors[fl]);
      if (fl < 2) s += gallery(h.x + 4, h.w - 8, top + (fl + 1) * FLOOR - 4, h.gallery);
    }
    // ground-floor stoop
    s += `<rect x="${h.x + h.w - 46}" y="${GROUND - 6}" width="34" height="6" fill="${stoneShade}"/>`;
    // the curved outside stair, sidewalk to the second-floor gallery
    if (h.stair) {
      const x0 = h.x + h.w - 60, y0 = GROUND, x1 = h.x + 120, y1 = top + 2 * FLOOR - 4;
      const path = (o: number) => `M${x0 + o} ${y0}C${x0 + o} ${y0 - 46}, ${x1 + 40 + o} ${y1 + 22}, ${x1 + o} ${y1}`;
      s += `<path d="${path(0)}" fill="none" stroke="${iron}" stroke-width="3.5"/><path d="${path(14)}" fill="none" stroke="${iron}" stroke-width="3.5"/>`;
      for (let k = 0; k <= 11; k++) {
        const t = k / 11, u = 1 - t;
        const bx = u * u * u * x0 + 3 * u * u * t * x0 + 3 * u * t * t * (x1 + 40) + t * t * t * x1;
        const by = u * u * u * y0 + 3 * u * u * t * (y0 - 46) + 3 * u * t * t * (y1 + 22) + t * t * t * y1;
        s += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="16" height="3" fill="${iron}"/><rect x="${bx.toFixed(1)}" y="${(by - 2).toFixed(1)}" width="16" height="2.2" rx="1.1" fill="${snow}"/>`;
        if (k % 2 === 0) s += `<path d="M${(bx + 1).toFixed(1)} ${by.toFixed(1)}v-14M${(bx + 15).toFixed(1)} ${by.toFixed(1)}v-14" stroke="${iron}" stroke-width="1.3"/>`;
      }
      s += `<path d="${path(0).replace(/(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/g, (_m, a, b) => `${a} ${+b - 14}`)}" fill="none" stroke="${iron}" stroke-width="2"/>`;
    }
  }
  // sidewalk edge and the iron fence of the front yards
  s += `<rect x="0" y="${GROUND - 2}" width="480" height="${300 - GROUND + 2}" fill="#C8CFD4"/>`;
  for (let k = 0; k < 480; k += 9) s += `<path d="M${k} ${GROUND - 2}v-12" stroke="${iron}" stroke-width="1.3"/><circle cx="${k}" cy="${GROUND - 15}" r="1.3" fill="${iron}"/>`;
  s += `<path d="M0 ${GROUND - 12}H480" stroke="${iron}" stroke-width="1.6"/><rect x="0" y="${GROUND - 4}" width="480" height="4" fill="${snow}"/>`;
  return svg(s);
}

// ---------- St-Laurent: the Old Port. The river with ice floes, the Jacques-Cartier Bridge,
// the Clock Tower, Silo No. 5 and the stacked boxes of Habitat 67.
function saintLaurent() {
  const slate = '#4F6D8F', concrete = '#C9D0D6', concrete2 = '#AEB8C1', ink = '#2C3E50';
  let s = sky('sl', [[0, '#CFE8F2'], [0.6, '#EAF5F9'], [1, '#F6FBFD']]);
  // bridge: two cantilever arches over the river, piers, deck
  s += `<path d="M-10 118L490 104" stroke="${slate}" stroke-width="5"/>`;
  for (const [a, b] of [[60, 250], [250, 440]]) {
    const m = (a + b) / 2;
    s += `<path d="M${a} 114Q${m} 30 ${b} 108" fill="none" stroke="${slate}" stroke-width="4"/>`;
    for (let k = 1; k < 10; k++) {
      const t = k / 10, x = a + (b - a) * t, yArc = (1 - t) * (1 - t) * 114 + 2 * (1 - t) * t * 30 + t * t * 108, yDeck = 118 - (x + 10) * 0.028;
      s += `<path d="M${x} ${yArc}V${yDeck}" stroke="${slate}" stroke-width="1.6"/>`;
      if (k % 2) s += `<path d="M${x} ${yArc}L${x + (b - a) / 10} ${yDeck}" stroke="${slate}" stroke-width="1.2" opacity=".8"/>`;
    }
  }
  for (const x of [60, 250, 440]) s += `<rect x="${x - 5}" y="112" width="10" height="80" fill="${slate}"/>`;
  // Silo No. 5: long concrete block of cylinders, with its elevator tower
  s += `<rect x="150" y="132" width="150" height="62" fill="${concrete2}"/>`;
  for (let k = 0; k < 10; k++) s += `<rect x="${152 + k * 15}" y="136" width="12" height="58" rx="6" fill="${concrete}"/>`;
  s += `<rect x="286" y="104" width="28" height="90" fill="${concrete2}"/><rect x="290" y="110" width="20" height="6" fill="${ink}" opacity=".5"/>`;
  // Clock Tower at the end of the quay
  s += `<rect x="30" y="74" width="26" height="120" fill="#E7DCC8"/><path d="M28 74L43 46 58 74z" fill="#7C8C7A"/><circle cx="43" cy="92" r="8" fill="#FFFFFF" stroke="${ink}" stroke-width="2"/><path d="M43 92V87M43 92l3 2" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`;
  for (let k = 0; k < 4; k++) s += `<rect x="38" y="${110 + k * 18}" width="10" height="10" fill="${ink}" opacity=".35"/>`;
  // Habitat 67: offset concrete boxes with dark glazing
  const boxes: [number, number][] = [[350, 168], [384, 168], [418, 168], [366, 148], [404, 148], [440, 152], [384, 128], [420, 130], [400, 110]];
  for (const [x, y] of boxes) s += `<rect x="${x}" y="${y}" width="34" height="20" fill="${concrete}" stroke="${concrete2}" stroke-width="1.5"/><rect x="${x + 4}" y="${y + 5}" width="14" height="9" fill="${ink}" opacity=".55"/><rect x="${x + 22}" y="${y + 5}" width="8" height="9" fill="#8FC0EA" opacity=".7"/>`;
  // river with ice and ripples
  s += `<defs><linearGradient id="riv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2F7F86"/><stop offset="1" stop-color="${slate}"/></linearGradient></defs><rect x="0" y="190" width="480" height="110" fill="url(#riv)"/>`;
  const r = rand(7);
  for (let k = 0; k < 14; k++) s += `<ellipse cx="${(r() * 480).toFixed(0)}" cy="${(200 + r() * 50).toFixed(0)}" rx="${(10 + r() * 22).toFixed(0)}" ry="${(2.5 + r() * 3).toFixed(1)}" fill="#F4FAFC" opacity=".85"/>`;
  for (let k = 0; k < 10; k++) s += `<path d="M${(r() * 480).toFixed(0)} ${(205 + r() * 45).toFixed(0)}h${(8 + r() * 16).toFixed(0)}" stroke="#FFFFFF" stroke-width="1.5" opacity=".35" stroke-linecap="round"/>`;
  // quay stones
  s += `<rect x="0" y="252" width="480" height="48" fill="#9AA6AE"/>`;
  for (let k = 0; k < 16; k++) s += `<path d="M${k * 32} 252v48" stroke="#7D8A93" stroke-width="2"/>`;
  return svg(s);
}

// ---------- Mont-Royal at dusk: the mountain, the lit cross on the summit, the chalet with its
// arched windows and the belvedere balustrade, conifers and lamps.
function montRoyal() {
  let s = sky('mr', [[0, '#3E2C5E'], [0.45, '#8E4F78'], [0.8, '#E0896F'], [1, '#F4B27C']]);
  const r = rand(11);
  for (let k = 0; k < 18 + 60; k++) s += `<circle cx="${(r() * 480).toFixed(0)}" cy="${(k < 18 ? r() * 60 : -r() * SKY_EXT).toFixed(0)}" r="${(0.6 + r()).toFixed(1)}" fill="#FFF4E0" opacity=".8"/>`;
  s += `<circle cx="90" cy="150" r="46" fill="#FFC98A" opacity=".35"/>`;
  // mountain layers
  s += `<path d="M-10 170Q110 112 240 56Q370 112 490 150V300H-10z" fill="#6A4580"/>`;
  s += `<path d="M-10 196Q90 150 200 160T380 120 490 150V300H-10z" fill="#7E4E7C"/>`;
  // the cross: steel lattice, lit
  s += `<circle cx="240" cy="40" r="26" fill="#FFE3A3" opacity=".22"/><rect x="237" y="16" width="6" height="46" fill="#FFF1C8"/><rect x="227" y="28" width="26" height="5" fill="#FFF1C8"/>`;
  // conifers and bare trees on the slopes
  for (let k = 0; k < 26; k++) {
    const x = (r() * 500 - 10), base = 70 + Math.abs(x - 240) * 0.42 + 10 + r() * 30, h = 14 + r() * 16;
    s += `<path d="M${x.toFixed(0)} ${(base - h).toFixed(0)}l${(h * 0.35).toFixed(0)} ${h.toFixed(0)}h-${(h * 0.7).toFixed(0)}z" fill="#3B2546" opacity="${(0.65 + r() * 0.35).toFixed(2)}"/>`;
  }
  // the chalet: stone pavilion, hipped roof, lit arched windows, belvedere balustrade
  s += `<rect x="60" y="168" width="170" height="64" fill="#D9B48C"/><path d="M50 170L80 140H210L240 170z" fill="#4A2F55"/><rect x="132" y="128" width="26" height="14" fill="#4A2F55"/>`;
  for (let k = 0; k < 5; k++) s += `<path d="M${76 + k * 30} 226v-30a9 9 0 0 1 18 0v30z" fill="#FFD48A" stroke="#B98F66" stroke-width="2"/>`;
  s += `<rect x="30" y="232" width="250" height="6" fill="#E9D3B6"/>`;
  for (let k = 0; k < 24; k++) s += `<rect x="${34 + k * 10.3}" y="238" width="4" height="16" fill="#E9D3B6"/>`;
  s += `<rect x="30" y="252" width="250" height="5" fill="#E9D3B6"/>`;
  // lamps
  for (const x of [300, 380, 450]) s += `<rect x="${x - 1.5}" y="196" width="3" height="60" fill="#2E1E36"/><circle cx="${x}" cy="194" r="12" fill="#FFD48A" opacity=".3"/><circle cx="${x}" cy="194" r="4.5" fill="#FFE9B8"/>`;
  return svg(s);
}

// ---------- Mile End in the morning mist: greystone row houses with cornices and bay windows,
// the green Byzantine dome of Saint-Michel-Archange, a wood-oven bagel shop and a mural.
function mileEnd() {
  const stone = ['#E6DFCC', '#D6D3BE', '#C9CDB6'], cornice = '#5D7353', win = '#F3EBD3', iron = '#33402E';
  let s = sky('me', [[0, '#DCE5DA'], [1, '#F6F4EC']]);
  // church: drum, copper-green dome, bell tower with cupola
  s += `<rect x="188" y="92" width="104" height="110" fill="#D8CDB5"/><rect x="206" y="70" width="68" height="26" fill="#CFC3A8"/><path d="M204 72a36 36 0 0 1 72 0z" fill="#6E9C86"/><path d="M240 36v-10M235 31h10" stroke="#5D7353" stroke-width="2.5"/>`;
  for (let k = 0; k < 4; k++) s += `<path d="M${200 + k * 24} 140v-18a6 6 0 0 1 12 0v18z" fill="#8FA79A" opacity=".8"/>`;
  s += `<rect x="296" y="40" width="30" height="160" fill="#D8CDB5"/><path d="M296 40a15 15 0 0 1 30 0z" fill="#6E9C86"/><rect x="304" y="58" width="14" height="22" rx="7" fill="#8FA79A"/>`;
  // mist bands
  s += `<rect x="0" y="120" width="480" height="16" fill="#FFFFFF" opacity=".35"/><rect x="0" y="150" width="480" height="10" fill="#FFFFFF" opacity=".25"/>`;
  // greystones: three fronts, the middle one the bagel shop
  const fronts = [[-10, 0], [150, 1], [330, 2]];
  for (const [x, i] of fronts) {
    const w = i === 1 ? 170 : 160, top = i === 1 ? 128 : 112;
    s += `<rect x="${x}" y="${top}" width="${w}" height="${300 - top}" fill="${stone[i]}"/>`;
    s += `<rect x="${x - 4}" y="${top - 8}" width="${w + 8}" height="10" fill="${cornice}"/>`;
    for (let k = 0; k < Math.floor(w / 12); k++) s += `<rect x="${x + 2 + k * 12}" y="${top + 2}" width="5" height="5" fill="${cornice}"/>`;
    if (i !== 1) {
      // bay window (oriel) + straight outdoor stair with iron rail
      s += `<path d="M${x + 24} ${top + 22}h52l6 8v42h-64v-42z" fill="${stone[i]}" stroke="${cornice}" stroke-width="2"/>`;
      s += `<rect x="${x + 30}" y="${top + 34}" width="14" height="30" fill="${win}"/><rect x="${x + 50}" y="${top + 34}" width="14" height="30" fill="${win}"/><rect x="${x + 68}" y="${top + 34}" width="8" height="30" fill="${win}" opacity=".8"/>`;
      s += `<rect x="${x + 104}" y="${top + 26}" width="30" height="40" fill="${win}" stroke="${cornice}" stroke-width="2"/>`;
      s += `<path d="M${x + 92} 270L${x + 142} ${top + 96}" stroke="${iron}" stroke-width="3"/><path d="M${x + 100} 270L${x + 150} ${top + 96}" stroke="${iron}" stroke-width="2"/>`;
      s += `<path d="M${x + 96} ${top + 96}h${54}" stroke="${iron}" stroke-width="3"/>`;
    } else {
      // bagel shop: striped awning, oven glow, sign
      s += `<rect x="${x + 12}" y="${top + 16}" width="${w - 24}" height="26" rx="3" fill="#3F5235"/><text x="${x + w / 2}" y="${top + 35}" font-size="16" font-weight="700" text-anchor="middle" fill="#F3EBD3" font-family="Georgia">BAGEL</text>`;
      for (let k = 0; k < 10; k++) s += `<path d="M${x + 10 + k * 15} ${top + 50}h15v12a7.5 7.5 0 0 1-15 0z" fill="${k % 2 ? '#F3EBD3' : '#8FAE8B'}"/>`;
      s += `<rect x="${x + 20}" y="${top + 74}" width="${w - 40}" height="62" fill="#2D3326"/><ellipse cx="${x + w / 2}" cy="${top + 120}" rx="44" ry="20" fill="#FF9A3D" opacity=".75"/><ellipse cx="${x + w / 2}" cy="${top + 122}" rx="24" ry="10" fill="#FFD27A"/>`;
      for (let k = 0; k < 5; k++) s += `<circle cx="${x + 46 + k * 20}" cy="${top + 88}" r="7" fill="none" stroke="#D9A96A" stroke-width="4"/>`;
    }
  }
  // mural on the left gable
  s += `<rect x="0" y="210" width="60" height="44" fill="#4E6B2E"/><circle cx="18" cy="226" r="11" fill="#F6C945"/><path d="M30 254q12-30 30-30v30z" fill="#C9785A"/><path d="M0 244q16-10 30 0" stroke="#E6DFCC" stroke-width="4" fill="none"/>`;
  return svg(s);
}

// ---------- Nuit MTL: downtown at night. Place Ville Marie and its beacon, 1000 de La
// Gauchetière's copper crown, the Olympic Stadium's leaning tower, lit triplexes below.
function nuit() {
  let s = sky('nu', [[0, '#090D2B'], [0.6, '#1A2250'], [1, '#2B3A4A']]);
  const r = rand(23);
  for (let k = 0; k < 40 + 90; k++) s += `<circle cx="${(r() * 480).toFixed(0)}" cy="${(k < 40 ? r() * 110 : -r() * SKY_EXT).toFixed(0)}" r="${(0.5 + r() * 1.1).toFixed(1)}" fill="#FFFFFF" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`;
  s += `<circle cx="70" cy="36" r="13" fill="#F4F1E0"/><circle cx="76" cy="31" r="12" fill="#0E1436"/>`;
  // beacon beams from Place Ville Marie
  s += `<path d="M232 36L-253 -120H-80z" fill="#5FF2B8" opacity=".14"/><path d="M232 36L786 -120H656z" fill="#5FF2B8" opacity=".1"/>`;
  const tower = '#1F2A44', tower2 = '#26324F', lit = '#FFD98A', mint = '#5FF2B8';
  const windows = (x: number, y: number, w: number, h: number, density: number) => {
    let o = '';
    for (let yy = y + 6; yy < y + h - 4; yy += 9) for (let xx = x + 4; xx < x + w - 4; xx += 7) if (r() < density) o += `<rect x="${xx}" y="${yy}" width="3" height="4" fill="${r() < 0.8 ? lit : mint}" opacity="${(0.55 + r() * 0.45).toFixed(2)}"/>`;
    return o;
  };
  // back towers
  for (const [x, y, w] of [[0, 120, 40], [100, 96, 36], [300, 110, 44], [420, 90, 40]] as const) s += `<rect x="${x}" y="${y}" width="${w}" height="${300 - y}" fill="${tower2}"/>` + windows(x, y, w, 300 - y, 0.18);
  // Place Ville Marie: cruciform slab with setbacks, beacon on the roof
  s += `<rect x="206" y="40" width="52" height="260" fill="${tower}"/><rect x="196" y="60" width="72" height="240" fill="${tower}"/>` + windows(196, 60, 72, 240, 0.3);
  s += `<rect x="228" y="30" width="8" height="10" fill="${tower}"/><circle cx="232" cy="32" r="7" fill="${mint}" opacity=".35"/><circle cx="232" cy="32" r="3" fill="${mint}"/>`;
  // 1000 de La Gauchetière: copper pyramid crown
  s += `<rect x="140" y="70" width="42" height="230" fill="${tower2}"/><path d="M140 70L161 38 182 70z" fill="#B87333"/><path d="M161 38v-10" stroke="#B87333" stroke-width="2"/>` + windows(140, 70, 42, 230, 0.25);
  // Olympic Stadium: leaning tower over the bowl
  s += `<path d="M340 190Q400 150 470 190z" fill="${tower2}"/><path d="M352 186L398 66 412 72 380 188z" fill="#2E3B5A"/><path d="M398 66l14 6" stroke="${mint}" stroke-width="2" opacity=".8"/>`;
  for (let k = 0; k < 6; k++) s += `<rect x="${388 - k * 5}" y="${90 + k * 15}" width="4" height="3" fill="${lit}" opacity=".8"/>`;
  // lit triplexes in front, snow glowing
  for (let i = 0; i < 4; i++) {
    const x = i * 124 - 10;
    s += `<rect x="${x}" y="176" width="118" height="124" fill="#2A2F45"/><rect x="${x - 3}" y="170" width="124" height="7" fill="#C9D9E8"/>`;
    for (let fl = 0; fl < 3; fl++) for (let c = 0; c < 3; c++) s += `<rect x="${x + 12 + c * 36}" y="${186 + fl * 28}" width="20" height="18" fill="${(i + fl + c) % 4 ? lit : '#3A4160'}" opacity=".9"/>`;
  }
  for (const x of [60, 200, 340, 460]) s += `<rect x="${x - 1.5}" y="214" width="3" height="50" fill="#0F1426"/><circle cx="${x}" cy="212" r="14" fill="${lit}" opacity=".25"/><circle cx="${x}" cy="212" r="4" fill="#FFF0C4"/>`;
  return svg(s);
}

// ---------- Vieux-Québec in snowfall: the Château Frontenac's verdigris roofs and turrets above
// the stone city wall and its gate, steep-roofed fieldstone houses of Petit-Champlain below.
function vieuxQuebec() {
  const cu = '#5E9C8F', cuDark = '#3F7468', brick = '#A8644A', brick2 = '#94563F', stone = '#C8B79A', stone2 = '#B3A284', win = '#FFE6B0', ink = '#3A2E26';
  let s = sky('vq', [[0, '#C9CDD9'], [1, '#EEEDF2']]);
  // château: body, wings, then roofs (steep pyramids and cone turrets)
  s += `<rect x="150" y="96" width="190" height="130" fill="${brick}"/><rect x="110" y="128" width="60" height="98" fill="${brick2}"/><rect x="322" y="122" width="64" height="104" fill="${brick2}"/>`;
  s += `<rect x="214" y="58" width="60" height="70" fill="${brick}"/><path d="M208 60L244 2 280 60z" fill="${cu}"/><path d="M244 2v-8" stroke="${cuDark}" stroke-width="2"/>`;
  s += `<path d="M144 98L176 66H316L346 98z" fill="${cu}"/><path d="M104 130L124 104H156L176 130z" fill="${cu}"/><path d="M316 124L338 98H370L392 124z" fill="${cu}"/>`;
  for (const [x, y, w, h] of [[150, 98, 22, 34], [318, 98, 22, 34], [104, 130, 18, 28], [376, 124, 18, 28]] as const) s += `<rect x="${x}" y="${y}" width="${w}" height="${h + 40}" fill="${brick2}"/><path d="M${x - 3} ${y}L${x + w / 2} ${y - h}L${x + w + 3} ${y}z" fill="${cu}"/>`;
  for (let k = 0; k < 7; k++) s += `<path d="M${182 + k * 18} 98v-10l6-6 6 6v10" fill="${cu}" stroke="${cuDark}" stroke-width="1"/>`;
  for (let row = 0; row < 4; row++) for (let c = 0; c < 9; c++) {
    const x = 160 + c * 20, y = 112 + row * 26;
    s += `<rect x="${x}" y="${y}" width="8" height="12" fill="${(row + c) % 3 ? win : '#7A4B3A'}" opacity=".9"/>`;
  }
  for (let row = 0; row < 3; row++) for (let c = 0; c < 2; c++) s += `<rect x="${120 + c * 26}" y="${142 + row * 24}" width="8" height="11" fill="${win}" opacity=".85"/><rect x="${332 + c * 26}" y="${136 + row * 24}" width="8" height="11" fill="${win}" opacity=".85"/>`;
  // snow on the roofs' lower edges
  s += `<path d="M144 98H346" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/><path d="M104 130h72M316 124h76" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>`;
  // Petit-Champlain houses: fieldstone, steep roofs, dormers, red doors
  for (const [x, w] of [[-6, 70], [60, 58]] as const) {
    s += `<rect x="${x}" y="176" width="${w}" height="80" fill="${stone}"/><path d="M${x - 4} 178L${x + w / 2} 140L${x + w + 4} 178z" fill="#5C6670"/><rect x="${x + w / 2 - 7}" y="152" width="14" height="14" fill="${stone2}"/><path d="M${x + w / 2 - 9} 154l9-8 9 8" fill="#5C6670"/>`;
    s += `<rect x="${x + 10}" y="192" width="14" height="18" fill="${win}" stroke="#FFFFFF" stroke-width="2"/><rect x="${x + w - 24}" y="192" width="14" height="18" fill="${win}" stroke="#FFFFFF" stroke-width="2"/><rect x="${x + w / 2 - 7}" y="222" width="14" height="30" fill="#8E3B46"/>`;
    s += `<path d="M${x - 4} 178L${x + w / 2} 140L${x + w + 4} 178" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round"/>`;
  }
  // the city wall: crenellated stone with the gate arch
  s += `<rect x="120" y="214" width="370" height="86" fill="${stone}"/>`;
  for (let k = 0; k < 19; k++) s += `<rect x="${122 + k * 20}" y="204" width="12" height="12" fill="${stone}"/><rect x="${122 + k * 20}" y="202" width="12" height="3" fill="#FFFFFF"/>`;
  for (let row = 0; row < 4; row++) s += `<path d="M120 ${226 + row * 14}H490" stroke="${stone2}" stroke-width="1.5"/>`;
  s += `<rect x="372" y="186" width="70" height="114" fill="${stone2}"/><path d="M386 300V250a21 21 0 0 1 42 0v50z" fill="${ink}"/>`;
  for (let k = 0; k < 4; k++) s += `<rect x="${374 + k * 18}" y="178" width="12" height="10" fill="${stone2}"/>`;
  // snowfall
  const r = rand(31);
  for (let k = 0; k < 70 + 80; k++) s += `<circle cx="${(r() * 480).toFixed(0)}" cy="${(k < 70 ? r() * 260 : -r() * SKY_EXT).toFixed(0)}" r="${(0.8 + r() * 1.8).toFixed(1)}" fill="#FFFFFF" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`;
  return svg(s);
}

export const THEMES: Record<ThemeKey, GameTheme> = {
  plateau: {
    key: 'plateau', name: { en: 'Plateau Brick', fr: 'Brique du Plateau' }, gradient: [muteColor('#C9785A', PAPER), muteColor('#E8C9A0', PAPER)],
    accent: '#1F6B45', onAccent: '#FFFFFF', lane: '#D9DED8', snow: '#FFFFFF', snowShade: '#DBE7EE', laneInk: '#12291F', laneMuted: '#415E52', backdrop: mute(plateau()),
  },
  'saint-laurent': {
    key: 'saint-laurent', name: { en: 'St-Laurent', fr: 'Saint-Laurent' }, gradient: [muteColor('#2F7F86', PAPER), muteColor('#4F6D8F', PAPER)],
    accent: '#0F5E63', onAccent: '#FFFFFF', lane: '#D3DBDF', snow: '#F6FBFD', snowShade: '#CFE0E8', laneInk: '#13282E', laneMuted: '#3E5A63', backdrop: mute(saintLaurent()),
  },
  'mont-royal': {
    key: 'mont-royal', name: { en: 'Mont-Royal', fr: 'Mont-Royal' }, gradient: [muteColor('#5B3A6B', PAPER), muteColor('#E59A6B', PAPER)],
    accent: '#8E2C6B', onAccent: '#FFFFFF', lane: '#E3D6DA', snow: '#FFF7F2', snowShade: '#E8CFD6', laneInk: '#2A1630', laneMuted: '#5E4566', backdrop: mute(montRoyal()),
  },
  'mile-end': {
    key: 'mile-end', name: { en: 'Mile End', fr: 'Mile-End' }, gradient: [muteColor('#8FAE8B', PAPER), muteColor('#E6DFCC', PAPER)],
    accent: '#4E6B2E', onAccent: '#FFFFFF', lane: '#DEDCCD', snow: '#FBFAF4', snowShade: '#DCDDCB', laneInk: '#1F2A17', laneMuted: '#4E5A44', backdrop: mute(mileEnd()),
  },
  nuit: {
    key: 'nuit', name: { en: 'Nuit MTL', fr: 'Nuit MTL' }, gradient: [muteColor('#1B1F4A', PAPER), muteColor('#2B3A4A', PAPER)],
    accent: '#5FF2B8', onAccent: '#0B1A14', lane: '#1E2836', snow: '#C9D9E8', snowShade: '#8FA6BC', laneInk: '#EAF2F0', laneMuted: '#A9BBC8', backdrop: mute(nuit(), NIGHT_AIR),
  },
  'vieux-quebec': {
    key: 'vieux-quebec', name: { en: 'Old Québec', fr: 'Vieux-Québec' }, gradient: [muteColor('#5E9C8F', PAPER), muteColor('#C8B79A', PAPER)],
    accent: '#9A4A2C', onAccent: '#FFFFFF', lane: '#DCDADF', snow: '#FFFFFF', snowShade: '#D6D8E2', laneInk: '#2A211B', laneMuted: '#5E524A', backdrop: mute(vieuxQuebec()),
  },
};
export const THEME_ORDER: ThemeKey[] = ['plateau', 'saint-laurent', 'mont-royal', 'mile-end', 'nuit', 'vieux-quebec'];

// ---------- Text that sits straight on the backdrop (no pills behind it)
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const isDark = (hex: string) => lum(hex) < 0.22;
/** The sky colour at the top of a backdrop: the header's text sits on it. */
export const skyTopOf = (t: GameTheme) => /stop-color="(#[0-9A-Fa-f]{6})"/.exec(t.backdrop)?.[1] ?? '#CFE6F3';
/** Ink for text over the sky and the street, chosen by contrast rather than by theme name. */
export const skyInk = (t: GameTheme) => (isDark(skyTopOf(t)) ? '#FFFFFF' : '#12291F');
export const streetDark = (t: GameTheme) => isDark(t.lane);
