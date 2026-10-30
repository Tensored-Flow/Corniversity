// Creates the local environment file from the example with freshly generated secrets.
// Never prints secret values. Safe to re-run: refuses to overwrite an existing file.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

const target = resolve(process.cwd(), ".env");
const example = resolve(process.cwd(), ".env.example");
const ownerEmail = process.argv[2] ?? "you@example.com";
const dataRoot = process.argv[3] ?? resolve(process.cwd(), "..", "Corniversity-Library");

if (existsSync(target)) {
  console.log("environment file already exists; leaving it unchanged");
  process.exit(0);
}
let text = readFileSync(example, "utf8");
text = text
  .replace(/BETTER_AUTH_SECRET=.*/, `BETTER_AUTH_SECRET=${randomBytes(32).toString("base64")}`)
  .replace(/OWNER_EMAIL=.*/, `OWNER_EMAIL=${ownerEmail}`)
  .replace(/OWNER_BOOTSTRAP_CODE=.*/, `OWNER_BOOTSTRAP_CODE=${randomBytes(9).toString("base64url")}`)
  .replace(/CORNIVERSITY_DATA_ROOT=.*/, `CORNIVERSITY_DATA_ROOT=${dataRoot}`);
writeFileSync(target, text, "utf8");
mkdirSync(dataRoot, { recursive: true });
console.log(`environment file created; data root ${dataRoot}`);
console.log("your one-time bootstrap code is stored in it under OWNER_BOOTSTRAP_CODE");
