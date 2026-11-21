// Scoring (Waddah). Each playable item is worth an equal share of 100; shares always add up to 100.
import type { Bin, ScanItem, ScoreResponse } from "../types.js";

export function pointsPerItem(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(100 / n);
  // Hand the remainder to the first items so 3 items = 34 + 33 + 33, never 99.
  return Array.from({ length: n }, (_, i) => base + (i < 100 - base * n ? 1 : 0));
}

export function score(sessionId: string, items: ScanItem[], answers: { itemId: string; chosenBin: Bin }[]): ScoreResponse {
  const playable = items.filter(i => i.correctBin !== null);
  const shares = pointsPerItem(playable.length);
  const chosen = new Map(answers.map(a => [a.itemId, a.chosenBin]));
  const results = playable.map((item, i) => {
    const chosenBin = chosen.get(item.id) ?? null;
    const isCorrect = chosenBin === item.correctBin;
    return {
      itemId: item.id, name: item.name, chosenBin, correctBin: item.correctBin!, isCorrect,
      points: isCorrect ? shares[i] : 0,
      explanation: item.explanation, specialInstruction: item.specialInstruction,
    };
  });
  return {
    sessionId,
    score: results.reduce((s, r) => s + r.points, 0),
    correct: results.filter(r => r.isCorrect).length,
    total: playable.length,
    results,
    unplayable: items.filter(i => i.correctBin === null).map(i => i.id),
  };
}
