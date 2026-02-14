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

test("runPipeline relations_extracted keeps canonical semantic-output kind as accepted dependency labels", async function () {
  const text = "Generated primes may be used for educational purposes or basic numerical experiments.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenBySurface = new Map(out.tokens.map(function (t) { return [String(t.surface || "").toLowerCase(), t.id]; }));
  const usedId = tokenBySurface.get("used");
  const primesId = tokenBySurface.get("primes");
  const mayId = tokenBySurface.get("may");
  assert.ok(usedId);
  assert.ok(primesId);
  assert.ok(mayId);

  const acceptedDeps = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    acceptedDeps.some(function (r) { return r.label === "patient" && r.head.id === usedId && r.dep.id === primesId; }),
    true
  );
  assert.equal(
    acceptedDeps.some(function (r) { return r.label === "modality" && r.head.id === usedId && r.dep.id === mayId; }),
    true
  );
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
  const generatedId = tokenBySurface.get("generated");
  const forId = tokenBySurface.get("for");
  const educationalId = tokenBySurface.get("educational");
  assert.ok(usedId);
  assert.ok(primesId);
  assert.ok(generatedId);
  assert.ok(forId);
  assert.ok(educationalId);

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
  assert.equal(
    rels.some(function (r) { return r.label === "theme" && r.head.id === generatedId && r.dep.id === primesId; }),
    false
  );
  assert.equal(
    rels.some(function (r) { return r.label === "modifier" && r.head.id === forId && r.dep.id === educationalId; }),
    false
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
  const suchId = tokenBySurface.get("such");
  const readId = tokenBySurface.get("read");
  const writeId = tokenBySurface.get("write");
  const administerId = tokenBySurface.get("administer");
  assert.ok(grantsId);
  assert.ok(roleId);
  assert.ok(permissionsId);
  assert.ok(suchId);
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
  assert.equal(
    rels.some(function (r) { return r.label === "modifier" && r.dep.id === suchId; }),
    false
  );
});

test("runPipeline relations_extracted emits copula attribute for simple copula clause", async function () {
  const text = "Each factor is prime.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenBySurface = new Map(out.tokens.map(function (t) { return [String(t.surface || "").toLowerCase(), t.id]; }));
  const isId = tokenBySurface.get("is");
  const factorId = tokenBySurface.get("factor");
  const primeId = tokenBySurface.get("prime");
  assert.ok(isId);
  assert.ok(factorId);
  assert.ok(primeId);

  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) { return r.label === "actor" && r.head.id === isId && r.dep.id === factorId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "attribute" && r.head.id === isId && r.dep.id === primeId; }),
    true
  );
});

test("runPipeline relations_extracted keeps passive modifier attached to participle head", async function () {
  const text = "Factorization is commonly used in mathematics.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenBySurface = new Map(out.tokens.map(function (t) { return [String(t.surface || "").toLowerCase(), t.id]; }));
  const usedId = tokenBySurface.get("used");
  const isId = tokenBySurface.get("is");
  const factorizationId = tokenBySurface.get("factorization");
  const commonlyId = tokenBySurface.get("commonly");
  assert.ok(usedId);
  assert.ok(isId);
  assert.ok(factorizationId);
  assert.ok(commonlyId);

  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) { return r.label === "patient" && r.head.id === usedId && r.dep.id === factorizationId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "modifier" && r.head.id === usedId && r.dep.id === commonlyId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "modifier" && r.head.id === isId && r.dep.id === commonlyId; }),
    false
  );
});

