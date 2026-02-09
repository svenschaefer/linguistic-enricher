"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../../src/index");

test("runPipeline mwe_materialized yields accepted MWEs with materialization evidence", async function () {
  const out = await api.runPipeline("An online store has a shopping cart.", { target: "mwe_materialized" });
  assert.equal(out.stage, "mwe_materialized");

  const mwes = out.annotations.filter(function (a) { return a.kind === "mwe"; });
  assert.equal(mwes.length > 0, true);

  const accepted = mwes.filter(function (a) { return a.status === "accepted"; });
  assert.equal(accepted.length > 0, true);

  const hasShoppingCart = accepted.some(function (a) { return a.label === "shopping cart"; });
  assert.equal(hasShoppingCart, true);

  for (let i = 0; i < accepted.length; i += 1) {
    const ann = accepted[i];
    const source = ann.sources.find(function (s) { return s.name === "mwe-materialization"; });
    assert.equal(typeof source, "object");
    assert.equal(source.kind, "rule");
    assert.equal(typeof source.evidence, "object");
    assert.equal(source.evidence.rule, "candidate_merge");
  }
});

