const test = require("node:test");
const assert = require("node:assert/strict");

let clampScale;
let stepScale;

test.before(async () => {
  ({ clampScale, stepScale } = await import("../utils/graphViewport.mjs"));
});

test("clampScale keeps values inside the allowed zoom bounds", () => {
  assert.equal(clampScale(0.1), 0.78);
  assert.equal(clampScale(1), 1);
  assert.equal(clampScale(3), 1.85);
});

test("stepScale moves zoom in fixed increments", () => {
  assert.equal(stepScale(1, "in"), 1.12);
  assert.equal(stepScale(1, "out"), 0.88);
  assert.equal(stepScale(1.82, "in"), 1.85);
  assert.equal(stepScale(0.8, "out"), 0.78);
});
