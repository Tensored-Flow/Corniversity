#!/usr/bin/env node
import { execSync } from "node:child_process";
// Prerequisite check for Corniversity. Prints what is present and what to do about gaps.
import { existsSync } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";

const results = [];
function check(name, ok, detail, fix) {
  results.push({ name, ok, detail, fix });
}

const [major, minor] = process.versions.node.split(".").map(Number);
check(
  "Node.js >= 22.12",
  major > 22 || (major === 22 && minor >= 12),
  `found ${process.versions.node}`,
  "Install Node.js 22.12+ from https://nodejs.org",
);

function has(cmd) {
  try {
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
check("pnpm", has("pnpm --version"), "", "npm install -g pnpm");
check("git", has("git --version"), "", "Install Git for Windows");

const envPath = resolve(process.cwd(), ".env");
check(".env present", existsSync(envPath), envPath, "Copy .env.example to .env and edit it");

if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
  const required = [
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "OWNER_EMAIL",
    "OWNER_BOOTSTRAP_CODE",
    "CORNIVERSITY_DATA_ROOT",
  ];
  for (const key of required) {
    const v = process.env[key];
    const placeholder = v && /change-me|example\.com/.test(v);
    check(`env ${key}`, Boolean(v) && !placeholder, placeholder ? "placeholder value" : v ? "set" : "missing", `Set ${key} in .env`);
  }
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  check(
    "BETTER_AUTH_SECRET length >= 32",
    secret.length >= 32,
    `${secret.length} chars`,
    "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
  );
  const root = process.env.CORNIVERSITY_DATA_ROOT;
  if (root) {
    const inRepo = resolve(root).toLowerCase().startsWith(process.cwd().toLowerCase());
    check("data root outside repository", !inRepo, root, "Point CORNIVERSITY_DATA_ROOT outside the repo");
  }
}

check("Windows PowerShell", os.platform() !== "win32" || has("powershell -Command exit"), os.platform(), "");

let failed = 0;
for (const r of results) {
  const mark = r.ok ? "ok  " : "FAIL";
  if (!r.ok) failed++;
  console.log(`${mark} ${r.name}${r.detail ? `  (${r.detail})` : ""}${!r.ok && r.fix ? `\n       fix: ${r.fix}` : ""}`);
}
console.log(failed === 0 ? "\nAll prerequisites satisfied." : `\n${failed} item(s) need attention.`);
process.exit(failed === 0 ? 0 : 1);
