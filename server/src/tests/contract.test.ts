/**
 * @file Contract and invariant tests (owner: Waddah). Proves the architecture rules hold: Gemini's schema
 * can only pick a ruleId/category from our lists, the engine resolves every rule in every borough,
 * attribute overrides work, and the real scan route returns a valid ScanResponse.
 * These tests never call Gemini and never need GEMINI_API_KEY: `identifyItems` is replaced by a fake.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import express from "express";
import { AiError, SCHEMA, type Detection } from "../services/gemini.js";
import { createScanRouter } from "../routes/scan.js";
import { BOROUGHS, findRule, getRule, RULE_IDS, RULES, RULES_VERSION, toScanItem } from "../services/sortingRules.js";
import { createRulesEngine } from "../services/rulesEngine.js";
import { ScanResponseSchema } from "../schemas.js";
import { BINS, CATEGORIES } from "../types.js";
import type { Lang } from "../types.js";

const rule = (id: string) => {
  const r = getRule(id);
  assert.ok(r, `rule "${id}" exists`);
  return r;
};
const item = (id: string, ctx: { borough?: string | null; hasBrownBin?: boolean } = {}, aiCategory?: string, lang: Lang = "en") =>
  toScanItem({ id: "item-1", name: "x", rule: rule(id), confidence: "high", lang, ctx, aiCategory });

// ---------- Rules data ----------

// Overrides added on purpose before anyone checked them on montreal.ca: they show "Needs verification".
// Remove an entry once it is verified (and set "verified": true in quebecRules.json).
const KNOWN_UNVERIFIED = new Set(['yard_waste {"hasBrownBin":false,"organics":"combined"}']);

test("rules file has 19 boroughs, 5 of them combined organics, every rule and override verified", () => {
  for (const r of RULES) {
    assert.equal(r.verified, true, r.id);
    for (const o of r.overrides) {
      const key = `${r.id} ${JSON.stringify(o.when)}`;
      assert.equal(o.verified, !KNOWN_UNVERIFIED.has(key), key);
    }
  }
  assert.equal(BOROUGHS.length, 19);
  assert.deepEqual(
    BOROUGHS.filter(b => b.organics === "combined").map(b => b.slug).sort(),
    ["ile-bizard-sainte-genevieve", "lachine", "pierrefonds-roxboro", "plateau-mont-royal", "saint-laurent"],
  );
});

test("every rule resolves in fr and en, with no context and in every borough, with and without a brown bin", () => {
  const contexts = [undefined, null, ...BOROUGHS.map(b => b.slug)];
  for (const r of RULES) for (const lang of ["fr", "en"] as const) for (const borough of contexts) for (const hasBrownBin of [true, false, undefined]) {
    const it = toScanItem({ id: "i", name: "x", rule: r, confidence: "high", lang, ctx: { borough, hasBrownBin } });
    const where = `${r.id} ${lang} ${borough} brownBin=${hasBrownBin}`;
    assert.ok(it.correctBin && BINS.includes(it.correctBin), where);
    assert.ok(it.explanation && it.explanation.length > 0, where);
    assert.equal(it.category, r.category, where);
    assert.ok(it.dropoff === null || it.correctBin === "special", `${where}: dropoff only on special`);
    assert.equal(it.dropoffName === null, it.dropoff === null, `${where}: dropoffName iff dropoff`);
  }
});

test("integrity check rejects an override that would inherit a dropoff onto a non-special bin", () => {
  const raw = JSON.parse(readFileSync(new URL("../data/quebecRules.json", import.meta.url), "utf8"));
  const yard = raw.items.find((i: { id: string }) => i.id === "yard_waste");
  delete yard.overrides.find((o: { bin: string }) => o.bin === "compost").dropoff; // compost + inherited yard_collection
  assert.throws(() => createRulesEngine(raw), /yard_waste.*dropoff/);
});

// ---------- Borough and brown-bin overrides (attribute-based) ----------

test("yard_waste: combined-organics borough -> compost; food_only borough -> special yard_collection; null -> default", () => {
  const plateau = item("yard_waste", { borough: "plateau-mont-royal" });
  assert.equal(plateau.correctBin, "compost");
  assert.equal(plateau.dropoff, null);
  assert.equal(plateau.contextApplied, true);

  const verdun = item("yard_waste", { borough: "verdun" });
  assert.equal(verdun.correctBin, "special");
  assert.equal(verdun.dropoff, "yard_collection");
  assert.equal(verdun.contextApplied, false);

  const none = item("yard_waste", { borough: null });
  assert.equal(none.correctBin, "special");
  assert.equal(none.dropoff, "yard_collection");
  // An unknown slug (e.g. an independent municipality) also falls back to the city-wide default.
  assert.equal(item("yard_waste", { borough: "westmount" }).correctBin, "special");
});

test("yard_waste without a brown bin in a combined-organics borough -> écocentre (unverified); elsewhere unchanged", () => {
  const plateauNoBin = item("yard_waste", { borough: "plateau-mont-royal", hasBrownBin: false });
  assert.equal(plateauNoBin.correctBin, "special");
  assert.equal(plateauNoBin.dropoff, "ecocentre");
  assert.equal(plateauNoBin.contextApplied, true);
  assert.equal(plateauNoBin.needsVerification, true);
  assert.equal(item("yard_waste", { borough: "plateau-mont-royal", hasBrownBin: true }).correctBin, "compost");
  const verdunNoBin = item("yard_waste", { borough: "verdun", hasBrownBin: false }); // own yard collection anyway
  assert.equal(verdunNoBin.correctBin, "special");
  assert.equal(verdunNoBin.dropoff, "yard_collection");
  assert.equal(verdunNoBin.contextApplied, false);
});

test("food_scraps without a brown bin -> garbage, context applied, verified since v4", () => {
  const it = item("food_scraps", { hasBrownBin: false });
  assert.equal(it.correctBin, "garbage");
  assert.equal(it.contextApplied, true);
  assert.equal(it.needsVerification, false);
  // Default context: hasBrownBin defaults to true.
  assert.equal(item("food_scraps").correctBin, "compost");
  assert.equal(item("food_scraps").needsVerification, false);
});

test("compostable_plastic -> garbage in every context, no override", () => {
  for (const borough of [null, ...BOROUGHS.map(b => b.slug)]) for (const hasBrownBin of [true, false]) {
    const it = item("compostable_plastic", { borough, hasBrownBin });
    assert.equal(it.correctBin, "garbage", `${borough} ${hasBrownBin}`);
    assert.equal(it.contextApplied, false, `${borough} ${hasBrownBin}`);
  }
});

test("dropoffNote: shown when it adds something, null when it would repeat specialInstruction", () => {
  const verdun = item("yard_waste", { borough: "verdun" });
  assert.match(verdun.dropoffNote ?? "", /Seasonal collection, spring to fall/);
  assert.notEqual(verdun.dropoffNote, verdun.specialInstruction);
  assert.match(verdun.specialInstruction ?? "", /longer than 1 m or thicker than 5 cm/);

  const plateau = item("yard_waste", { borough: "plateau-mont-royal" });
  assert.equal(plateau.correctBin, "compost");
  assert.equal(plateau.dropoffNote, null);

  // vape has no instruction of its own, so the écocentre note fills specialInstruction: no duplicate.
  const vape = item("vape");
  assert.match(vape.specialInstruction ?? "", /photo ID/);
  assert.equal(vape.dropoffNote, null);

  // battery has its own instruction (tape the terminals), so the écocentre note gets its own field.
  const battery = item("battery");
  assert.match(battery.dropoffNote ?? "", /photo ID/);
  assert.notEqual(battery.dropoffNote, battery.specialInstruction);

  // No dropoff, no note.
  assert.equal(item("cardboard").dropoffNote, null);
});

test("paper_towel -> compost by default, garbage without a brown bin", () => {
  const def = item("paper_towel");
  assert.equal(def.correctBin, "compost");
  assert.equal(def.contextApplied, false);
  const noBin = item("paper_towel", { hasBrownBin: false });
  assert.equal(noBin.correctBin, "garbage");
  assert.equal(noBin.contextApplied, true);
});

test("pizza_box_greasy without a brown bin -> recycling", () => {
  const it = item("pizza_box_greasy", { hasBrownBin: false });
  assert.equal(it.correctBin, "recycling");
  assert.equal(it.contextApplied, true);
});

test("Gemini category that disagrees with the rule's category -> needs verification", () => {
  assert.equal(item("food_scraps", {}, "plastic").needsVerification, true);
  assert.equal(item("food_scraps", {}, "food").needsVerification, false);
  // The category never changes the bin.
  assert.equal(item("food_scraps", {}, "plastic").correctBin, "compost");
});

// ---------- Typed names (findRule) ----------

test("typed names: matelas -> upholstered_furniture (écocentre), canettes -> drink_can", () => {
  const matelas = findRule("matelas");
  assert.equal(matelas?.id, "upholstered_furniture");
  assert.equal(matelas?.bin, "special");
  assert.equal(matelas?.dropoff, "ecocentre");
  assert.equal(findRule("canettes")?.id, "drink_can");
});

// ---------- Gemini schema ----------

test("Gemini SCHEMA: ruleId enum = RULE_IDS + none, category enum = CATEGORIES, category before ruleId, no bin field", () => {
  const props = SCHEMA.properties.items.items.properties as Record<string, { enum?: string[] }>;
  assert.deepEqual(props.ruleId.enum, [...RULE_IDS, "none"]);
  assert.deepEqual(props.category.enum, [...CATEGORIES]);
  const keys = Object.keys(props);
  assert.ok(keys.indexOf("category") < keys.indexOf("ruleId"), `order: ${keys.join(", ")}`);
  assert.ok(SCHEMA.properties.items.items.required.includes("category"));
  for (const k of keys) assert.doesNotMatch(k, /bin|dropoff|explanation|instruction/i, `model must not fill "${k}"`);
});

// ---------- Contract ----------

test("scanResponse.example.json validates against the ScanResponse schema and matches the engine", () => {
  const example = JSON.parse(readFileSync(new URL("./fixtures/scanResponse.example.json", import.meta.url), "utf8"));
  ScanResponseSchema.parse(example);
  // The example's answers are what the engine actually produces in that context.
  for (const ex of example.items) {
    const it = toScanItem({ id: ex.id, name: ex.name, kind: ex.kind, count: ex.count, rule: getRule(ex.ruleId),
      confidence: ex.confidence, lang: example.context.lang, ctx: example.context });
    assert.deepEqual(it, ex, ex.ruleId);
  }
});

// ---------- The real scan route, with Gemini mocked ----------

async function withScanServer(fake: () => Promise<Detection>, run: (url: string) => Promise<void>) {
  const app = express().use(express.json({ limit: "10mb" })).use(createScanRouter(fake));
  const server = app.listen(0);
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/scan`);
  } finally {
    server.close();
  }
}
const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const image = "A".repeat(200);

test("scan route: returns a valid ScanResponse and passes aiCategory + context to the engine", async () => {
  const fake = async (): Promise<Detection> => ({
    total: 4, isEstimate: false, subject: "kitchen waste", notWaste: false,
    items: [
      { name: "Banana peel", kind: "Food", category: "food", ruleId: "food_scraps", count: 1, confidence: 0.95, closedBag: false },
      { name: "Leaves", kind: "Leaves", category: "yard", ruleId: "yard_waste", count: 1, confidence: 0.9, closedBag: false },
      { name: "Odd thing", kind: "Plastic", category: "plastic", ruleId: "food_scraps", count: 1, confidence: 0.9, closedBag: false },
      { name: "Mystery", kind: "?", category: "plastic", ruleId: "none", count: 1, confidence: 0.9, closedBag: false },
    ],
  });
  await withScanServer(fake, async url => {
    const res = await post(url, { imageBase64: image, mimeType: "image/jpeg", lang: "en", borough: "plateau-mont-royal", hasBrownBin: false });
    assert.equal(res.status, 200);
    const body = ScanResponseSchema.parse(await res.json());
    assert.equal(body.rulesVersion, RULES_VERSION);   // from the JSON, not hard-coded
    assert.deepEqual(body.context, { lang: "en", borough: "plateau-mont-royal", hasBrownBin: false });
    assert.equal(body.total, 4);
    assert.equal(body.sessionId, body.scanId);        // legacy fields still sent
    assert.equal(body.totalCount, body.total);
    assert.equal(body.countIsEstimate, body.isEstimate);
    assert.equal(body.subject, "kitchen waste");
    assert.equal(body.notWaste, false);
    assert.equal(body.message, null);                  // items present -> no empty-state message
    const [food, yard, mismatch, none] = body.items;
    assert.equal(food.correctBin, "garbage");         // ctx.hasBrownBin reached the engine
    assert.equal(food.contextApplied, true);
    assert.equal(yard.dropoff, "ecocentre");          // ctx.borough + hasBrownBin reached the engine (Plateau, no brown bin)
    assert.equal(mismatch.needsVerification, true);   // aiCategory reached the engine
    assert.equal(none.ruleId, null);                  // "none" -> no rule, no bin
    assert.equal(none.correctBin, null);
    assert.equal(none.category, "plastic");           // Gemini's category kept for display
  });
});

test("scan route: defaults to borough null and hasBrownBin true", async () => {
  await withScanServer(async () => ({ total: 0, isEstimate: false, subject: "une table", notWaste: false, items: [] }), async url => {
    const body = ScanResponseSchema.parse(await (await post(url, { imageBase64: image })).json());
    assert.deepEqual(body.context, { lang: "fr", borough: null, hasBrownBin: true });
    assert.deepEqual(body.items, []);
    assert.match(body.message ?? "", /Aucun objet/);   // empty, not "not waste"
  });
});

test("scan route: a non-waste photo returns notWaste and a message in the requested language", async () => {
  await withScanServer(async () => ({ total: 0, isEstimate: false, subject: "a cat", notWaste: true, items: [] }), async url => {
    const body = ScanResponseSchema.parse(await (await post(url, { imageBase64: image, lang: "en" })).json());
    assert.equal(body.notWaste, true);
    assert.match(body.message ?? "", /not something to sort \(a cat\)/);
  });
});

test("scan route: 400 with a clear message on bad input", async () => {
  await withScanServer(async () => assert.fail("Gemini must not be called on bad input"), async url => {
    const cases: [unknown, RegExp][] = [
      [{}, /imageBase64/],
      [{ imageBase64: "short" }, /imageBase64/],
      [{ imageBase64: image, lang: "de" }, /lang/],
      [{ imageBase64: image, borough: "plateau" }, /borough/],
      [{ imageBase64: image, hasBrownBin: "yes" }, /hasBrownBin/],
      [{ imageBase64: "A".repeat(10_000_001) }, /too large/],
    ];
    for (const [body, msg] of cases) {
      const res = await post(url, body);
      assert.equal(res.status, 400, JSON.stringify(body).slice(0, 60));
      const json = await res.json();
      assert.equal(json.error, "bad_request");
      assert.match(json.message, msg);
    }
  });
});

test("scan route: AiError codes map to HTTP statuses", async () => {
  const expected = { rate_limited: 429, timeout: 504, ai_failed: 502, no_key: 500 } as const;
  for (const [code, status] of Object.entries(expected) as [keyof typeof expected, number][]) {
    await withScanServer(async () => { throw new AiError(code, `fake ${code}`); }, async url => {
      const res = await post(url, { imageBase64: image });
      assert.equal(res.status, status, code);
      assert.deepEqual(await res.json(), { error: code, message: `fake ${code}` });
    });
  }
});
