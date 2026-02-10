# linguistic-enricher

**linguistic-enricher** is a deterministic linguistic processing pipeline for Node.js that incrementally enriches plain text with structured linguistic information.

It takes raw text as input and produces a single, fully structured document that contains:

- a canonical text surface,
- sentence segmentation and tokenization,
- part-of-speech information,
- multi-word expressions (MWEs),
- shallow phrase structure (chunks),
- syntactic heads,
- and deterministic, token-level linguistic relations.

The pipeline is **library-first**, **schema-driven**, and **additive by design**.
It focuses strictly on *linguistic structure*, not domain logic, business rules, or normative interpretation.

---

## What this project is

`linguistic-enricher` is best described as a **linguistic enricher**:

- It **adds structure** to text.
- It does **not rewrite or reinterpret** the original text.
- It does **not apply domain semantics, rules, or policies**.
- It produces **reproducible, explainable results**.

The output is a single, incrementally enriched document that represents the linguistic state of the input text up to the level of accepted linguistic relations.

This makes the package suitable as:

- a preprocessing layer for downstream NLP systems,
- a compiler-like front end for controlled or structured language processing,
- or a general-purpose linguistic analysis engine embedded directly into Node.js applications.

---

## What this project is not

`linguistic-enricher` deliberately does **not**:

- perform business or domain reasoning,
- assert norms, obligations, or policies,
- infer facts beyond what is linguistically explicit in the text,
- or depend on any specific downstream framework or ontology.

The pipeline’s authoritative output ends at **linguistic relations**.
Anything beyond that (assertions, governance rules, domain models) belongs in a separate, downstream layer.

---

## Core principles

### Deterministic

Given the same input text and configuration, the pipeline produces the same output.
Probabilistic model output is treated as observational input only and is never accepted as authoritative truth.

### Additive

The text is enriched step by step.
Earlier structures are never removed or rewritten.
Later stages only add structure or precision.

### Anchored

All annotations are explicitly anchored to the canonical text using character spans, tokens, or segments.
There is no implicit or floating interpretation.

### Schema-driven

The output conforms to a single, evolving document schema that represents the complete linguistic enrichment state.

### Library-first

All functionality is available through a JavaScript API and can be embedded directly into any Node.js project.
A CLI is provided only as a thin wrapper around the same API.

---

## High-level pipeline overview

Conceptually, the pipeline performs the following transformations:

1. **Canonicalization**  
   A single authoritative text surface is established. All later offsets and annotations refer to this text.

2. **Segmentation and tokenization**  
   The text is segmented (typically into sentences) and tokenized into a stable token stream.

3. **Part-of-speech tagging**  
   Each token is enriched with grammatical category information.

4. **Multi-word expression detection and materialization**  
   Lexical units spanning multiple tokens are detected and deterministically materialized as authoritative MWEs.

5. **Shallow parsing (chunking)**  
   Tokens are grouped into flat syntactic phrases (e.g. noun phrases, verb phrases).

6. **Head identification**  
   Each phrase receives exactly one deterministic syntactic head token.

7. **Relation extraction**  
   Token-level linguistic relations are derived deterministically and stored as accepted relations.

Relations represent **linguistic predicate–argument structure**, not conceptual, ontological, or domain semantics.

The result is a fully enriched linguistic document with stable structure and traceable provenance.

---

## Input and output

### Input

The minimal input is plain text:

```js
const text = `
A webshop is an online store where customers can select products,
place them in a cart, and complete a purchase.
`;
```

Optionally, a partially enriched document that already conforms to the schema may be provided to resume processing.

---

### Output

The output is a single JavaScript object representing the enriched document.

It includes:

- the canonical text,
- segments and tokens with stable spans,
- annotations for MWEs, chunks, and heads,
- and accepted token-level relations.

The output is designed to be:

- machine-readable,
- human-inspectable,
- and suitable for downstream processing.

---

## Usage as a library

```js
const { runPipeline } = require("linguistic-enricher");

const result = await runPipeline(text, {
  target: "relations_extracted"
});

console.log(result.stage);
```

The library API is the primary interface.
File I/O, serialization, and CLI concerns are intentionally kept outside the core logic.

---

## Current maturity and semantic parity

This package currently provides a stable baseline implementation of the full 00..11 pipeline surface.

- Baseline orchestration, validation hooks, CLI/API integration, and deterministic utilities are implemented and tested.
- Stage-by-stage linguistic parity hardening against the intended semantic baseline is still in progress.
- The legacy semantic corpus is treated as a semantic reference only, not as a technical implementation template.

---

## Optional external services

### Lexical signals (Wikipedia title index)

Some enrichment stages optionally use **lexical signals provided by a Wikipedia title index service**.

This service is expected to expose the HTTP API of
[`wikipedia-title-index`](https://www.npmjs.com/package/wikipedia-title-index) and provides deterministic
title-based lookup signals (exact matches, prefix counts, and variant matches).

`linguistic-enricher` does **not** embed or bundle this data.
Instead, an external service endpoint can be configured:

```js
await runPipeline(text, {
  services: {
    "wikipedia-title-index": {
      endpoint: "http://localhost:3000"
    }
  }
});
```

If no endpoint is configured, all enrichment stages that depend on lexical title signals run deterministically without those signals.

---

## Python runtime integration

Some enrichment stages rely on established Python-based NLP tooling (for example for part-of-speech tagging and dependency analysis).

This tooling is handled internally:

- Python is invoked as a subprocess.
- Communication uses JSON over stdin/stdout only.
- Consumers of the Node.js API do not interact with Python directly.

A built-in runtime check (`doctor`) can be used to verify Python availability and required dependencies.

---

## CLI (optional)

A command-line interface is provided for convenience:

```bash
npx linguistic-enricher run --in input.txt --out result.json
npx linguistic-enricher run --text "A webshop is an online store." --target canonical --pretty
npx linguistic-enricher validate --in result.json
npx linguistic-enricher doctor
```

The CLI is a thin wrapper around the same library API and is fully cross-platform.

---

## Design boundary

`linguistic-enricher` intentionally produces authoritative output only up to **linguistic relations**.

The underlying document schema is forward-compatible and may include later enrichment stages, but this package itself does **not** generate normative assertions, obligations, or domain-level interpretations.

This boundary keeps the project:

- reusable,
- framework-agnostic,
- and stable as a foundational linguistic layer.

---

## License

MIT
