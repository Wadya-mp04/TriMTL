/**
 * App-side item model, the mapping from the server's ScanItem, and the demo content shown in the
 * Stitch designs (saved items, daily deck, leaderboards).
 */
import type { BinKey } from '../theme';

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
}

/** Subset of server/src/types.ts ScanItem that the app reads. */
export interface ScanItemDTO {
  id: string;
  name: string;
  kind: string;
  count: number;
  icon: string;
  correctBin: BinKey | null;
  dropoffName: string | null;
  explanation: string;
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
    note: it.explanation,
    art: it.icon,
  };
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

// Demo content. Bins and wording follow server/src/data/quebecRules.json, so the game never
// teaches an answer the rules engine would contradict (drink containers are deposit returns,
// which the app files under Special).

/** Saved items on the Scan screen before the user has scanned anything (from the design). */
export const DEMO_SAVED: SortItem[] = [
  { id: 'd1', name: 'Plastic bottle', detail: 'Deposit return', icon: 'local-drink', bin: 'special', note: 'Drink containers from 100 ml to 2 L go back for the deposit.', art: 'bottle', scannedAt: daysAgo(1) },
  { id: 'd2', name: 'Energy can', detail: 'Deposit return', icon: 'sports-bar', bin: 'special', note: 'Aluminium drink cans go back for the deposit.', art: 'can', scannedAt: daysAgo(2) },
  { id: 'd3', name: 'Snack wrapper', detail: 'All packaging is recyclable', icon: 'fastfood', bin: 'recycling', note: 'All packaging now goes in the recycling.', art: 'wrapper', scannedAt: daysAgo(3) },
  { id: 'd4', name: 'Battery', detail: 'Écocentre or retail battery bin', icon: 'battery-charging-full', bin: 'special', note: 'Batteries never go in the garbage or the recycling.', art: 'battery', scannedAt: daysAgo(5) },
];

/** Result shown by "See demo results" when the server can't be reached (Sorted breakdown design). */
export const DEMO_SCAN: SortItem[] = [
  { id: 's1', name: 'Plastic water bottle', detail: 'Deposit return', icon: 'local-drink', bin: 'special', note: 'Drink containers from 100 ml to 2 L go back for the deposit.', art: 'bottle' },
  { id: 's2', name: 'Aluminum beverage can', detail: 'Deposit return', icon: 'sports-bar', bin: 'special', note: 'Aluminium drink cans go back for the deposit.', art: 'can' },
  { id: 's3', name: 'Banana peel', detail: 'Montréal brown bin', icon: 'eco', bin: 'compost', note: 'Anything edible goes in the brown bin, raw, cooked or spoiled, bones included.', art: 'food' },
  { id: 's4', name: 'Snack packaging', detail: 'All packaging is recyclable', icon: 'fastfood', bin: 'recycling', note: 'All packaging now goes in the recycling.', art: 'wrapper' },
  { id: 's5', name: 'Household battery', detail: 'Écocentre or retail battery bin', icon: 'battery-charging-full', bin: 'special', note: 'Batteries never go in the garbage or the recycling.', art: 'battery' },
];

/** "Daily" game deck (Play design). */
export const DAILY_DECK: SortItem[] = [
  { id: 'q1', name: 'Plastic bottle', detail: '', icon: 'local-drink', bin: 'special', note: 'Drink containers from 100 ml to 2 L go back for the deposit.', art: 'bottle' },
  { id: 'q2', name: 'Battery', detail: '', icon: 'battery-charging-full', bin: 'special', note: 'Batteries never go in the garbage or the recycling.', art: 'battery' },
  { id: 'q3', name: 'Snack wrapper', detail: '', icon: 'fastfood', bin: 'recycling', note: 'All packaging now goes in the recycling.', art: 'wrapper' },
  { id: 'q4', name: 'Banana peel', detail: '', icon: 'compost', bin: 'compost', note: 'Anything edible goes in the brown bin, raw, cooked or spoiled, bones included.', art: 'food' },
];

