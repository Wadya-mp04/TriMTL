/**
 * @file Rules, lookup and scoring tests (owner: Waddah). Pins the Montréal-specific answers the game must
 * get right (deposit cans, 2025 packaging rule) and the scoring maths. Never calls Gemini.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findRule, getRule, RULES, toScanItem } from "../services/sortingRules.js";
import { pointsPerItem, score } from "../services/scoring.js";
import { Detected, totalOf } from "../services/gemini.js";

// Sources must be official: the city or Recyc-Québec.
// Consignaction runs Québec's official deposit-return system.
const OFFICIAL = ["https://montreal.ca/", "https://www.recyc-quebec.gouv.qc.ca/", "https://consignaction.ca/"];

test("rules file loads and every item has a bin, icon and an official source", () => {
  assert.ok(RULES.length >= 40);
  for (const r of RULES) {
    assert.ok(r.bin && r.icon && OFFICIAL.some(h => r.sourceUrl.startsWith(h)), `${r.id}: ${r.sourceUrl}`);
  }
});

test("typed names find the right rule", () => {
  const cases: [string, string][] = [
    ["canette", "drink_can"], ["bouteille d'eau", "drink_bottle"], ["piles", "battery"],
    ["grille-pain", "small_appliance"], ["sac de chips", "chip_bag"], ["gobelet de café", "coffee_cup"],
    ["boîte de pizza grasse", "pizza_box_greasy"], ["frigo", "fridge"], ["médicaments", "medication"],
  ];
  for (const [q, id] of cases) assert.equal(findRule(q)?.id, id, q);
  assert.equal(findRule("xyzzy"), null);
});

test("Montréal-specific answers the game must get right", () => {
  assert.equal(getRule("drink_can")?.bin, "recycling");    // since v7: recyclable, deposit is a bonus
  assert.equal(getRule("drink_can")?.dropoff, null);
  assert.equal(getRule("coffee_cup")?.bin, "recycling");   // all paper containers since 2025
  assert.equal(getRule("chip_bag")?.bin, "recycling");     // all packaging since 2025
  assert.equal(getRule("battery")?.bin, "special");
  assert.equal(getRule("pizza_box_greasy")?.bin, "compost");
});

test("no matching rule => not playable, needs verification", () => {
  const item = toScanItem({ id: "item-1", name: "mystery", rule: null, confidence: "high", lang: "fr" });
  assert.equal(item.correctBin, null);
  assert.equal(item.needsVerification, true);
  assert.equal(item.icon, "generic");
});

test("low confidence or unverified rule => user confirms first", () => {
  assert.equal(toScanItem({ id: "a", name: "x", rule: getRule("battery"), confidence: "low", lang: "fr" }).needsVerification, true);
  assert.equal(toScanItem({ id: "b", name: "x", rule: getRule("battery"), confidence: "high", lang: "fr" }).needsVerification, false);
  // Every rule is verified since v4, so use an unverified copy to keep the policy under test.
  const unverified = { ...getRule("battery")!, verified: false };
  assert.equal(toScanItem({ id: "c", name: "x", rule: unverified, confidence: "high", lang: "fr" }).needsVerification, true);
});

test("total count: exact under 20, estimate at 20+", () => {
  const items = [{ count: 3 }, { count: 1 }] as Parameters<typeof totalOf>[0];
  assert.deepEqual(totalOf(items, 4, false), { total: 4, isEstimate: false });
  assert.deepEqual(totalOf(items, 0, false), { total: 4, isEstimate: false });   // model forgot the total
  assert.deepEqual(totalOf(items, 25, true), { total: 25, isEstimate: true });   // saw more than it listed
  assert.deepEqual(totalOf([{ count: 21 }] as Parameters<typeof totalOf>[0], 21, false), { total: 21, isEstimate: true });
});

test("points always add up to 100", () => {
  for (let n = 1; n <= 12; n++) assert.equal(pointsPerItem(n).reduce((a, b) => a + b, 0), 100, `n=${n}`);
  assert.deepEqual(pointsPerItem(3), [34, 33, 33]);
});

test("score: correct, wrong, missing and unplayable items", () => {
  const items = [
    toScanItem({ id: "item-1", name: "can", rule: getRule("drink_can"), confidence: "high", lang: "en" }),
    toScanItem({ id: "item-2", name: "peel", rule: getRule("food_scraps"), confidence: "high", lang: "en" }),
    toScanItem({ id: "item-3", name: "box", rule: getRule("cardboard"), confidence: "high", lang: "en" }),
    toScanItem({ id: "item-4", name: "??", rule: null, confidence: "low", lang: "en" }),
  ];
  const r = score("s", items, [{ itemId: "item-1", chosenBin: "recycling" }, { itemId: "item-2", chosenBin: "garbage" }]);
  assert.equal(r.total, 3);
  assert.equal(r.correct, 1);
  assert.equal(r.score, 34);
  assert.deepEqual(r.unplayable, ["item-4"]);
  assert.equal(r.results[2].chosenBin, null); // unanswered counts as wrong

  // The results screen reads /api/score, so the drop-off's note must reach it too.
  const battery = toScanItem({ id: "item-1", name: "AA", rule: getRule("battery"), confidence: "high", lang: "en" });
  assert.match(score("s", [battery], []).results[0].dropoffNote ?? "", /photo ID/);
});

test("a long item name or too many items is trimmed, never a failed scan", () => {
  const item = { name: "x".repeat(200), kind: "", category: null, ruleId: "none", count: 1, confidence: 1 };
  const parsed = Detected.parse({ totalObjects: 1, isEstimate: false, subject: "", notWaste: false, items: Array(100).fill(item) });
  assert.equal(parsed.items[0].name.length, 80);
  assert.ok(parsed.items.length < 100);
});
