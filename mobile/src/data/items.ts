/**
 * App-side item model, the mapping from the server's ScanItem, and the demo content shown in the
 * Stitch designs (saved items, daily deck, leaderboards).
 */
import type { BinKey } from '../theme';
import { rules } from './rules';

export interface SortItem {
  id: string;
  name: string;
  /** Short line under the name ("Empty & cap on • Deposit eligible"). */
  detail: string;
  /** MaterialIcons glyph name. */
  icon: string;
  /** `null` = the rules engine couldn't decide: "Needs verification", not playable. */
  bin: BinKey | null;
  /** Why it goes in that bin, shown after answering in the game. */
  note: string;
  /** Rules-engine icon key (quebecRules.json `icon`), used for the game's clip-art. */
  art?: string;
  /** When it was scanned (ISO). Drives "today" vs earlier days in the game. */
  scannedAt?: string;
  /**
   * The rule behind the bin (null = no rule matched). Kept so the bin is re-worked out by the rules engine
   * whenever the player's area changes; never decide `bin` without it.
   */
  ruleId?: string | null;
  category?: string | null;
  count?: number;
  /** What the object physically is ("Canette en aluminium"), from the scan. */
  kind?: string;
  /** Built-in sample content: shown and played, never saved to an account. */
  demo?: boolean;
}

/** The player's area: which rule overrides apply (e.g. no brown bin -> food scraps go in the garbage). */
export interface Area { borough: string | null; hasBrownBin: boolean }

/** Language of rule and scan text (bins' explanations, drop-offs, tips). The app's own labels stay English. */
export type Lang = 'fr' | 'en';

/** Subset of server/src/types.ts ScanItem that the app reads. */
export interface ScanItemDTO {
  id: string;
  ruleId: string | null;
  category: string | null;
  name: string;
  kind: string;
  count: number;
  icon: string;
  correctBin: BinKey | null;
  dropoffName: string | null;
  explanation: string | null;
  specialInstruction: string | null;
  needsVerification: boolean;
}

export interface ScanResponseDTO {
  scanId: string;
  total: number;
  items: ScanItemDTO[];
  notWaste?: boolean;
  message?: string | null;
}

/** quebecRules.json → icons, mapped to MaterialIcons glyphs. */
const ICONS: Record<string, string> = {
  appliance: 'kitchen',
  battery: 'battery-charging-full',
  bottle: 'local-drink',
  box: 'inventory-2',
  broken_glass: 'wine-bar',
  bulb: 'lightbulb',
  can: 'sports-bar',
  car_battery: 'car-repair',
  carton: 'takeout-dining',
  coffee: 'local-cafe',
  cup: 'coffee',
  diaper: 'baby-changing-station',
  egg: 'egg',
  foam: 'takeout-dining',
  foil: 'layers',
  food: 'eco',
  fridge: 'kitchen',
  gas_tank: 'propane-tank',
  generic: 'help-outline',
  gift: 'card-giftcard',
  glass_jar: 'liquor',
  leaf: 'yard',
  lights: 'emoji-objects',
  oil: 'oil-barrel',
  paint: 'format-paint',
  paper: 'description',
  paw: 'pets',
  phone: 'smartphone',
  pills: 'medication',
  pizza_box: 'local-pizza',
  plastic_bag: 'shopping-bag',
  plastic_container: 'inventory',
  shirt: 'checkroom',
  smoke_detector: 'sensors',
  sofa: 'chair',
  spray: 'sanitizer',
  tire: 'tire-repair',
  tissue: 'clean-hands',
  toy: 'toys',
  tree: 'park',
  utensils: 'restaurant',
  wood: 'carpenter',
  wrapper: 'fastfood',
};

export function fromScanItem(it: ScanItemDTO, scanId: string): SortItem {
  const parts = [it.kind];
  if (it.dropoffName) parts.push(it.dropoffName);
  else if (it.specialInstruction) parts.push(it.specialInstruction);
  return {
    id: `${scanId}:${it.id}`,
    name: it.count > 1 ? `${it.name} ×${it.count}` : it.name,
    detail: it.needsVerification && it.correctBin === null ? 'Needs verification' : parts.join(' • '),
    icon: ICONS[it.icon] ?? 'help-outline',
    bin: it.correctBin,
    note: it.explanation ?? '',
    art: it.icon,
    ruleId: it.ruleId,
    category: it.category,
    count: it.count,
    kind: it.kind,
  };
}

