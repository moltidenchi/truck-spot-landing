import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTokens, generatedFiles, contrast } from "../tools/build_tokens.mjs";

const tokens = loadTokens();
const c = Object.fromEntries(Object.entries(tokens.color).map(([k, v]) => [k, v.$value]));

test("generated CSS and style-guide palette are in sync with tokens.json", () => {
  for (const [file, content] of Object.entries(generatedFiles(tokens))) {
    assert.equal(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), content, `${file} is stale: run node tools/build_tokens.mjs`);
  }
});

test("every colour token is a #RRGGBB value with a description", () => {
  for (const [name, t] of Object.entries(tokens.color)) {
    assert.match(t.$value, /^#[0-9A-F]{6}$/, name);
    assert.ok(t.$description, name);
  }
});

// Every text/background (4.5:1) and UI/graphic (3:1) pairing the pages actually use.
const pairs = [
  ["asphalt", "mustard", 4.5, "hero text, header"],
  ["asphalt", "curb", 4.5, "body text"],
  ["asphalt", "fog", 4.5, "component panels"],
  ["kerb", "curb", 4.5, "secondary text"],
  ["kerb", "fog", 4.5, "secondary text on fog"],
  ["curb", "ketchup", 4.5, "updates section, red buttons"],
  ["curb", "ketchup-dark", 4.5, "red button hover"],
  ["curb", "asphalt", 4.5, "dark buttons, footer"],
  ["curb", "asphalt-soft", 4.5, "dark button hover"],
  ["smoke", "asphalt", 4.5, "footer secondary text"],
  ["mustard", "asphalt", 4.5, "footer links"],
  ["mustard-light", "asphalt", 4.5, "footer link hover"],
  ["ketchup", "curb", 4.5, "links, field errors"],
  ["lettuce", "curb", 4.5, "open status"],
  ["amber", "curb", 4.5, "closing soon status"],
  ["asphalt", "mustard-light", 4.5, "chip hover, today row"],
  ["kerb", "curb", 3, "input border"],
  ["ketchup", "curb", 3, "map pin"],
  ["kerb", "curb", 3, "closed map pin"],
  ["you", "curb", 3, "location dot"],
];

for (const [fg, bg, min, use] of pairs) {
  test(`contrast ${fg} on ${bg} >= ${min}:1 (${use})`, () => {
    const ratio = contrast(c[fg], c[bg]);
    assert.ok(ratio >= min, `${ratio.toFixed(2)}:1`);
  });
}
