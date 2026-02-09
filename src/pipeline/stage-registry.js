"use strict";

const surfaceNormalization = require("./stages/surface-normalization");
const canonicalization = require("./stages/canonicalization");
const segmentation = require("./stages/segmentation");
const tokenization = require("./stages/tokenization");
const posTagging = require("./stages/pos-tagging");
const mweCandidateExtraction = require("./stages/mwe-candidate-extraction");
const mweCandidateConstruction = require("./stages/mwe-candidate-construction");
const mweMaterialization = require("./stages/mwe-materialization");
const linguisticAnalysis = require("./stages/linguistic-analysis");
const chunking = require("./stages/chunking");
const headIdentification = require("./stages/head-identification");
const relationExtraction = require("./stages/relation-extraction");

/**
 * Canonical ordered stage list (prototype 00..11).
 * Each stage is mapped to a semantic target and module path.
 * @type {ReadonlyArray<{index:number, prototypeStage:string, target:string, modulePath:string, runStage:function}>}
 */
const STAGES = Object.freeze([
  {
    index: 0,
    prototypeStage: "00",
    target: "__internal_precanonical__",
    modulePath: "./stages/surface-normalization",
    runStage: surfaceNormalization.runStage
  },
  {
    index: 1,
    prototypeStage: "01",
    target: "canonical",
    modulePath: "./stages/canonicalization",
    runStage: canonicalization.runStage
  },
  {
    index: 2,
    prototypeStage: "02",
    target: "segmented",
    modulePath: "./stages/segmentation",
    runStage: segmentation.runStage
  },
  {
    index: 3,
    prototypeStage: "03",
    target: "tokenized",
    modulePath: "./stages/tokenization",
    runStage: tokenization.runStage
  },
  {
    index: 4,
    prototypeStage: "04",
    target: "pos_tagged",
    modulePath: "./stages/pos-tagging",
    runStage: posTagging.runStage
  },
  {
    index: 5,
    prototypeStage: "05",
    target: "mwe_candidates",
    modulePath: "./stages/mwe-candidate-extraction",
    runStage: mweCandidateExtraction.runStage
  },
  {
    index: 6,
    prototypeStage: "06",
    target: "mwe_pattern_candidates",
    modulePath: "./stages/mwe-candidate-construction",
    runStage: mweCandidateConstruction.runStage
  },
  {
    index: 7,
    prototypeStage: "07",
    target: "parsed",
    modulePath: "./stages/mwe-materialization",
    runStage: mweMaterialization.runStage
  },
  {
    index: 8,
    prototypeStage: "08",
    target: "chunked",
    modulePath: "./stages/linguistic-analysis",
    runStage: linguisticAnalysis.runStage
  },
  {
    index: 9,
    prototypeStage: "09",
    target: "heads_identified",
    modulePath: "./stages/chunking",
    runStage: chunking.runStage
  },
  {
    index: 10,
    prototypeStage: "10",
    target: "heads_identified",
    modulePath: "./stages/head-identification",
    runStage: headIdentification.runStage
  },
  {
    index: 11,
    prototypeStage: "11",
    target: "relations_extracted",
    modulePath: "./stages/relation-extraction",
    runStage: relationExtraction.runStage
  }
]);

/**
 * Authoritative public pipeline target literals.
 * @type {readonly string[]}
 */
const PIPELINE_TARGETS = Object.freeze([
  "canonical",
  "segmented",
  "tokenized",
  "pos_tagged",
  "mwe_candidates",
  "mwe_pattern_candidates",
  "mwe_materialized",
  "parsed",
  "chunked",
  "heads_identified",
  "relations_extracted"
]);

/**
 * Validate a target literal.
 * @param {string} target Target literal.
 * @returns {boolean} True when target is valid.
 */
function isValidTarget(target) {
  return PIPELINE_TARGETS.indexOf(target) !== -1;
}

/**
 * Resolve ordered stages needed to reach a target.
 * @param {string} target Target literal.
 * @returns {ReadonlyArray<object>} Ordered stage descriptors.
 */
function resolveStagesUpToTarget(target) {
  if (!isValidTarget(target)) {
    throw new Error("Invalid pipeline target: " + String(target));
  }

  if (target === "relations_extracted") {
    return STAGES;
  }

  let index = -1;
  for (let i = 0; i < STAGES.length; i += 1) {
    if (STAGES[i].target === target) {
      index = i;
      break;
    }
  }

  if (index === -1) {
    throw new Error("No stage mapped for target: " + String(target));
  }

  return STAGES.slice(0, index + 1);
}

/**
 * Build ordered stage registry for internal 00..11 execution.
 *
 * Intended behavior: map semantic targets to ordered stage handlers.
 * @returns {object} Stage registry metadata.
 */
function createStageRegistry() {
  return {
    stages: STAGES,
    targets: PIPELINE_TARGETS
  };
}

module.exports = {
  STAGES,
  PIPELINE_TARGETS,
  createStageRegistry,
  isValidTarget,
  resolveStagesUpToTarget
};
