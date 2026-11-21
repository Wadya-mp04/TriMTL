/**
 * @file `npm run check` secrets guard (owner: Waddah). GEMINI_API_KEY must live only in server/.env,
 * which git ignores. This fails if a tracked or staged file contains something shaped like a Google API
 * key, if .env.example has a real value, or if anything in mobile/ mentions the key.
 * It never prints a matched value, only the file name, so the check itself cannot leak a key into logs.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repo = new URL("../../", import.meta.url).pathname;
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: repo, encoding: "utf8" })
  .split("\n").filter(Boolean).filter(f => !f.includes("node_modules/"));

const problems: string[] = [];
for (const f of files) {
  const p = join(repo, f);
  if (!existsSync(p)) continue;
  const text = readFileSync(p, "utf8");
  if (/AIza[0-9A-Za-z_-]{35}/.test(text)) problems.push(`${f}: contains a Google API key`);
  if (/(^|\/)\.env$/.test(f)) problems.push(`${f}: .env file is tracked or not ignored`);
  if (f.startsWith("mobile/") && /GEMINI_API_KEY/.test(text)) problems.push(`${f}: the app must never reference GEMINI_API_KEY`);
}
const example = join(repo, "server/.env.example");
if (!existsSync(example)) problems.push("server/.env.example is missing");
else if (/^GEMINI_API_KEY=\S+/m.test(readFileSync(example, "utf8"))) problems.push("server/.env.example: GEMINI_API_KEY must be empty");

if (problems.length) {
  console.error(`secrets check failed:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`secrets ok: ${files.length} files scanned, no key outside server/.env`);
