/**
 * Clip-art for the sort game, as SVG strings rendered with react-native-svg's SvgXml.
 * One style throughout: flat fills, a 3.5 ink outline, one white highlight.
 * Bins are drawn after Montréal's curbside carts (no City logo) and split into layers so the
 * item can drop between the open lid and the front of the bin.
 */
import type { BinKey } from '../theme';

/** Fixed illustration palette: the drawings keep their real-world colours. */
const P = {
  outline: '#1A2620',
  hi: 'rgba(255,255,255,0.65)',
  card: '#D9A96A', card2: '#E9C48D', grease: '#A8712C',
  paper: '#FBF6EA', white: '#FFFFFF',
  metal: '#CCD4D8', metal2: '#98A4AB',
  copper: '#D98A3A', yellow: '#F6C945', egg: '#F2DFC2',
  teal: '#2F8F86', glass: '#CFE9E4', film: '#E4EFE8',
  sky: '#8FC0EA', plum: '#7D5AA6', leafy: '#3AA76D',
  mouth: '#0D1412', rim: 'rgba(255,255,255,0.28)', shade: 'rgba(0,0,0,0.16)',
  clay: '#B5523B',
};

/** Cart colours: Montréal's blue recycling cart, the brown bin, a black garbage cart, and the
 *  app's own purple for special drop-off so it matches the rest of TriMTL. */
export const CART: Record<BinKey, string> = {
  recycling: '#1D5FA8',
  compost: '#7A4B24',
  garbage: '#3A4245',
  special: '#6D28D9',
};
export const CONFETTI = [P.yellow, P.leafy, P.white, P.sky];
export const MARK_COLOR = P.clay;

const O = `stroke="${P.outline}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`;
const f = (c: string) => `fill="${c}"`;
const HI = `fill="none" stroke="${P.hi}" stroke-width="4" stroke-linecap="round"`;