/** Challenge items the player may never have scanned. Copied from quebecRules.json (id, bin,
 *  explanation, specialInstruction) so answers match the rules engine. */
const pool = (id: string, name: string, art: string, bin: BinKey, note: string, detail = ''): SortItem =>
  ({ id: `pool:${id}`, name, detail, icon: ICONS[art] ?? 'help-outline', bin, note, art });
export const CHALLENGE_POOL: SortItem[] = [
  pool('pizza_box_greasy', 'Greasy pizza box', 'pizza_box', 'compost', 'Cardboard soaked with grease or sauce goes in the brown bin.'),
  pool('coffee_cup', 'Coffee cup', 'cup', 'recycling', 'Paper containers go in the recycling, even if soiled.', 'Empty it. The lid goes in the bin too.'),
  pool('aerosol', 'Aerosol can', 'spray', 'special', 'Pressurized containers are refused in the recycling.', 'Écocentre'),
  pool('eggshells', 'Eggshells', 'egg', 'compost', 'Eggs and their shells go in the brown bin.'),
  pool('milk_carton', 'Milk carton', 'carton', 'recycling', 'Multi-layer cartons go in the recycling.', 'Empty and rinse.'),
  pool('glass_jar', 'Glass jar', 'glass_jar', 'recycling', 'Glass containers go in the recycling.', 'Empty and rinse. Unscrew metal lids and put them in the bin separately.'),
  pool('smoke_detector', 'Smoke detector', 'smoke_detector', 'garbage', 'The City says smoke detectors go in the garbage.', 'Take the battery out first.'),
  pool('broken_glassware', 'Broken plate', 'broken_glass', 'garbage', "Dishes, drinking glasses and mirrors don't go in the recycling.", 'Wrap sharp pieces before throwing them out.'),
  pool('plastic_bags', 'Plastic bag', 'plastic_bag', 'recycling', 'Plastic bags and wrapping film go in the recycling.', 'Except garbage bags, which are not recyclable.'),
  pool('bulb_regular', 'LED bulb', 'bulb', 'garbage', 'These bulbs are accepted in the garbage.', 'Ideally, bring them to an écocentre so they get recycled.'),
  pool('paint', 'Paint can', 'paint', 'special', 'These are household hazardous waste.', 'Écocentre'),
  pool('paper_towel', 'Paper towel', 'tissue', 'compost', 'Soiled paper goes in the brown bin, never in the recycling.'),
  pool('food_can', 'Food can', 'can', 'recycling', 'Metal containers are recyclable.', 'Empty and rinse.'),
  pool('plastic_utensils', 'Plastic fork and straw', 'utensils', 'garbage', 'Plastic cutlery and straws go in the garbage.'),
  pool('cardboard', 'Cardboard box', 'box', 'recycling', 'Cardboard is recyclable.', 'Break boxes down and flatten them.'),
  pool('paper', 'Newspaper', 'paper', 'recycling', 'Printed paper is recyclable, even window envelopes and stapled sheets.'),
];

export interface Ranked {
  name: string;
  initials: string;
  xp: number;
  you?: boolean;
}

export const FRIENDS: Ranked[] = [
  { name: 'MileEndLeaf', initials: 'ML', xp: 120 },
  { name: 'PlateauGreen', initials: 'PG', xp: 95 },
  { name: 'VerdunRecycle', initials: 'VR', xp: 50 },
  { name: 'RosemontBin', initials: 'RB', xp: 30 },
];

export const CITY: Ranked[] = [
  { name: 'HochelagaHero', initials: 'HH', xp: 410 },
  { name: 'OutremontOak', initials: 'OO', xp: 365 },
  { name: 'MileEndLeaf', initials: 'ML', xp: 120 },
  { name: 'PlateauGreen', initials: 'PG', xp: 95 },
  { name: 'VerdunRecycle', initials: 'VR', xp: 50 },
];
