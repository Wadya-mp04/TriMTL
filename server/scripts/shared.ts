/**
 * @file Offline shared copies (owner: Waddah). The app bundles the same rules data, engine and contract
 * as the server, so offline lookups and scoring give identical answers. Expo's bundler won't import files
 * from outside mobile/ by default, so they are COPIED into mobile/shared/, keeping the server's folder
 * layout so the relative imports inside them (../types.js, ./services/rulesEngine.js) still resolve.
 *
 *   npx tsx scripts/shared.ts sync    copy server -> mobile/shared   (npm run sync-shared)
 *   npx tsx scripts/shared.ts check   fail if the copies differ      (part of npm run check)
 *
 * The server's files are the source of truth: never edit the copies in mobile/shared/ by hand.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const server = new URL("../src/", import.meta.url).pathname;
const mobile = new URL("../../mobile/", import.meta.url).pathname;
const shared = join(mobile, "shared");

/** Files the app bundles, as paths relative to server/src/ and to mobile/shared/. */
export const SHARED_FILES = ["types.ts", "services/rulesEngine.ts", "data/quebecRules.json"] as const;

const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");

const mode = process.argv[2];
if (mode === "sync") {
  if (!existsSync(mobile)) { console.error("mobile/ does not exist yet; create the Expo app first"); process.exit(1); }
  for (const f of SHARED_FILES) {
    mkdirSync(dirname(join(shared, f)), { recursive: true });
    copyFileSync(join(server, f), join(shared, f));
    console.log(`copied server/src/${f} -> mobile/shared/${f}`);
  }
} else if (mode === "check") {
  if (!existsSync(shared)) {
    console.log("shared ok: mobile/shared/ does not exist yet (skipped). Run `npm run sync-shared` once the Expo app exists.");
  } else {
    const bad = SHARED_FILES.filter(f => !existsSync(join(shared, f)) || sha(join(shared, f)) !== sha(join(server, f)));
    if (bad.length) {
      console.error(`shared check failed: mobile/shared/ differs from server/src/ for ${bad.join(", ")}. Run \`npm run sync-shared\` in server/.`);
      process.exit(1);
    }
    console.log(`shared ok: ${SHARED_FILES.length} files in mobile/shared/ match the server (sha256)`);
  }
} else {
  console.error("usage: tsx scripts/shared.ts sync|check");
  process.exit(1);
}
