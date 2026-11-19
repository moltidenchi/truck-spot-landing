// Static checks on the pages and data: local references resolve, nothing third-party is loaded
// except OSM tiles, a CSP is present, no personal data or secrets, and the demo data is valid.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { TRUCKS, DEFAULT_CENTER } from "../assets/js/trucks.js";
import { validateHours } from "../assets/js/hours.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pages = ["index.html", "style-guide.html"];
const read = (p) => readFileSync(join(root, p), "utf8");

function walk(dir, out = []) {
  for (const name of readdirSync(join(root, dir))) {
    if ([".git", "node_modules", "dist", "shots", ".venv"].includes(name)) continue;
    const rel = dir ? `${dir}/${name}` : name;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

test("every local href/src in the pages resolves to a file", () => {
  for (const page of pages) {
    const html = read(page);
    for (const [, url] of html.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)) {
      if (/^(https?:|mailto:|data:)/.test(url) || url === "./") continue;
      assert.ok(existsSync(join(root, url)), `${page}: missing ${url}`);
    }
  }
});

test("in-page anchors exist", () => {
  for (const page of pages) {
    const html = read(page);
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(id), `${page}: #${id}`);
  }
});

test("no third-party scripts, styles or fonts; Leaflet is the pinned local copy", () => {
  for (const page of pages) {
    const html = read(page);
    assert.doesNotMatch(html, /<script[^>]+src="https?:/, page);
    assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"[^>]+href="https?:/, page);
    assert.doesNotMatch(html, /fonts\.googleapis|unpkg|jsdelivr|cdnjs/, page);
  }
  assert.match(read("index.html"), /assets\/vendor\/leaflet-1\.9\.4\/leaflet\.js/);
  assert.match(read("assets/vendor/leaflet-1.9.4/leaflet.js"), /Leaflet 1\.9\.4/);
  for (const css of ["assets/css/site.css", "assets/css/fonts.css", "assets/css/style-guide.css"]) {
    assert.doesNotMatch(read(css), /url\(["']?https?:/, css);
  }
});

test("each page has a Content-Security-Policy without unsafe-inline/eval", () => {
  for (const page of pages) {
    const m = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(read(page));
    assert.ok(m, `${page}: no CSP`);
    assert.match(m[1], /default-src 'self'/);
    assert.match(m[1], /object-src 'none'/);
    assert.doesNotMatch(m[1], /unsafe-inline|unsafe-eval/);
  }
  // Inline <script>/<style> blocks or style="" attributes would be blocked by that CSP.
  for (const page of pages) {
    const html = read(page);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, `${page}: inline script`);
    assert.doesNotMatch(html, /<style[\s>]/, `${page}: inline style block`);
    assert.doesNotMatch(html, /\sstyle="/, `${page}: style attribute`);
  }
});

test("no email addresses (other than example-domain placeholders), phone numbers or secrets in the repo", () => {
  const text = walk("").filter((f) => [".html", ".js", ".mjs", ".css", ".md", ".json", ".py", ".sh", ".webmanifest", ".svg", ".txt"].includes(extname(f)));
  const secret = /(gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[abp]-[A-Za-z0-9-]+)/;
  for (const file of text) {
    if (file.startsWith("assets/vendor/")) continue; // third-party, checked by version above
    const fixtures = file === "tests/email.test.mjs"; // deliberately malformed example addresses
    const body = read(file);
    for (const [addr] of fixtures ? [] : body.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)) {
      // Only RFC 2606 reserved "example" domains are allowed (placeholders and test fixtures).
      assert.ok(addr.split("@")[1].split(".").includes("example"), `${file}: ${addr}`);
    }
    assert.doesNotMatch(body, secret, file);
    assert.doesNotMatch(body, /\+\d{1,3}[\s-]?\(?\d{2,3}\)?[\s-]?\d{3}[\s-]?\d{3,4}/, `${file}: phone number`);
  }
});

test("demo data is valid and clearly synthetic", () => {
  assert.ok(Number.isFinite(DEFAULT_CENTER.lat) && Number.isFinite(DEFAULT_CENTER.lng));
  const ids = new Set();
  for (const t of TRUCKS) {
    assert.ok(!ids.has(t.id), `duplicate id ${t.id}`);
    ids.add(t.id);
    assert.match(t.id, /^[a-z0-9-]+$/);
    assert.deepEqual(validateHours(t.hours), [], t.id);
    assert.equal(t.menu.length, 3, t.id);
    for (const [item, price] of t.menu) assert.ok(item && /^\$\d+$/.test(price), `${t.id}: ${item}`);
    assert.ok(Math.hypot(...t.offset) < 2500, `${t.id} within 2.5 km`);
  }
  assert.ok(TRUCKS.length >= 8);
  assert.match(read("assets/js/trucks.js"), /SYNTHETIC DEMO DATA/);
  assert.match(read("index.html"), /fictional demo data/i);
});

test("logo and favicon set is complete", () => {
  const svgs = ["horizontal", "horizontal-on-dark", "horizontal-mono-black", "horizontal-mono-white", "stacked", "stacked-on-dark", "icon", "icon-on-dark", "icon-mono-black", "icon-mono-white", "favicon", "app-icon"];
  for (const s of svgs) {
    const svg = read(`assets/logo/svg/truckspot-${s}.svg`);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 [\d.]+ [\d.]+"/, s);
    assert.doesNotMatch(svg, /<text|<image|font-family/, `${s} must be outlines only`);
  }
  for (const f of ["favicon.ico", "favicon.svg", "favicon-16.png", "favicon-32.png", "favicon-48.png", "apple-touch-icon-180.png", "icon-192.png", "icon-512.png"]) {
    assert.ok(existsSync(join(root, "assets/favicon", f)), f);
  }
  for (const s of svgs) {
    const pngs = readdirSync(join(root, "assets/logo/png")).filter((p) => p.startsWith(`truckspot-${s}-`) && /-(\d+w?)\.png$/.test(p) && p.replace(`truckspot-${s}-`, "").match(/^\d+w?\.png$/));
    assert.equal(pngs.length, 2, `${s}: ${pngs}`);
  }
});
