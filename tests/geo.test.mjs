import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceMeters, offsetLatLng, formatDistance, unitsForLocale } from "../assets/js/geo.js";

const center = { lat: 30.2672, lng: -97.7431 };

test("offsetLatLng and distanceMeters agree within 0.5 %", () => {
  for (const [e, n] of [[1000, 0], [0, 1000], [-800, 600], [1480, -260]]) {
    const p = offsetLatLng(center, e, n);
    const expected = Math.hypot(e, n);
    assert.ok(Math.abs(distanceMeters(center, p) - expected) / expected < 0.005, `${e},${n}`);
  }
  assert.equal(distanceMeters(center, center), 0);
});

test("known distance: Budapest to Vienna is about 214 km", () => {
  const d = distanceMeters({ lat: 47.4979, lng: 19.0402 }, { lat: 48.2082, lng: 16.3738 });
  assert.ok(Math.abs(d - 214_000) < 3_000, String(d));
});

test("formatDistance", () => {
  assert.equal(formatDistance(4), "10 m");
  assert.equal(formatDistance(347), "350 m");
  assert.equal(formatDistance(1234), "1.2 km");
  assert.equal(formatDistance(15_600), "16 km");
  assert.equal(formatDistance(804.672, "imperial"), "0.5 mi");
  assert.equal(formatDistance(20_000, "imperial"), "12 mi");
});

test("unitsForLocale", () => {
  assert.equal(unitsForLocale("en-US"), "imperial");
  assert.equal(unitsForLocale("en-GB"), "metric");
  assert.equal(unitsForLocale("hu"), "metric");
  assert.equal(unitsForLocale(undefined), "metric");
});