/** Keyed by the rules engine's icon names (server/src/data/quebecRules.json `icon`). */
const ART: Record<string, string> = {
  can: `<rect x="32" y="16" width="36" height="72" rx="8" ${f(P.sky)} ${O}/><path d="M34 26h32M34 78h32" ${O} fill="none"/><rect x="32" y="40" width="36" height="22" ${f(P.white)} ${O}/><path d="M42 20h10" ${O}/><path d="M38 32v40" ${HI}/>`,
  bottle: `<rect x="42" y="8" width="16" height="9" rx="2" ${f(P.teal)} ${O}/><path d="M43 17h14v6q10 6 10 16v44a5 5 0 0 1-5 5H38a5 5 0 0 1-5-5V39q0-10 10-16z" ${f(P.glass)} ${O}/><rect x="33" y="46" width="34" height="18" ${f(P.white)} ${O}/><path d="M39 32q-2 6-2 12M39 70v10" ${HI}/>`,
  wrapper: `<path d="M26 20h48l-4 34 4 32H26l4-32z" ${f(P.yellow)} ${O}/><path d="M26 20l4 5 4-5 4 5 4-5 4 5 4-5 4 5 4-5 4 5 4-5 4 5 4-5M26 86l4-5 4 5 4-5 4 5 4-5 4 5 4-5 4 5 4-5 4 5 4-5 4 5" ${O} fill="none"/><circle cx="50" cy="54" r="12" ${f(P.card2)} ${O}/><path d="M45 50l3 2M53 57l2 1M52 48l1 2" ${O}/><path d="M34 32v42" ${HI}/>`,
  battery: `<rect x="42" y="10" width="16" height="10" rx="3" ${f(P.metal)} ${O}/><rect x="30" y="18" width="40" height="72" rx="8" ${f(P.outline)} ${O}/><path d="M30 26a8 8 0 0 1 8-8h24a8 8 0 0 1 8 8v16H30z" ${f(P.copper)} ${O}/><path d="M50 26v10M45 31h10" stroke="${P.white}" stroke-width="3.5" stroke-linecap="round"/><path d="M38 50v32" ${HI}/>`,
  pizza_box: `<path d="M14 46h72v32a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6z" ${f(P.card)} ${O}/><path d="M14 46l8-30h62l2 30z" ${f(P.card2)} ${O}/><ellipse cx="40" cy="30" rx="8" ry="5" ${f(P.grease)} opacity=".7"/><ellipse cx="64" cy="26" rx="5" ry="3.5" ${f(P.grease)} opacity=".7"/><ellipse cx="58" cy="66" rx="9" ry="5" ${f(P.grease)} opacity=".6"/><path d="M14 56h72" ${O} opacity=".35"/><path d="M26 22l-4 16" ${HI}/>`,
  cup: `<path d="M30 30h40l-6 58H36z" ${f(P.paper)} ${O}/><path d="M32 48h36l-2 20H34z" ${f(P.card)} ${O}/><rect x="25" y="22" width="50" height="10" rx="4" ${f(P.white)} ${O}/><path d="M35 22l3-8h24l3 8" ${f(P.white)} ${O}/><path d="M38 74l1 8" ${HI}/>`,
  spray: `<rect x="40" y="10" width="18" height="12" rx="3" ${f(P.teal)} ${O}/><path d="M58 14h8" ${O}/><path d="M32 30a10 10 0 0 1 10-10h16a10 10 0 0 1 10 10v54a4 4 0 0 1-4 4H36a4 4 0 0 1-4-4z" ${f(P.metal)} ${O}/><rect x="32" y="44" width="36" height="24" ${f(P.teal)} ${O}/><path d="M40 30v48" ${HI}/>`,
  egg: `<path d="M12 62q0 26 22 26t22-26l-5-6-5 8-6-10-6 9-6-8-5 7-5-6z" ${f(P.egg)} ${O}/><path d="M48 56q2-26 20-26t20 26l-4 5-5-7-5 9-6-9-5 8-6-7z" ${f(P.egg)} ${O} transform="rotate(14 68 46)"/><path d="M20 70q2 10 10 12" ${HI}/>`,
  carton: `<path d="M30 36l10-18h22l8 18v52H30z" ${f(P.white)} ${O}/><path d="M38 12h24v7H38z" ${f(P.white)} ${O}/><path d="M50 18l8 18v52" ${O} fill="none"/><rect x="30" y="52" width="20" height="18" ${f(P.sky)} ${O}/><path d="M36 40v40" ${HI}/>`,
  glass_jar: `<rect x="30" y="12" width="40" height="13" rx="3" ${f(P.metal2)} ${O}/><path d="M28 25h44q8 8 8 20v34q0 10-10 10H30q-10 0-10-10V45q0-12 8-20z" ${f(P.glass)} ${O}/><rect x="26" y="50" width="48" height="20" rx="3" ${f(P.paper)} ${O}/><path d="M28 36q-2 6-2 12M28 76v6" ${HI}/>`,
  smoke_detector: `<circle cx="50" cy="50" r="36" ${f(P.white)} ${O}/><circle cx="50" cy="50" r="22" ${f(P.paper)} ${O}/><path d="M40 44h20M38 50h24M40 56h20" ${O} opacity=".5"/><circle cx="72" cy="34" r="4" ${f(P.leafy)} ${O}/><path d="M24 40q-2 10 2 20" ${HI}/>`,
  broken_glass: `<path d="M50 20a34 34 0 0 0-30 50l20-10-6-12 12-6z" ${f(P.white)} ${O}/><path d="M60 22a34 34 0 0 1 14 58 34 34 0 0 1-40-2l16-12 6 8 2-16-8-8z" ${f(P.white)} ${O} transform="translate(4 -2)"/><circle cx="54" cy="52" r="16" fill="none" stroke="${P.sky}" stroke-width="3" stroke-dasharray="6 5"/><path d="M26 46q-2 8 1 16" ${HI}/>`,
  plastic_bag: `<path d="M34 34q-6-22 8-22t8 22M50 34q-2-22 10-22t6 22" fill="none" ${O}/><path d="M22 34h56l-4 52a4 4 0 0 1-4 4H30a4 4 0 0 1-4-4z" ${f(P.film)} ${O}/><path d="M36 52q14 6 28 0" fill="none" ${O} opacity=".35"/><path d="M30 44v36" ${HI}/>`,
  bulb: `<path d="M50 10a26 26 0 0 1 15 47v7H35v-7a26 26 0 0 1 15-47z" ${f(P.yellow)} ${O}/><rect x="36" y="64" width="28" height="8" rx="2" ${f(P.metal)} ${O}/><rect x="38" y="72" width="24" height="8" rx="2" ${f(P.metal2)} ${O}/><path d="M44 80h12l-3 8h-6z" ${f(P.outline)} ${O}/><path d="M36 26q-4 8-2 16" ${HI}/>`,
  paint: `<path d="M22 32q28-26 56 0" fill="none" ${O}/><rect x="20" y="30" width="60" height="58" rx="6" ${f(P.metal)} ${O}/><rect x="20" y="46" width="60" height="26" ${f(P.plum)} ${O}/><path d="M34 30v10q0 5 4 5t4-5v-10" ${f(P.plum)} ${O}/><path d="M28 54v12" ${HI}/>`,
  tissue: `<path d="M20 56l8-24 20-8 20 6 14 18-4 24-18 12-24-2-14-12z" ${f(P.paper)} ${O}/><path d="M36 34l8 18-14 10M60 34l-6 20 16 10M44 52l10 2M48 80l6-26" fill="none" ${O} opacity=".4"/><path d="M28 48l-2 8" ${HI}/>`,
  utensils: `<path d="M30 12v22q0 8 6 10v44a4 4 0 0 0 8 0V44q6-2 6-10V12M37 12v18M43 12v18" ${f(P.white)} ${O}/><g transform="rotate(14 66 50)"><rect x="60" y="10" width="12" height="80" rx="6" ${f(P.white)} ${O}/><path d="M60 24h12M60 40h12M60 56h12M60 72h12" stroke="${P.teal}" stroke-width="5"/><rect x="60" y="10" width="12" height="80" rx="6" fill="none" ${O}/></g>`,
  food: `<path d="M44 48q-20 8-26 32 16-4 26-20z" ${f(P.yellow)} ${O}/><path d="M56 48q20 8 26 32-16-4-26-20z" ${f(P.yellow)} ${O}/><path d="M43 46h14l3 34q-10 8-20 0z" ${f(P.egg)} ${O}/><path d="M47 46q1-22 2-30h4q1 8 1 30" ${f(P.card)} ${O}/><path d="M28 68q4-8 10-12" ${HI}/>`,
  paper: `<rect x="18" y="22" width="64" height="56" rx="3" ${f(P.paper)} ${O}/><rect x="24" y="28" width="52" height="10" ${f(P.outline)} opacity=".85"/><path d="M24 46h22M24 53h22M24 60h22M24 67h16" stroke="${P.outline}" stroke-width="2.5" stroke-linecap="round" opacity=".5"/><rect x="54" y="44" width="22" height="24" ${f(P.sky)} ${O} stroke-width="2.5"/>`,
  box: `<path d="M18 38l32-14 32 14v40l-32 14-32-14z" ${f(P.card)} ${O}/><path d="M18 38l32 14 32-14M50 52v40" ${O} fill="none"/><path d="M34 31l32 14" stroke="${P.card2}" stroke-width="6"/><path d="M24 48v24" ${HI}/>`,
};