test("runPipeline relations_extracted keeps for+VBG purpose chain structural and avoids VBG fallback predicates", async function () {
  const text = "Actions are recorded for auditing and security analysis.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenBySurface = new Map(out.tokens.map(function (t) { return [String(t.surface || "").toLowerCase(), t.id]; }));
  const recordedId = tokenBySurface.get("recorded");
  const actionsId = tokenBySurface.get("actions");
  const auditingId = tokenBySurface.get("auditing");
  const securityId = tokenBySurface.get("security");
  const analysisId = tokenBySurface.get("analysis");
  assert.ok(recordedId);
  assert.ok(actionsId);
  assert.ok(auditingId);
  assert.ok(securityId);
  assert.ok(analysisId);

  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) { return r.label === "patient" && r.head.id === recordedId && r.dep.id === actionsId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "beneficiary" && r.head.id === recordedId && r.dep.id === auditingId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "coordination" && r.head.id === auditingId && r.dep.id === analysisId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "coordination" && r.head.id === auditingId && r.dep.id === securityId; }),
    false
  );
  assert.equal(
    rels.some(function (r) { return r.label === "modifier" && r.head.id === analysisId && r.dep.id === securityId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.head.id === auditingId && (r.label === "actor" || r.label === "theme"); }),
    false
  );
});

test("runPipeline relations_extracted keeps temporal for+CD+noun as prep object chain", async function () {
  const text = "The system must retain reports for 10 years.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenBySurface = new Map(out.tokens.map(function (t) { return [String(t.surface || "").toLowerCase(), t.id]; }));
  const retainId = tokenBySurface.get("retain");
  const reportsId = tokenBySurface.get("reports");
  const yearsId = tokenBySurface.get("years");
  const tenId = tokenBySurface.get("10");
  assert.ok(retainId);
  assert.ok(reportsId);
  assert.ok(yearsId);
  assert.ok(tenId);

  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) { return r.label === "theme" && r.head.id === retainId && r.dep.id === reportsId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "beneficiary" && r.head.id === retainId && r.dep.id === yearsId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "modifier" && r.head.id === yearsId && r.dep.id === tenId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "theme" && r.head.id === retainId && r.dep.id === yearsId; }),
    false
  );
});

test("runPipeline relations_extracted normalizes as well as into additive coordination", async function () {
  const text = "The report includes structured fields as well as free descriptions.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenBySurface = new Map(out.tokens.map(function (t) { return [String(t.surface || "").toLowerCase(), t.id]; }));
  const includesId = tokenBySurface.get("includes");
  const reportId = tokenBySurface.get("report");
  const fieldsId = tokenBySurface.get("fields");
  const descriptionsId = tokenBySurface.get("descriptions");
  const wellId = tokenBySurface.get("well");
  assert.ok(includesId);
  assert.ok(reportId);
  assert.ok(fieldsId);
  assert.ok(descriptionsId);
  assert.ok(wellId);

  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) { return r.label === "actor" && r.head.id === includesId && r.dep.id === reportId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "theme" && r.head.id === includesId && r.dep.id === fieldsId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "coordination" && r.head.id === fieldsId && r.dep.id === descriptionsId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.dep.id === wellId; }),
    false
  );
});

test("runPipeline relations_extracted keeps connector-token suppression by design while preserving structural edges", async function () {
  const cases = [
    {
      text: "Each role grants permissions such as read, write, or administer.",
      required: [
        ["actor", "grants", "role"],
        ["theme", "grants", "permissions"],
        ["exemplifies", "permissions", "read"],
        ["exemplifies", "permissions", "write"],
        ["exemplifies", "permissions", "administer"]
      ]
    },
    {
      text: "Reports may include structured fields (category, severity, location) as well as free-form descriptions.",
      required: [
        ["actor", "include", "Reports"],
        ["theme", "include", "fields"],
        ["coordination", "location", "free-form"]
      ]
    }
  ];

  for (let i = 0; i < cases.length; i += 1) {
    const c = cases[i];
    const out = await api.runPipeline(c.text, { target: "relations_extracted" });
    assert.equal(out.stage, "relations_extracted");
    const tokenById = new Map(out.tokens.map(function (t) { return [t.id, String(t.surface || "")]; }));
    const rels = out.annotations.filter(function (a) {
      return a.kind === "dependency" &&
        a.status === "accepted" &&
        Array.isArray(a.sources) &&
        a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
    });

    const connectorUsed = rels.some(function (r) {
      const h = String(tokenById.get(r.head.id) || "").toLowerCase();
      const d = String(tokenById.get(r.dep.id) || "").toLowerCase();
      return h === "such" || h === "as" || h === "well" || d === "such" || d === "as" || d === "well";
    });
    assert.equal(connectorUsed, false);

    for (let j = 0; j < c.required.length; j += 1) {
      const req = c.required[j];
      assert.equal(
        rels.some(function (r) {
          return r.label === req[0] &&
            String(tokenById.get(r.head.id) || "").toLowerCase() === req[1].toLowerCase() &&
            String(tokenById.get(r.dep.id) || "").toLowerCase() === req[2].toLowerCase();
        }),
        true
      );
    }
  }
});

