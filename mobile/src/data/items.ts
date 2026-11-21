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
  /** Set only on items from a real scan (undefined on demo items), so only those get saved to the account. */
  ruleId?: string | null;
  category?: string | null;
  count?: number;
}

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
    ruleId: it.ruleId,
    category: it.category,
    count: it.count,
  };
}

/**
 * A demo item resolved by the rules engine, so its bin and text always match the backend rules.
 * ruleId etc. are cleared so demo items are never saved to an account.
 */
function demo(id: string, ruleId: string, name: string): SortItem {
  const it = rules.toScanItem({ id, name, rule: rules.getRule(ruleId), confidence: 'high', lang: 'en' });
  return { ...fromScanItem(it, 'demo'), id, ruleId: undefined, category: undefined, count: undefined };
}

/** Saved items on the Scan screen before the user has scanned anything (from the design). */
export const DEMO_SAVED: SortItem[] = [
  demo('d1', 'drink_bottle', 'Plastic bottle'),
  demo('d2', 'drink_can', 'Energy can'),
  demo('d3', 'chip_bag', 'Snack wrapper'),
  demo('d4', 'battery', 'Battery'),
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
