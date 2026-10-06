#!/usr/bin/env node
/**
 * Build the distributable game: dist/zizzy/ plus a versioned archive.
 *
 *   node scripts/package.mjs            # version from package.json
 *   node scripts/package.mjs 2.1.0      # explicit version (CI passes the tag)
 *
 * Output:
 *   dist/zizzy/                       runtime files only, ?v= stamped
 *   dist/zizzy-<version>.tar.gz       release asset
 *   dist/zizzy-<version>.tar.gz.sha256
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = (process.argv[2] || pkg.version).replace(/^v/, "");
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) throw new Error(`Not a semver version: ${version}`);

// Everything the game needs at runtime; nothing else ships.
const RUNTIME = ["index.html", "style.css", "js", "screenshot.png", "LICENSE"];

const dist = join(root, "dist");
const out = join(dist, "zizzy");
rmSync(dist, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of RUNTIME) cpSync(join(root, f), join(out, f), { recursive: true });

// Cache busting: CDNs (e.g. Cloudflare) cache .js/.css for hours, so every
// release gets its own asset URLs. Source uses ?v=dev.
const html = readFileSync(join(out, "index.html"), "utf8");
const stamped = html.replace(/\?v=dev\b/g, `?v=${version}`);
if (stamped === html) throw new Error("index.html has no ?v=dev asset URLs to stamp");
writeFileSync(join(out, "index.html"), stamped);
writeFileSync(join(out, "VERSION"), `${version}\n`);

const archive = `zizzy-${version}.tar.gz`;
// --sort/--mtime/--owner/--mode and gzip -n make the archive byte-identical for
// identical input on any machine (checkout permissions and umask differ)
execFileSync("tar", ["--sort=name", "--mtime=@0", "--owner=0", "--group=0", "--numeric-owner", "--mode=u=rwX,go=rX",
  "--use-compress-program=gzip -n", "-C", dist, "-cf", join(dist, archive), "zizzy"]);
const sha = createHash("sha256").update(readFileSync(join(dist, archive))).digest("hex");
writeFileSync(join(dist, `${archive}.sha256`), `${sha}  ${archive}\n`);

console.log(`Packaged zizzy ${version}\n  ${archive}\n  sha256 ${sha}`);
