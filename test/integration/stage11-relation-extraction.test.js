"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../../src/index");

test("runPipeline relations_extracted emits deterministic accepted relation annotations", async function () {
  const text = "Alice buys products in Berlin and ships orders.";
  const outA = await api.runPipeline(text, { target: "relations_extracted" });
  const outB = await api.runPipeline(text, { target: "relations_extracted" });

  assert.equal(outA.stage, "relations_extracted");
  assert.deepEqual(outA, outB);

  const rels = outA.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(rels.length > 0, true);
  assert.equal(rels.some(function (r) { return r.label === "actor" || r.label === "theme" || r.label === "location"; }), true);

  for (let i = 0; i < rels.length; i += 1) {
    const rel = rels[i];
    const tokenSelector = rel.anchor.selectors.find(function (s) { return s.type === "TokenSelector"; });
    const textPos = rel.anchor.selectors.find(function (s) { return s.type === "TextPositionSelector"; });
    const textQuote = rel.anchor.selectors.find(function (s) { return s.type === "TextQuoteSelector"; });
    assert.ok(tokenSelector);
    assert.ok(textPos);
    assert.ok(textQuote);
    assert.equal(tokenSelector.token_ids.length, 2);
    assert.equal(textQuote.exact, outA.canonical_text.slice(textPos.span.start, textPos.span.end));
  }
});

test("runPipeline relations_extracted emits actor relation for pronoun subject", async function () {
  const text = "They want to buy.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenBySurface = new Map(out.tokens.map(function (t) { return [String(t.surface || "").toLowerCase(), t.id]; }));
  const wantId = tokenBySurface.get("want");
  const theyId = tokenBySurface.get("they");
  assert.ok(wantId);
  assert.ok(theyId);

  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) { return r.label === "actor" && r.head.id === wantId && r.dep.id === theyId; }),
    true
  );
});

test("runPipeline relations_extracted emits object-role relation for pronoun object", async function () {
  const text = "People put them into a cart.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenBySurface = new Map(out.tokens.map(function (t) { return [String(t.surface || "").toLowerCase(), t.id]; }));
  const putId = tokenBySurface.get("put");
  const themId = tokenBySurface.get("them");
  assert.ok(putId);
  assert.ok(themId);

  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) { return r.label === "theme" && r.head.id === putId && r.dep.id === themId; }),
    true
  );
});

test("runPipeline relations_extracted emits passive subject relation for may be used pattern", async function () {
  const text = "Generated primes may be used for educational purposes or basic numerical experiments.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenBySurface = new Map(out.tokens.map(function (t) { return [String(t.surface || "").toLowerCase(), t.id]; }));
  const usedId = tokenBySurface.get("used");
  const primesId = tokenBySurface.get("primes");
  assert.ok(usedId);
  assert.ok(primesId);

  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) { return r.label === "patient" && r.head.id === usedId && r.dep.id === primesId; }),
    true
  );
});

test("runPipeline relations_extracted keeps such-as clause centered on grants and preserves exemplars", async function () {
  const text = "Each role grants permissions such as read, write, or administer.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenBySurface = new Map(out.tokens.map(function (t) { return [String(t.surface || "").toLowerCase(), t.id]; }));
  const grantsId = tokenBySurface.get("grants");
  const roleId = tokenBySurface.get("role");
  const permissionsId = tokenBySurface.get("permissions");
  const readId = tokenBySurface.get("read");
  const writeId = tokenBySurface.get("write");
  const administerId = tokenBySurface.get("administer");
  assert.ok(grantsId);
  assert.ok(roleId);
  assert.ok(permissionsId);
  assert.ok(readId);
  assert.ok(writeId);
  assert.ok(administerId);

  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) { return r.label === "actor" && r.head.id === grantsId && r.dep.id === roleId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "theme" && r.head.id === grantsId && r.dep.id === permissionsId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "exemplifies" && r.head.id === permissionsId && r.dep.id === readId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "exemplifies" && r.head.id === permissionsId && r.dep.id === writeId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "exemplifies" && r.head.id === permissionsId && r.dep.id === administerId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "actor" && r.head.id === writeId && r.dep.id === roleId; }),
    false
  );
});
