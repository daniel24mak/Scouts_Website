import assert from "node:assert/strict";
import test from "node:test";

import { asArray } from "../../src/utils/collections.js";

test("asArray preserves arrays", () => {
  const rows = [{ id: "one" }];

  assert.equal(asArray(rows), rows);
});

test("asArray converts incomplete API values to an empty array", () => {
  for (const value of [undefined, null, {}, "", 0, false]) {
    assert.deepEqual(asArray(value), []);
  }
});
