import assert from "node:assert/strict";
import test from "node:test";
import { isDashboardPath } from "../../src/components/layoutModel.js";

test("all dashboard workspace routes remain outside the public website chrome", () => {
  for (const path of ["/dashboard", "/dashboard/scouting", "/dashboard/finance/transactions", "/dashboard/storage/inventory", "/admin", "/chiefs/attendance"]) {
    assert.equal(isDashboardPath(path), true, path);
  }
});

test("public pages retain the public header and footer", () => {
  for (const path of ["/", "/about", "/calendar", "/blogs/example", "/gallery/album"]) {
    assert.equal(isDashboardPath(path), false, path);
  }
});