test("runPipeline relations_extracted suppresses contradictory passive fallback roles", async function () {
  const text = "Reports are reviewed by supervisors.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenBySurface = new Map(out.tokens.map(function (t) { return [String(t.surface || "").toLowerCase(), t.id]; }));
  const reviewedId = tokenBySurface.get("reviewed");
  const reportsId = tokenBySurface.get("reports");
  const supervisorsId = tokenBySurface.get("supervisors");
  assert.ok(reviewedId);
  assert.ok(reportsId);
  assert.ok(supervisorsId);

  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) { return r.label === "patient" && r.head.id === reviewedId && r.dep.id === reportsId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "agent" && r.head.id === reviewedId && r.dep.id === supervisorsId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "actor" && r.head.id === reviewedId && r.dep.id === reportsId; }),
    false
  );
  assert.equal(
    rels.some(function (r) { return r.label === "theme" && r.head.id === reviewedId && r.dep.id === supervisorsId; }),
    false
  );
});

test("runPipeline relations_extracted keeps sequential coordinated verbs structurally separated", async function () {
  const text = "It starts at a minimum value and tests each successive integer.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenBySurface = new Map(out.tokens.map(function (t) { return [String(t.surface || "").toLowerCase(), t.id]; }));
  const startsId = tokenBySurface.get("starts");
  const testsId = tokenBySurface.get("tests");
  const itId = tokenBySurface.get("it");
  const valueId = tokenBySurface.get("value");
  const integerId = tokenBySurface.get("integer");
  assert.ok(startsId);
  assert.ok(testsId);
  assert.ok(itId);
  assert.ok(valueId);
  assert.ok(integerId);

  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) { return r.label === "actor" && r.head.id === startsId && r.dep.id === itId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "actor" && r.head.id === testsId && r.dep.id === itId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "theme" && r.head.id === testsId && r.dep.id === integerId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "location" && r.head.id === startsId && r.dep.id === valueId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "theme" && r.head.id === startsId && r.dep.id === integerId; }),
    false
  );
});

test("runPipeline relations_extracted keeps comma-coordinated clause PP attached to starts (no at-headed theme)", async function () {
  const text = "It starts at a given minimum value, tests each successive integer for primality.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenBySurface = new Map(out.tokens.map(function (t) { return [String(t.surface || "").toLowerCase(), t.id]; }));
  const startsId = tokenBySurface.get("starts");
  const testsId = tokenBySurface.get("tests");
  const itId = tokenBySurface.get("it");
  const valueId = tokenBySurface.get("value");
  const integerId = tokenBySurface.get("integer");
  const atId = tokenBySurface.get("at");
  assert.ok(startsId);
  assert.ok(testsId);
  assert.ok(itId);
  assert.ok(valueId);
  assert.ok(integerId);
  assert.ok(atId);

  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) { return r.label === "location" && r.head.id === startsId && r.dep.id === valueId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "actor" && r.head.id === testsId && r.dep.id === itId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "theme" && r.head.id === testsId && r.dep.id === integerId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "theme" && r.head.id === atId && r.dep.id === valueId; }),
    false
  );
  assert.equal(
    rels.some(function (r) { return r.label === "coordination" && r.head.id === atId && r.dep.id === testsId; }),
    false
  );
});

