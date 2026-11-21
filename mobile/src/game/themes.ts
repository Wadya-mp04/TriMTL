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

const svg = (body: string) => `<svg viewBox="0 0 480 300" preserveAspectRatio="xMidYMax slice">${body}</svg>`;
const sky = (id: string, stops: [number, string][]) =>
  `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient></defs><rect width="480" height="300" fill="url(#${id})"/>`;
/** Deterministic scatter so a backdrop is identical on every render. */
const rand = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// ---------- Plateau: brick triplexes with the outdoor spiral stairs and painted doors.
function plateau() {
  const brick = ['#C9785A', '#D9946B', '#E3B48A'], win = '#FFF3CF', frame = '#F7F1E6', iron = '#2B302D', snow = '#FFFFFF';
  const doors = ['#1F6B45', '#2E5E8C', '#8E3B46'];
  let s = sky('pl', [[0, '#BFDDF0'], [1, '#F1F7FA']]);
  s += `<circle cx="420" cy="34" r="16" fill="#FFFFFF" opacity=".7"/>`;
  for (let i = 0; i < 3; i++) {
    const x = i * 170 - 20, w = 160;
    s += `<rect x="${x}" y="40" width="${w}" height="240" fill="${brick[i]}"/>`;
    s += `<rect x="${x - 4}" y="32" width="${w + 8}" height="12" fill="${frame}"/><path d="M${x - 4} 32h${w + 8}" stroke="${iron}" stroke-width="2" opacity=".35"/><rect x="${x - 4}" y="27" width="${w + 8}" height="6" rx="3" fill="${snow}"/>`;
    for (let fl = 0; fl < 3; fl++) {
      const y = 62 + fl * 72;
      s += `<rect x="${x + 18}" y="${y}" width="34" height="44" rx="2" fill="${win}" stroke="${frame}" stroke-width="4"/>`;
      s += fl < 2
        ? `<rect x="${x + 100}" y="${y}" width="26" height="54" rx="2" fill="${doors[i]}" stroke="${frame}" stroke-width="4"/><rect x="${x + 104}" y="${y + 5}" width="18" height="14" fill="${win}" opacity=".9"/>`
        : `<rect x="${x + 100}" y="${y}" width="26" height="54" rx="2" fill="${win}" stroke="${frame}" stroke-width="4" opacity=".9"/>`;
      s += `<path d="M${x + 6} ${y + 58}h${w - 12}" stroke="${iron}" stroke-width="3"/><path d="M${x + 6} ${y + 58}v14M${x + w - 6} ${y + 58}v14" stroke="${iron}" stroke-width="2"/>`;
      for (let k = 0; k < 14; k++) s += `<path d="M${x + 14 + k * 10} ${y + 58}v14" stroke="${iron}" stroke-width="1.4"/>`;
      s += `<rect x="${x + 4}" y="${y + 53}" width="${w - 8}" height="5" rx="2.5" fill="${snow}"/>`;
    }
    s += `<path d="M${x + 150} 274 C ${x + 150} 230, ${x + 70} 236, ${x + 74} 196" fill="none" stroke="${iron}" stroke-width="3"/>`;
    s += `<path d="M${x + 140} 274 C ${x + 140} 236, ${x + 62} 242, ${x + 64} 196" fill="none" stroke="${iron}" stroke-width="3"/>`;
    for (let k = 0; k < 8; k++) {
      const t = k / 7, xx = x + 145 - 76 * t, yy = 272 - 74 * t;
      s += `<path d="M${xx - 6} ${yy}h14" stroke="${snow}" stroke-width="3" stroke-linecap="round"/>`;
    }
  }
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
  for (let k = 0; k < 18; k++) s += `<circle cx="${(r() * 480).toFixed(0)}" cy="${(r() * 60).toFixed(0)}" r="${(0.6 + r()).toFixed(1)}" fill="#FFF4E0" opacity=".8"/>`;
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
  for (let k = 0; k < 40; k++) s += `<circle cx="${(r() * 480).toFixed(0)}" cy="${(r() * 110).toFixed(0)}" r="${(0.5 + r() * 1.1).toFixed(1)}" fill="#FFFFFF" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`;
  s += `<circle cx="70" cy="36" r="13" fill="#F4F1E0"/><circle cx="76" cy="31" r="12" fill="#0E1436"/>`;
  // beacon beams from Place Ville Marie
  s += `<path d="M232 36L120 0H160z" fill="#5FF2B8" opacity=".14"/><path d="M232 36L360 0H330z" fill="#5FF2B8" opacity=".1"/>`;
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
  for (let k = 0; k < 70; k++) s += `<circle cx="${(r() * 480).toFixed(0)}" cy="${(r() * 260).toFixed(0)}" r="${(0.8 + r() * 1.8).toFixed(1)}" fill="#FFFFFF" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`;
  return svg(s);
}

export const THEMES: Record<ThemeKey, GameTheme> = {
  plateau: {
    key: 'plateau', name: { en: 'Plateau Brick', fr: 'Brique du Plateau' }, gradient: ['#C9785A', '#E8C9A0'],
    accent: '#1F6B45', onAccent: '#FFFFFF', lane: '#D9DED8', snow: '#FFFFFF', snowShade: '#DBE7EE', laneInk: '#12291F', laneMuted: '#415E52', backdrop: plateau(),
  },
  'saint-laurent': {
    key: 'saint-laurent', name: { en: 'St-Laurent', fr: 'Saint-Laurent' }, gradient: ['#2F7F86', '#4F6D8F'],
    accent: '#0F5E63', onAccent: '#FFFFFF', lane: '#D3DBDF', snow: '#F6FBFD', snowShade: '#CFE0E8', laneInk: '#13282E', laneMuted: '#3E5A63', backdrop: saintLaurent(),
  },
  'mont-royal': {
    key: 'mont-royal', name: { en: 'Mont-Royal', fr: 'Mont-Royal' }, gradient: ['#5B3A6B', '#E59A6B'],
    accent: '#8E2C6B', onAccent: '#FFFFFF', lane: '#E3D6DA', snow: '#FFF7F2', snowShade: '#E8CFD6', laneInk: '#2A1630', laneMuted: '#5E4566', backdrop: montRoyal(),
  },
  'mile-end': {
    key: 'mile-end', name: { en: 'Mile End', fr: 'Mile-End' }, gradient: ['#8FAE8B', '#E6DFCC'],
    accent: '#4E6B2E', onAccent: '#FFFFFF', lane: '#DEDCCD', snow: '#FBFAF4', snowShade: '#DCDDCB', laneInk: '#1F2A17', laneMuted: '#4E5A44', backdrop: mileEnd(),
  },
  nuit: {
    key: 'nuit', name: { en: 'Nuit MTL', fr: 'Nuit MTL' }, gradient: ['#1B1F4A', '#2B3A4A'],
    accent: '#5FF2B8', onAccent: '#0B1A14', lane: '#1E2836', snow: '#C9D9E8', snowShade: '#8FA6BC', laneInk: '#EAF2F0', laneMuted: '#A9BBC8', backdrop: nuit(),
  },
  'vieux-quebec': {
    key: 'vieux-quebec', name: { en: 'Old Québec', fr: 'Vieux-Québec' }, gradient: ['#5E9C8F', '#C8B79A'],
    accent: '#9A4A2C', onAccent: '#FFFFFF', lane: '#DCDADF', snow: '#FFFFFF', snowShade: '#D6D8E2', laneInk: '#2A211B', laneMuted: '#5E524A', backdrop: vieuxQuebec(),
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
