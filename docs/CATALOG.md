# Catalog service contract

Listing Fixer handles 1–10 supplier products in the `listing-v1` schema and one target language, English. It creates a checked JSON/CSV file, a field diff with source provenance, and row-level issues. `ready` means the supplied fields passed this application's data checks. It is not a legal, GPSR, product safety, upstream truth, or marketplace approval decision.

## Input

Use [`samples/catalog.json`](../samples/catalog.json) or [`samples/catalog.csv`](../samples/catalog.csv). These contain synthetic supplier records. `supplier.example` links are examples; the service does not fetch them or claim external verification.

The canonical product fields are `sku`, `title`, `description`, `price`, `currency`, `manufacturer`, `safety`, `certification`, `sourceUrl`, and `sourceText`. Values are strings; JSON may use a finite numeric price. Missing optional source fields become empty strings and remain missing in the output. The envelope has `schema: "listing-v1"`, `language: "en"`, and `products`.

The importer recognizes a small fixed set of aliases: `item_code`/`product_id` → `sku`, `product_name`/`name` → `title`, `details` → `description`, `unit_price` → `price`, `maker` → `manufacturer`, `safety_note` → `safety`, `certificate` → `certification`, `source_url`/`url` → `sourceUrl`, `source_text`/`source_note` → `sourceText`. Conflicting aliases and unknown columns are rejected. It does not use a model to guess financial or safety columns.

SKU uniqueness is checked after whitespace and case normalization. Positive prices have at most two decimals; `24,90` and `24.90` both mean 2490 minor units. Thousands separators, currency symbols, scientific notation, negative/zero prices and fractional cents are rejected before a paid request. Supported currencies are EUR, USD, GBP and CHF. Missing prices remain `null` in `priceMinor`; missing currencies remain empty. They cannot be invented by the model.

A source URL must use HTTP(S) without embedded credentials. A supplied source URL is provenance provided by the user, not proof that its content was downloaded or verified. Source text is treated as untrusted data. No code, formulas, instructions, shell commands or model tool calls are executed.

## Free review and paid composition

`reviewCatalog(input)` is a deterministic, unpaid source review. It checks input, normalizes whitespace, formats existing prices and currency codes, and reports missing source fields. It does not call a model or create payment evidence.

`repairCatalog(input)` calls the local Ollama `qwen3:4b` model with structured output. The model makes a bounded editorial choice: it selects complete supplied specification clauses to append to the complete original product description. The model never has to reproduce that original text; the renderer preserves it by construction. For example, a source description `Solid oak desk organiser. Three compartments.` and an explicit source specification `Dimensions: 24 × 12 × 8 cm` can become `Solid oak desk organiser. Three compartments. Dimensions: 24 × 12 × 8 cm`. This promotes useful supplier details into the display description while preserving every original caveat.

The deterministic validator accepts only complete exact source parts. The renderer always preserves the complete original display field before appending selected parts; the model cannot delete a negation or omit an original safety caveat. Additional parts must come from explicit `sourceText` clauses separated with `|`, using a narrow syntax:

- `Material: solid oak` or other recognized basic materials.
- `Dimensions: 24 × 12 × 8 cm` with an explicit supported length unit.
- `Capacity: 500 ml`.
- `Pages: 96 ruled`.
- `Colour: natural` or another recognized colour.

Unknown prose stays attached to the source record. It is not promoted by the model. Protected claims involving price, currencies, manufacturer, certification, safety, compliance, guarantees, food or medical use are excluded from composable specification clauses. The model has no authority to modify the source price, currency, SKU, manufacturer, safety field, certification field, source URL or original source record. Missing manufacturer/safety/certification/price data remains empty and is marked `Needs source`.

Each accepted composition has `FieldDiff.source.parts` listing the exact source fields and text used. Unsupported model edits are rejected, the protected output stays unchanged, and the affected row is marked for review. Invalid JSON, unknown schema/SKU, malformed edits, HTTP failure and timeout fail the model operation. A successful model call is distinct from successful payment: payment receipt/status belongs to the payment layer.

## Runtime limits

Calls contain at most three products, run sequentially, use at most 1400 generated tokens and a 60-second timeout per chunk by default. A process-local queue permits at most three pending/running catalog operations. There is no automatic model retry and no model download or service restart. The model receives only catalog text and approved source candidates, never keys, wallet material, arbitrary tools or payment signing authority.

The model endpoint defaults to `http://127.0.0.1:11434`, configurable by `OLLAMA_URL`; model name is configurable by `OLLAMA_MODEL`. These are server configuration values, never model output or supplier input.

## Exports and checks

`server/catalog/index.ts` exports `parseCatalog`, `validateInput`, `reviewCatalog`, `repairCatalog`, `hashInput`, `toCsv`, `sourceParts`, `validateDraft`, and `CatalogError`. Public types are in `shared/catalog.ts`.

`toCsv(result, { readyOnly: true })` exports only rows passing this data check; the full export includes review statuses and issue messages. CSV cells that could be interpreted as spreadsheet formulas are prefixed with an apostrophe; JSON preserves the original supplied source text. The SHA-256 input digest includes schema/language and the exact source field bytes, so a changed price or source record changes the digest. A cosmetic sample flag does not change the digest.

Run meaningful validation cases with:

```sh
npx tsx --test tests/catalog.test.ts
```

Run a real local model preflight on two explicitly synthetic sample rows with:

```sh
npx tsx server/catalog/preflight.ts
```

The preflight writes the actual model draft, deterministic decisions, output and checks to `docs/evidence/catalog-llm.json`. It does not create a Cardano transaction and does not satisfy the paid-request qualification requirement.
