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
  };
}

/** Saved items on the Scan screen before the user has scanned anything (from the design). */
export const DEMO_SAVED: SortItem[] = [
  { id: 'd1', name: 'Plastic bottle', detail: 'Empty & cap on', icon: 'local-drink', bin: 'recycling', note: 'Empty and rinse; deposit eligibility may apply.' },
  { id: 'd2', name: 'Energy can', detail: 'Rinse lightly before bin', icon: 'sports-bar', bin: 'recycling', note: 'Drink cans are accepted; deposit eligibility may apply.' },
  { id: 'd3', name: 'Snack wrapper', detail: 'Multi-layer foil/plastic wrapper', icon: 'fastfood', bin: 'garbage', note: 'Multi-layer foil wrappers go in household garbage.' },
  { id: 'd4', name: 'Battery', detail: 'Écocentre or retail battery bin', icon: 'battery-charging-full', bin: 'special', note: 'Batteries go to a dedicated collection point or Écocentre.' },
];

/** Result shown by "See demo results" when the server can't be reached (Sorted breakdown design). */
export const DEMO_SCAN: SortItem[] = [
  { id: 's1', name: 'Plastic water bottle', detail: 'Empty & cap on • Deposit eligible', icon: 'local-drink', bin: 'recycling', note: 'Empty and rinse; deposit eligibility may apply.' },
  { id: 's2', name: 'Aluminum beverage can', detail: 'Rinse lightly before bin', icon: 'sports-bar', bin: 'recycling', note: 'Rinse lightly; deposit eligibility may apply.' },
  { id: 's3', name: 'Banana peel', detail: 'Montréal brown compost bin', icon: 'eco', bin: 'compost', note: 'Fruit scraps belong in the Montréal brown compost bin.' },
  { id: 's4', name: 'Snack packaging', detail: 'Multi-layer foil/plastic wrapper', icon: 'fastfood', bin: 'garbage', note: 'Multi-layer foil wrappers go in household garbage.' },
  { id: 's5', name: 'Household battery', detail: 'Écocentre or retail battery bin', icon: 'battery-charging-full', bin: 'special', note: 'Batteries go to a dedicated collection point or Écocentre.' },
];

/** "Daily" game deck (Play design). */
export const DAILY_DECK: SortItem[] = [
  { id: 'q1', name: 'Plastic bottle', detail: '', icon: 'local-drink', bin: 'recycling', note: 'Empty and rinse; deposit eligibility may apply.' },
  { id: 'q2', name: 'Battery', detail: '', icon: 'battery-charging-full', bin: 'special', note: 'Batteries go to a dedicated collection point or Écocentre.' },
  { id: 'q3', name: 'Snack wrapper', detail: '', icon: 'fastfood', bin: 'garbage', note: 'Multi-layer foil wrappers go in household garbage.' },
  { id: 'q4', name: 'Banana peel', detail: '', icon: 'compost', bin: 'compost', note: 'Fruit scraps belong in the Montréal brown compost bin.' },
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
