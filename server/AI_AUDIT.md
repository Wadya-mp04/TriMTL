# AI audit: recognition, counting, non-waste photos

Run on 21 Nov 2026 against this server (`POST /api/scan`, model `gemini-3.1-flash-lite`, photos resized to
1280 px JPEG like the app sends). 19 photos, 23 runs. The answer key was written by looking at each photo
before running it.

## Summary

| Area | Result |
|---|---|
| Non-waste photos (cat, person, city skyline, graffiti picture of a spray can) | **4 / 4** correctly refused, with a message |
| Single items (jar, coffee cup, banana peel, bulb, CFL, cardboard box, newspapers, foam tray, batteries) | **9 / 9** right item and right bin |
| Counting, items spread out (10 batteries) | **10 / 10**, same on both runs |
| Counting, items partly hidden (table photos) | Undercounts: **9 / 10** and **6 / 9** objects |
| Big piles (bales of cans) | Estimate works ("about 150"), but bottles mixed into the cans were missed |
| Speed | 1.2–3.5 s per photo |
| Repeatability | Same photo = same answer on every repeat run |

## Every photo

| Photo | Expected | Got | Verdict |
|---|---|---|---|
| Cat with lizard | Nothing to sort | notWaste, "a cat playing with a lizard" | Pass |
| Woman in rice field | Nothing to sort | notWaste | Pass |
| Montréal skyline | Nothing to sort | notWaste | Pass |
| Graffiti PICTURE of a spray can | Nothing to sort | notWaste, "wall mosaic of an alien and a spray can" | Pass (trick photo) |
| Glass jar | glass_jar → recycling | glass_jar | Pass |
| Paper coffee cup | coffee_cup → recycling | coffee_cup | Pass |
| Banana peel | food_scraps → compost | food_scraps, count 2 | Pass (it read the split peel as 2) |
| Incandescent bulb | bulb_regular → garbage | bulb_regular | Pass |
| Spiral CFL (lit, in a ceiling) | bulb_mercury → écocentre | bulb_mercury | Pass |
| Paper box + paper | cardboard → recycling | cardboard | Pass |
| Stack of newspapers | paper → recycling | paper ×6 | Pass |
| 10 batteries of different sizes + a match | battery ×10 | battery ×10 (twice) | Pass, exact count |
| Foam take-out tray with food | foam_food | foam_food | Pass |
| Fly-tipping pile (mattress, boxes, bags, bucket, plank) | furniture, cardboard, bags | furniture, cardboard ×2, "pizza box" ×2, plastic bucket, wood, 3 garbage bags (unplayable) | Mostly right; closed garbage bags correctly marked unplayable |
| Bales of crushed cans and bottles | many cans + bottles, estimate | drink_can, "about 150" | Estimate right, bottles missed |
| Sink full of recyclables | cans, bottles, film | 9 cans, 2 bottles, 2 wrappers | Pass (film read as wrappers, same bin) |
| Your table photo 1 (overlapping) | 4 cans, 2 bottles, 3 wrappers = 9 | 2 cans, 1 bottle, 3 wrappers = 6 | **Undercount**: hidden cans and the background bottle |
| Your table photo 2 (spread out) | 5 cans, 2 bottles, 3 wrappers = 10 | 4 cans, 2 bottles, 3 wrappers = 9 | Near miss: two touching cans read as one |
| Hand-drawn items | battery, can, peel, pizza box, cup | 4 of 5 | The drawn cup was missed |

## What was tried to improve counting, and didn't help

| Change | Cans found on table photo 1 (truth 4) | Time |
|---|---|---|
| Current setup | 2 | ~2 s |
| List every object separately with a box around each | 2 | 2.7 s |
| Higher image resolution / full-size photo | 2 | 2.3–2.6 s |
| More "thinking" (low) | 2 (fixed the bottle count) | ~5 s |
| More "thinking" (high) | 3 on photo 2; **timed out** on 2 of 4 photos | 20 s+ |
| Stronger model (`gemini-3.5-flash`) | 3 | 18.7 s |

Conclusion: the limit is objects hidden behind other objects. No setting reliably sees a can whose only
visible part is a thin edge. **Spreading items out is what fixes counting** (2 of 4 → 4 of 5 → 10 of 10).

## Bugs found and fixed during the audit

1. **Mixed languages.** Asked for English, `subject` and `kind` came back in French because the prompt's
   examples are French. The request now names the language for every text field. Verified: "A cat
   playing with a lizard".
2. **Non-waste photos had no answer.** A cat returned an empty list with nothing to show. Added `subject`,
   `notWaste` and a ready-to-show `message` to the response.

## Recommendations for the demo

- Lay the demo objects out on a table with a gap between each, photographed from above. That setup is
  what produced 10/10.
- Add a +/− control on each item's count in the app, so a missed can is one tap to fix.
- Don't use the stronger model for live scans: 19 s feels broken in a 60-second demo.