test("runPipeline relations_extracted keeps inline multi-verb list coverage per predicate", async function () {
  const text = "Users can request changes, update reports, and assign supervisors.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenBySurface = new Map(out.tokens.map(function (t) { return [String(t.surface || "").toLowerCase(), t.id]; }));
  const usersId = tokenBySurface.get("users");
  const requestId = tokenBySurface.get("request");
  const changesId = tokenBySurface.get("changes");
  const updateId = tokenBySurface.get("update");
  const reportsId = tokenBySurface.get("reports");
  const assignId = tokenBySurface.get("assign");
  const supervisorsId = tokenBySurface.get("supervisors");
  assert.ok(usersId);
  assert.ok(requestId);
  assert.ok(changesId);
  assert.ok(updateId);
  assert.ok(reportsId);
  assert.ok(assignId);
  assert.ok(supervisorsId);

  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(rels.some(function (r) { return r.label === "actor" && r.head.id === requestId && r.dep.id === usersId; }), true);
  assert.equal(rels.some(function (r) { return r.label === "theme" && r.head.id === requestId && r.dep.id === changesId; }), true);

  assert.equal(rels.some(function (r) { return r.label === "actor" && r.head.id === updateId && r.dep.id === usersId; }), true);
  assert.equal(rels.some(function (r) { return r.label === "theme" && r.head.id === updateId && r.dep.id === reportsId; }), true);

  assert.equal(rels.some(function (r) { return r.label === "actor" && r.head.id === assignId && r.dep.id === usersId; }), true);
  assert.equal(rels.some(function (r) { return r.label === "theme" && r.head.id === assignId && r.dep.id === supervisorsId; }), true);
});

test("runPipeline relations_extracted anchors passive patient to factorization in prime-factorization clause", async function () {
  const text = "Prime factorization is commonly used in mathematics.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenBySurface = new Map(out.tokens.map(function (t) { return [String(t.surface || "").toLowerCase(), t.id]; }));
  const usedId = tokenBySurface.get("used");
  const primeId = tokenBySurface.get("prime");
  const factorizationId = tokenBySurface.get("factorization");
  assert.ok(usedId);
  assert.ok(primeId);
  assert.ok(factorizationId);

  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) { return r.label === "patient" && r.head.id === usedId && r.dep.id === factorizationId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "patient" && r.head.id === usedId && r.dep.id === primeId; }),
    false
  );
});

test("runPipeline relations_extracted suppresses fallback actor injection on clausal complement predicate in IRS chain", async function () {
  const text = "The Incident Reporting System (IRS) is used by employees to submit reports about safety issues, policy violations, or operational incidents.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenBySurface = new Map(out.tokens.map(function (t) { return [String(t.surface || "").toLowerCase(), t.id]; }));
  const usedId = tokenBySurface.get("used");
  const submitId = tokenBySurface.get("submit");
  const irsId = tokenBySurface.get("irs");
  const reportsId = tokenBySurface.get("reports");
  assert.ok(usedId);
  assert.ok(submitId);
  assert.ok(irsId);
  assert.ok(reportsId);

  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) { return r.label === "complement_clause" && r.head.id === usedId && r.dep.id === submitId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "theme" && r.head.id === submitId && r.dep.id === reportsId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "actor" && r.head.id === submitId && r.dep.id === irsId; }),
    false
  );
});

test("runPipeline relations_extracted suppresses to-nextVP noise but keeps actor signal on dep-linked take", async function () {
  const text = "The shop needs to make sure that items are actually available and the system can take payment and keep a record of the order.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenBySurface = new Map(out.tokens.map(function (t) { return [String(t.surface || "").toLowerCase(), t.id]; }));
  const needsId = tokenBySurface.get("needs");
  const makeId = tokenBySurface.get("make");
  const takeId = tokenBySurface.get("take");
  const systemId = tokenBySurface.get("system");
  assert.ok(needsId);
  assert.ok(makeId);
  assert.ok(takeId);
  assert.ok(systemId);

  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) { return r.label === "complement_clause" && r.head.id === needsId && r.dep.id === makeId; }),
    true
  );
  assert.equal(
    rels.some(function (r) { return r.label === "complement_clause" && r.head.id === needsId && r.dep.id === takeId; }),
    false
  );
  assert.equal(
    rels.some(function (r) { return r.label === "purpose" && r.head.id === needsId && r.dep.id === takeId; }),
    false
  );
  assert.equal(
    rels.some(function (r) { return r.label === "actor" && r.head.id === takeId && r.dep.id === systemId; }),
    true
  );
});

