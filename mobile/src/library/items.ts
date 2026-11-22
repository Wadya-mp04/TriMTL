import type { SortItem } from '../data/items';

export type LibraryBin = NonNullable<SortItem['bin']> | 'unsure';

const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Match all words, ignoring accents, across names and disposal guidance. Preserve newest-first order. */
export function groupLibraryItems<T extends Pick<SortItem, 'name' | 'detail' | 'note' | 'bin'> & { origName?: string }>(items: T[], query: string) {
  const words = fold(query).trim().split(/\s+/).filter(Boolean);
  const groups: Record<LibraryBin, T[]> = { recycling: [], compost: [], garbage: [], special: [], unsure: [] };
  for (const item of items) {
    const text = fold(`${item.name} ${item.origName ?? ''} ${item.detail} ${item.note}`);
    if (words.every((word) => text.includes(word))) groups[item.bin ?? 'unsure'].push(item);
  }
  return groups;
}