export const hasArt = (key?: string) => !!key && key in ART;
export const itemXml = (key: string) => `<svg viewBox="-6 -6 112 112">${ART[key]}</svg>`;

// ---------- Bin symbols, centred on (50, 1)
function loop(cx: number, cy: number, r: number, col: string, w: number) {
  const pt = (deg: number, rr: number) => {
    const t = (deg * Math.PI) / 180;
    return `${(cx + rr * Math.cos(t)).toFixed(2)} ${(cy + rr * Math.sin(t)).toFixed(2)}`;
  };
  const h = w * 1.2;
  let out = '';
  for (let k = 0; k < 3; k++) {
    const a0 = k * 120 - 84, a1 = a0 + 72;
    out += `<path d="M${pt(a0, r)}A${r} ${r} 0 0 1 ${pt(a1, r)}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
    out += `<path d="M${pt(a1 + 28, r)}L${pt(a1 - 1, r + h)}L${pt(a1 - 1, r - h)}Z" fill="${col}" stroke="${col}" stroke-width="${w * 0.35}" stroke-linejoin="round"/>`;
  }
  return out;
}
const W = P.white;
const GLYPH: Record<BinKey, string> = {
  recycling: loop(50, 1, 8.6, W, 3.2),
  compost: `<path d="M40 12C38-2 46-11 61-11c1 15-8 24-21 23z" fill="${W}"/><path d="M41.5 10.5Q50 3 57.5-7" fill="none" stroke="${CART.compost}" stroke-width="1.8" stroke-linecap="round"/><path d="M46 6l-.6-6M50.5 2l-.4-6.5M54.5-2.5l-.2-5M46 6l6.5.8M50.5 2l6.6.4" fill="none" stroke="${CART.compost}" stroke-width="1.3" stroke-linecap="round"/><path d="M40.5 11.5l-3.5 3.5" stroke="${W}" stroke-width="2.6" stroke-linecap="round"/>`,
  garbage: `<path d="M38-6h24" stroke="${W}" stroke-width="3" stroke-linecap="round"/><path d="M46-6.5v-3.5h8v3.5" fill="none" stroke="${W}" stroke-width="2.4" stroke-linejoin="round"/><path d="M40.5-2h19l-1.7 15.5a2 2 0 0 1-2 1.8H44.2a2 2 0 0 1-2-1.8z" fill="none" stroke="${W}" stroke-width="3" stroke-linejoin="round"/><path d="M46 2.5v8.5M50 2.5v8.5M54 2.5v8.5" stroke="${W}" stroke-width="2" stroke-linecap="round"/>`,
  special: `<path d="M50-11.5L62.5 10.5H37.5z" fill="${W}" stroke="${W}" stroke-width="3.5" stroke-linejoin="round"/><path d="M50-3.8v6.4" stroke="${CART.special}" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="6.4" r="1.8" fill="${CART.special}"/>`,
};

// ---------- Carts. viewBox 0 0 100 130; `top` is where the lid sits.
export const BIN_TOP: Record<BinKey, number> = { recycling: 20, compost: 46, garbage: 30, special: 38 };
const svg = (body: string) => `<svg viewBox="0 0 100 130">${body}</svg>`;
const wheels = (r: number, l = 22, rr = 78) =>
  `<circle cx="${l}" cy="116" r="${r}" fill="${P.outline}"/><circle cx="${l}" cy="116" r="${r * 0.38}" fill="${P.metal}"/><circle cx="${rr}" cy="116" r="${r}" fill="${P.outline}"/><circle cx="${rr}" cy="116" r="${r * 0.38}" fill="${P.metal}"/>`;
const span = (b: BinKey): [number, number] => (b === 'compost' ? [11, 89] : [7, 93]);

/** Behind the item: the dark opening and, on wheeled carts, the push handle. */
export function binBackXml(b: BinKey) {
  const top = BIN_TOP[b], [x1, x2] = span(b), c = CART[b];
  const handle = b === 'recycling' || b === 'garbage' ? `<rect x="20" y="${top - 6}" width="60" height="6" rx="3" fill="${c}" ${O}/>` : '';
  return svg(`${handle}<rect x="${x1 + 2}" y="${top + 3}" width="${x2 - x1 - 4}" height="10" rx="3" fill="${P.mouth}"/>`);
}

/** The lid alone; it flips up about its bottom edge (`lidOrigin`). */
export function binLidXml(b: BinKey) {
  const top = BIN_TOP[b], [x1, x2] = span(b), c = CART[b];
  const grip = b === 'compost' ? '' : `<rect x="40" y="${b === 'special' ? top - 4 : top + 8}" width="20" height="5" rx="2.5" fill="${c}" ${O} stroke-width="2.5"/>`;
  return svg(
    `<path d="M${x1} ${top + 10}V${top + 3}a3 3 0 0 1 3-3h${x2 - x1 - 6}a3 3 0 0 1 3 3v7z" fill="${c}" ${O}/>` +
      `<path d="M${x1 + 2} ${top + 7}H${x2 - 2}" stroke="${P.shade}" stroke-width="3"/>${grip}`,
  );
}
export const lidOrigin = (b: BinKey) => `50% ${((BIN_TOP[b] + 10) / 130) * 100}%`;

/** In front of the item: body, wheels, sticker or symbol. */
export function binFrontXml(b: BinKey) {
  const top = BIN_TOP[b], bodyTop = top + 10, c = CART[b];
  let s = `<ellipse cx="50" cy="124" rx="40" ry="5" fill="rgba(0,0,0,.14)"/>`;
  if (b === 'recycling' || b === 'garbage') {
    s += wheels(8) + `<path d="M11 ${bodyTop}H89L83 112H17z" fill="${c}" ${O}/>`;
    s += `<path d="M13 ${bodyTop + 2}H87" stroke="${P.rim}" stroke-width="3" stroke-linecap="round"/><path d="M15 ${bodyTop + 6}H85l-.6 5H15.6z" fill="${P.shade}"/>`;
    s += `<path d="M22 ${bodyTop + 16}L24 104M78 ${bodyTop + 16}L76 104" stroke="${P.shade}" stroke-width="3" stroke-linecap="round"/>`;
    if (b === 'recycling') {
      // materials sticker: coloured band with the loop, then paper, bottle, can
      const y = bodyTop + 12, x = 28, w = 44, hgt = 50;
      const thin = `stroke="${P.outline}" stroke-width="1.3" stroke-linejoin="round"`;
      s += `<rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="5" fill="${P.white}"/>`;
      s += `<path d="M${x} ${y + 24}V${y + 5}a5 5 0 0 1 5-5h${w - 10}a5 5 0 0 1 5 5v19z" fill="${c}"/>`;
      s += `<g transform="translate(0 ${y + 11.5})">${loop(50, 0, 7, P.white, 2.7)}</g>`;
      s += `<path d="M32 ${y + 29}h8l3 3v13H32z" fill="${P.paper}" ${thin}/><path d="M40 ${y + 29}v3h3" fill="none" ${thin}/>`;
      s += `<path d="M34.5 ${y + 35}h6M34.5 ${y + 38}h6M34.5 ${y + 41}h4" stroke="${P.outline}" stroke-width="1" stroke-linecap="round" opacity=".7"/>`;
      s += `<rect x="48.4" y="${y + 27.5}" width="3.2" height="2.6" rx=".6" fill="${c}" ${thin}/>`;
      s += `<path d="M47 ${y + 45}v-9.5q0-2.6 1.8-3.8V${y + 30}h2.4v1.7q1.8 1.2 1.8 3.8V${y + 45}z" fill="${P.sky}" ${thin}/>`;
      s += `<rect x="47" y="${y + 37.5}" width="6" height="3.2" fill="${P.white}" ${thin}/>`;
      s += `<rect x="58" y="${y + 31}" width="9.5" height="14" rx="1.6" fill="${P.metal}" ${thin}/>`;
      s += `<rect x="58" y="${y + 35}" width="9.5" height="5.5" fill="${c}" opacity=".85" ${thin}/>`;
      s += `<rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="5" fill="none" ${O} stroke-width="2.5"/>`;
    } else {
      s += `<g transform="translate(50 ${(bodyTop + 112) / 2}) scale(1.2) translate(-50 -1)">${GLYPH.garbage}</g>`;
    }
  } else if (b === 'compost') {
    s += wheels(5.5, 28, 72) + `<path d="M15 ${bodyTop}H85L81 112H19z" fill="${c}" ${O}/>`;
    s += `<path d="M17 ${bodyTop + 2}H83" stroke="${P.rim}" stroke-width="3" stroke-linecap="round"/>`;
    s += `<rect x="36" y="${bodyTop + 14}" width="28" height="26" rx="6" fill="${P.shade}"/>`;
    s += `<g transform="translate(50 ${bodyTop + 27}) scale(.95) translate(-50 -1)">${GLYPH.compost}</g>`;
  } else {
    s += `<rect x="14" y="110" width="72" height="8" rx="3" fill="${P.outline}"/><path d="M12 ${bodyTop}H88V112H12z" fill="${c}" ${O}/>`;
    s += `<path d="M12 ${bodyTop + 6}H88" stroke="${P.yellow}" stroke-width="5"/><path d="M12 ${bodyTop + 6}H88" stroke="${P.outline}" stroke-width="5" stroke-dasharray="6 6" opacity=".55"/>`;
    s += `<g transform="translate(50 ${(bodyTop + 112) / 2 + 4}) scale(1.2) translate(-50 -1)">${GLYPH.special}</g>`;
  }
  return svg(s);
}

/** The brown bin's locking handle, which wraps over the lid and flips back before it opens. */
export function latchXml() {
  const top = BIN_TOP.compost, bodyTop = top + 10;
  const d = `M16 ${bodyTop + 24}V${top + 4}q0-8 8-8h52q8 0 8 8V${bodyTop + 24}`;
  return svg(
    `<path d="${d}" fill="none" stroke="${P.outline}" stroke-width="7" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${CART.compost}" stroke-width="3.5" stroke-linejoin="round"/><rect x="40" y="${top - 7}" width="20" height="6" rx="3" fill="${P.outline}"/>`,
  );
}
export const latchOrigin = `50% ${((BIN_TOP.compost + 34) / 130) * 100}%`;

export const markXml = `<svg viewBox="0 0 46 46"><circle cx="23" cy="23" r="21" fill="${P.clay}"/><path d="M15 15l16 16M31 15L15 31" stroke="${P.white}" stroke-width="5" stroke-linecap="round"/></svg>`;