test("runPipeline relations_extracted keeps webshop are-carrier modifier/attribute edges for coverage stability", async function () {
  const text = "The shop needs to make sure that items are actually available and the system can take payment and keep a record of the order.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenById = new Map(out.tokens.map(function (t) { return [t.id, t]; }));
  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) {
      return String((tokenById.get(r.head.id) || {}).surface || "").toLowerCase() === "are" && r.label === "attribute";
    }),
    true
  );
  assert.equal(
    rels.some(function (r) {
      return String((tokenById.get(r.head.id) || {}).surface || "").toLowerCase() === "are" && r.label === "modifier";
    }),
    true
  );
});

test("runPipeline relations_extracted avoids copula-theme drift on webshop purchase clause", async function () {
  const text = "A WebShop is an online store where people can pick products they want to buy, put them into a shopping cart, and then complete the purchase by placing an order.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenById = new Map(out.tokens.map(function (t) { return [t.id, t]; }));
  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) {
      return r.label === "theme" &&
        String((tokenById.get(r.head.id) || {}).surface || "").toLowerCase() === "is" &&
        String((tokenById.get(r.dep.id) || {}).surface || "").toLowerCase() === "purchase";
    }),
    false
  );
  assert.equal(
    rels.some(function (r) {
      return r.label === "attribute" &&
        String((tokenById.get(r.head.id) || {}).surface || "").toLowerCase() === "is" &&
        String((tokenById.get(r.dep.id) || {}).surface || "").toLowerCase() === "store";
    }),
    true
  );
});

test("runPipeline relations_extracted avoids pronoun-headed location/topic artifacts in webshop s1", async function () {
  const text = "A WebShop is an online store where people can pick products they want to buy, put them into a shopping cart, and then complete the purchase by placing an order.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenById = new Map(out.tokens.map(function (t) { return [t.id, t]; }));
  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) {
      return (r.label === "location" || r.label === "topic") &&
        String((tokenById.get(r.head.id) || {}).surface || "").toLowerCase() === "them";
    }),
    false
  );
  assert.equal(
    rels.some(function (r) {
      return r.label === "theme" &&
        String((tokenById.get(r.head.id) || {}).surface || "").toLowerCase() === "put" &&
        String((tokenById.get(r.dep.id) || {}).surface || "").toLowerCase() === "them";
    }),
    true
  );
});

test("runPipeline relations_extracted keeps IRS copula attributes for is-valid and are-present clauses", async function () {
  const text = "Before a report is accepted, the system must verify that the selected category is valid and mandatory fields are present.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenById = new Map(out.tokens.map(function (t) { return [t.id, t]; }));
  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) {
      return String((tokenById.get(r.head.id) || {}).surface || "").toLowerCase() === "is" &&
        String((tokenById.get(r.dep.id) || {}).surface || "").toLowerCase() === "valid" &&
        r.label === "attribute";
    }),
    true
  );
  assert.equal(
    rels.some(function (r) {
      return String((tokenById.get(r.head.id) || {}).surface || "").toLowerCase() === "are" &&
        String((tokenById.get(r.dep.id) || {}).surface || "").toLowerCase() === "present" &&
        r.label === "attribute";
    }),
    true
  );
});

test("runPipeline relations_extracted keeps given as non-predicate monitor in prime_gen variant", async function () {
  const text = "It starts at a given minimum value, tests each successive integer for primality.";
  const out = await api.runPipeline(text, { target: "relations_extracted" });
  assert.equal(out.stage, "relations_extracted");

  const tokenById = new Map(out.tokens.map(function (t) { return [t.id, t]; }));
  const rels = out.annotations.filter(function (a) {
    return a.kind === "dependency" &&
      a.status === "accepted" &&
      Array.isArray(a.sources) &&
      a.sources.some(function (s) { return s && s.name === "relation-extraction"; });
  });

  assert.equal(
    rels.some(function (r) {
      return String((tokenById.get(r.head.id) || {}).surface || "").toLowerCase() === "given";
    }),
    false
  );
});
