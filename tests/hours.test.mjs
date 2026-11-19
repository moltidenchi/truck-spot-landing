import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTime, formatTime, statusAt, isOpenAt, describeStatus, validateHours, weekRows } from "../assets/js/hours.js";

// 2026-11-16 is a Monday. Local-time Date constructor keeps the tests time-zone independent.
const at = (day, hh, mm = 0) => new Date(2026, 10, 15 + day, hh, mm); // day 0 = Sunday 15 Nov

const lunchDinner = { mon: [["11:00", "14:30"], ["17:00", "21:30"]], tue: [["11:00", "14:30"]] };
const lateNight = { fri: [["18:00", "02:00"]], sat: [["18:00", "02:00"]] };

test("parseTime / formatTime round trip and reject malformed input", () => {
  assert.equal(parseTime("00:00"), 0);
  assert.equal(parseTime("21:30"), 1290);
  assert.equal(parseTime("24:00"), 1440);
  assert.equal(formatTime(1290), "21:30");
  assert.equal(formatTime(1440 + 60), "01:00");
  for (const bad of ["9:00", "25:00", "12:60", "24:30", "noon", ""]) {
    assert.throws(() => parseTime(bad), /Invalid time/, bad);
  }
});

test("open inside a range, closed between ranges, end time is exclusive", () => {
  assert.equal(isOpenAt(lunchDinner, at(1, 11, 0)), true);
  assert.equal(isOpenAt(lunchDinner, at(1, 14, 29)), true);
  assert.equal(isOpenAt(lunchDinner, at(1, 14, 30)), false);
  assert.equal(isOpenAt(lunchDinner, at(1, 16, 0)), false);
  assert.equal(isOpenAt(lunchDinner, at(1, 10, 59)), false);
});

test("closing time and next opening time", () => {
  assert.deepEqual(statusAt(lunchDinner, at(1, 12, 0)), { open: true, closesAt: 870, closesInMinutes: 150 });
  assert.deepEqual(statusAt(lunchDinner, at(1, 15, 0)), { open: false, opensAt: 1020, opensInDays: 0, opensDay: 1 });
  // After Monday dinner: next is Tuesday lunch.
  assert.deepEqual(statusAt(lunchDinner, at(1, 22, 0)), { open: false, opensAt: 660, opensInDays: 1, opensDay: 2 });
  // Tuesday afternoon: nothing until next Monday (6 days later).
  assert.deepEqual(statusAt(lunchDinner, at(2, 15, 0)), { open: false, opensAt: 660, opensInDays: 6, opensDay: 1 });
});

test("ranges past midnight stay open into the next day", () => {
  assert.equal(isOpenAt(lateNight, at(5, 23, 0)), true); // Friday 23:00
  assert.equal(isOpenAt(lateNight, at(6, 1, 30)), true); // Saturday 01:30, from Friday's range
  assert.equal(isOpenAt(lateNight, at(6, 2, 0)), false); // closes 02:00
  assert.equal(isOpenAt(lateNight, at(0, 1, 0)), true); // Sunday 01:00, from Saturday's range
  assert.equal(isOpenAt(lateNight, at(1, 1, 0)), false); // Monday 01:00: Sunday has no hours
  const s = statusAt(lateNight, at(6, 1, 30));
  assert.equal(s.closesAt, 120);
  assert.equal(s.closesInMinutes, 30);
});

test("touching ranges count as one stretch", () => {
  const split = { mon: [["11:00", "15:00"], ["15:00", "20:00"]] };
  assert.equal(statusAt(split, at(1, 14, 0)).closesAt, 1200);
});

test("a truck without hours is never open and says so", () => {
  const s = statusAt({}, at(3, 12, 0));
  assert.deepEqual(s, { open: false, opensAt: null });
  assert.equal(describeStatus(s), "No hours listed");
});

test("describeStatus wording", () => {
  assert.equal(describeStatus(statusAt(lunchDinner, at(1, 12, 0))), "Open now until 14:30");
  assert.equal(describeStatus(statusAt(lunchDinner, at(1, 14, 10))), "Closing soon, at 14:30");
  assert.equal(describeStatus(statusAt(lunchDinner, at(1, 15, 0))), "Closed, opens at 17:00");
  assert.equal(describeStatus(statusAt(lunchDinner, at(1, 22, 0))), "Closed, opens tomorrow at 11:00");
  assert.equal(describeStatus(statusAt(lunchDinner, at(2, 15, 0))), "Closed, opens Mon at 11:00");
  assert.equal(describeStatus(statusAt(lunchDinner, at(1, 12, 0)), (m) => `${m}min`), "Open now until 870min");
});

test("validateHours catches bad data", () => {
  assert.deepEqual(validateHours(lunchDinner), []);
  assert.deepEqual(validateHours(lateNight), []);
  assert.match(validateHours({ mon: [["11:00", "15:00"], ["14:00", "18:00"]] }).join(), /overlapping/);
  assert.match(validateHours({ mon: [["11:00", "1500"]] }).join(), /Invalid time/);
  assert.match(validateHours({ funday: [] }).join(), /unknown day/);
  assert.deepEqual(validateHours(null), ["hours must be an object"]);
});

test("weekRows starts on Monday and marks closed days", () => {
  const rows = weekRows(lunchDinner);
  assert.equal(rows.length, 7);
  assert.equal(rows[0].label, "Mon");
  assert.equal(rows[0].text, "11:00–14:30, 17:00–21:30");
  assert.equal(rows[6].label, "Sun");
  assert.equal(rows[6].text, "Closed");
});
