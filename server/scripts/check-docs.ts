/**
 * @file `npm run check` documentation lint (owner: Waddah). ESLint is not installed and the team should
 * not add heavy tooling mid-hackathon, so this small script enforces the two documentation rules:
 *
 * 1. Every .ts file in src/ and scripts/ starts with a header comment naming its owner ("owner:"),
 *    and non-test files also say what they must never do ("never").
 * 2. Every top-level exported function/const/let/class/interface/type/enum has a JSDoc block
 *    (a comment starting with two asterisks) directly above it. Re-exports (`export { x } from`) are
 *    skipped: they are documented where they are defined.
 *
 * It only reads files and never fixes them: a failing file must be documented by a person.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "node_modules" ? [] : tsFiles(p);
    return p.endsWith(".ts") ? [p] : [];
  });
}

const EXPORT = /^export\s+(?:declare\s+)?(?:async\s+)?(?:abstract\s+)?(function|const|let|class|interface|type|enum)\b(?!\s*\{)/;
const problems: string[] = [];

for (const file of [...tsFiles(join(root, "src")), ...tsFiles(join(root, "scripts"))]) {
  const rel = relative(root, file);
  const lines = readFileSync(file, "utf8").split("\n");

  // 1. Header comment.
  const first = lines.findIndex(l => l.trim() !== "");
  const headerEnd = lines[first]?.trim().startsWith("/*") ? lines.findIndex((l, i) => i >= first && l.includes("*/")) : first;
  const header = lines.slice(first, headerEnd + 1).join("\n");
  if (!/^\s*(\/\*|\/\/)/.test(lines[first] ?? "")) problems.push(`${rel}:1 missing header comment`);
  else {
    if (!/owner/i.test(header)) problems.push(`${rel}:1 header does not name an owner ("owner: …")`);
    if (!rel.includes("tests/") && !/never/i.test(header)) problems.push(`${rel}:1 header does not say what the file must never do`);
  }

  // 2. JSDoc on exports.
  lines.forEach((line, i) => {
    const m = EXPORT.exec(line);
    if (!m) return;
    let j = i - 1;
    while (j >= 0 && lines[j].trim() === "") j--;
    let ok = false;
    if (j >= 0 && lines[j].trim().endsWith("*/")) {
      while (j >= 0 && !lines[j].includes("/*")) j--;
      ok = j >= 0 && lines[j].trim().startsWith("/**");
    }
    if (!ok) problems.push(`${rel}:${i + 1} exported ${m[1]} has no JSDoc: ${line.trim().slice(0, 70)}`);
  });
}

if (problems.length) {
  console.error(`docs check failed (${problems.length}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("docs ok: every file has an owner header and every export has JSDoc");
