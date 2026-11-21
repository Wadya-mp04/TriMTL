/**
 * @file Scoring (owner: Waddah). Turns the player's answers into a score out of 100.
 * It never decides a bin: the right answer is the `correctBin` the rules engine put on each ScanItem,
 * already resolved for the user's borough and brown bin.
 */
import type { Bin, ScanItem, ScoreResponse } from "../types.js";

/**
 * Split 100 points across n items so the shares always add up to exactly 100.
 * The remainder goes to the first items (3 items = 34 + 33 + 33), so a perfect game is never 99.
 */
export function pointsPerItem(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(100 / n);
  return Array.from({ length: n }, (_, i) => base + (i < 100 - base * n ? 1 : 0));
}

/**
 * Score one game. Unplayable items (`correctBin: null`) are left out and listed in `unplayable`;
 * unanswered playable items count as wrong.
 * @param sessionId Echoed back in the response.
 * @param items The session's items, as resolved by the rules engine.
 * @param answers The bin the player chose for each item.
 */
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
