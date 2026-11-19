import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEmail, isValidEmail } from "../assets/js/email.js";

test("accepts ordinary addresses and trims whitespace", () => {
  for (const ok of [
    "name@example.com",
    "first.last@example.co.uk",
    "name+trucks@example.org",
    "o'brien@example.ie",
    "x@sub-domain.example.travel",
    "user@xn--bcher-kva.example",
  ]) {
    assert.equal(isValidEmail(ok), true, ok);
  }
  assert.deepEqual(validateEmail("  name@example.com \n"), { ok: true, value: "name@example.com" });
});

test("rejects common typos", () => {
  for (const bad of [
    "plainaddress",
    "@example.com",
    "name@",
    "name@example",
    "name@@example.com",
    "name@exa mple.com",
    "na me@example.com",
    "name.@example.com",
    ".name@example.com",
    "na..me@example.com",
    "name@-example.com",
    "name@example-.com",
    "name@example..com",
    "name@example.c",
    "name@example.123",
    "<script>@example.com",
  ]) {
    assert.equal(isValidEmail(bad), false, bad);
  }
});

test("explains what is wrong", () => {
  assert.deepEqual(validateEmail(""), { ok: false, error: "Enter your email address." });
  assert.deepEqual(validateEmail("   "), { ok: false, error: "Enter your email address." });
  assert.equal(validateEmail(undefined).ok, false);
  assert.match(validateEmail("name@example").error, /like name@example\.com/);
  assert.equal(validateEmail(`${"a".repeat(65)}@example.com`).ok, false); // local part > 64
  assert.match(validateEmail(`a@${"b".repeat(250)}.com`).error, /too long/);
});