/**
 * Re-work an item's bin and texts for the player's area and language with the rules engine. Items without
 * a rule ("Needs verification") are returned unchanged: there is nothing to decide.
 * Scanned names stay in the language they were scanned in; demo items take the rule's name in French.
 */
export function resolveItem(item: SortItem, area: Area, lang: Lang = 'en'): SortItem {
  const rule = typeof item.ruleId === 'string' ? rules.getRule(item.ruleId) : null;
  if (!rule) return item;
  const it = rules.toScanItem({ id: item.id, name: item.name, rule, confidence: 'high', lang, ctx: area });
  const tip = it.dropoffName ?? it.specialInstruction;
  return {
    ...item,
    name: item.demo && lang === 'fr' ? rule.name.fr : item.name,
    bin: it.correctBin, note: it.explanation ?? '', detail: [item.kind, tip].filter(Boolean).join(' • '),
  };
}

/** A game item from a rule id: demo content, and saved scans loaded back from the account. */
export function fromRule(id: string, ruleId: string | null, name: string, extra: Partial<SortItem> = {}): SortItem {
  const rule = ruleId ? rules.getRule(ruleId) : null;
  const art = rule?.icon ?? 'generic';
  const item: SortItem = {
    id, name, detail: rule ? '' : 'Needs verification', icon: ICONS[art] ?? 'help-outline', bin: null, note: '', art,
    ruleId: rule ? rule.id : null, category: rule?.category ?? null, ...extra,
  };
  return resolveItem(item, { borough: null, hasBrownBin: true });
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** A demo item: bin and text come from the rules engine (mobile/shared/, a copy of the server's). */
const demo = (id: string, ruleId: string, name: string, scannedAt?: string) => fromRule(id, ruleId, name, { scannedAt, demo: true });

/** Saved items on the Scan screen before the user has scanned anything (from the design). */
export const DEMO_SAVED: SortItem[] = [
  demo('d1', 'drink_bottle', 'Plastic bottle', daysAgo(1)),
  demo('d2', 'drink_can', 'Energy can', daysAgo(2)),
  demo('d3', 'chip_bag', 'Snack wrapper', daysAgo(3)),
  demo('d4', 'battery', 'Battery', daysAgo(5)),
];

/** Result shown by "See demo results" when the server can't be reached (Sorted breakdown design). */
export const DEMO_SCAN: SortItem[] = [
  demo('s1', 'drink_bottle', 'Plastic water bottle'),
  demo('s2', 'drink_can', 'Aluminum beverage can'),
  demo('s3', 'food_scraps', 'Banana peel'),
  demo('s4', 'chip_bag', 'Snack packaging'),
  demo('s5', 'battery', 'Household battery'),
];

/** "Daily" game deck (Play design). */
export const DAILY_DECK: SortItem[] = [
  demo('q1', 'drink_bottle', 'Plastic bottle'),
  demo('q2', 'battery', 'Battery'),
  demo('q3', 'chip_bag', 'Snack wrapper'),
  demo('q4', 'food_scraps', 'Banana peel'),
];

/** Challenge items the player may never have scanned; bin, explanation and tip come from the engine. */
const pool = (ruleId: string, name: string) => demo(`pool:${ruleId}`, ruleId, name);
export const CHALLENGE_POOL: SortItem[] = [
  pool('pizza_box_greasy', 'Greasy pizza box'),
  pool('coffee_cup', 'Coffee cup'),
  pool('aerosol', 'Aerosol can'),
  pool('eggshells', 'Eggshells'),
  pool('milk_carton', 'Milk carton'),
  pool('glass_jar', 'Glass jar'),
  pool('smoke_detector', 'Smoke detector'),
  pool('broken_glassware', 'Broken plate'),
  pool('plastic_bags', 'Plastic bag'),
  pool('bulb_regular', 'LED bulb'),
  pool('paint', 'Paint can'),
  pool('paper_towel', 'Paper towel'),
  pool('food_can', 'Food can'),
  pool('plastic_utensils', 'Plastic fork and straw'),
  pool('cardboard', 'Cardboard box'),
  pool('paper', 'Newspaper'),
];

export interface Ranked {
  name: string;
  initials: string;
  xp: number;
  you?: boolean;
}

export const CITY: Ranked[] = [
  { name: 'HochelagaHero', initials: 'HH', xp: 410 },
  { name: 'OutremontOak', initials: 'OO', xp: 365 },
  { name: 'MileEndLeaf', initials: 'ML', xp: 120 },
  { name: 'PlateauGreen', initials: 'PG', xp: 95 },
  { name: 'VerdunRecycle', initials: 'VR', xp: 50 },
];
