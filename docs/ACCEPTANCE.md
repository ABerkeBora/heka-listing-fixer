# Buyer acceptance and delivery binding

V2 serves `/next` and `/api/next` beside V1. The same catalog engine and exact Cardano payment implementation are shared; V2 jobs, payment intents, executor roles and browser pointers are isolated.

Before the first delegation the buyer chooses an integer `minimumReadyProducts` from1through the batch size and a nonempty unique subset of `title` and `description`. These choices cannot authorize edits to protected facts. A disallowed display field retains its exact source bytes, including whitespace; model prompts and the renderer both honor the selected subset. Missing source fields remain missing.

## Hashes and immutable order

SHA-256 is applied to UTF-8 canonical JSON. `shared/acceptance.ts` defines the browser-safe strings; the browser uses WebCrypto and the server uses Node crypto.

- `inputHash`: unchanged V1 canonical schema/language/source fields in fixed order; sample metadata is excluded.
- `acceptanceHash`: fixed schema, minimum and title-before-description array order. Unknown keys, duplicate fields and protected fields are rejected.
- `orderHash`: fixed `listing-order-v2` schema + inputHash + acceptanceHash. Same source/condition is one order; a changed condition is a separate order.
- `resultHash`: exact serialized bare CatalogResult, preserving the V1 JSON.stringify convention.

The first job stores all conditions and hashes before execution. The mandate fixes acceptanceHash/orderHash, seller, endpoint, beneficiary, integer service/network/API/total caps, expiry and one action. The x402 quote carries input/acceptance/order in `extensions['listing-acceptance'].info`. The resource URL names this order. Quote and mandate checks reject mutations before signing; cached quote metadata is rechecked before settlement. Duplicate requests retain the original mandate, bytes, receipt and result; a changed budget cannot replace them.

These are application records, not commitments embedded in the Cardano transaction body. The direct transaction commits the recipient, amount, fee, inputs and validity interval. The delivery manifest binds those chain facts to the application source/result evidence.

## Actual execution order

1. Validate source/policy and persist one order plus bounded mandate.
2. Fetch/validate the actual x402 quote, build and inspect the complete signed preprod transaction, persist its bytes/hash before any submission request.
3. The facilitator verifies the authorization. Verification does not broadcast the transaction.
4. Run the real local model. Apply source-bound rendering and the unchanged useful-output guard. Cache the result privately.
5. Recompute deterministic acceptance from original source and delivered rows, including protected facts/provenance, allowed fields, honest status counters and minimum ready count.
6. On failure persist `acceptance_not_met`, send no settlement request, expose no paid result or paid export. The existing signature is never retried. A new order cannot use that wallet while any unresolved signed payment remains valid. A zero-settlement terminal rejection releases the local wallet lock only after its actual signed TTL plus30seconds.
7. On success checkpoint the local settlement-call counter, then call the facilitator with exactly the persisted signed bytes. Require a matching confirmed preprod receipt with a numeric canonical confirmation count.
8. Create one delivery manifest binding policy/decision/input/acceptance/order/result/transaction/exact receipt. Recompute hashes and validate mandate/quote/receipt in the browser before showing paid delivery or exports.

The counter records local SDK settlement invocations, persisted immediately before the call. A process loss in that tiny interval may conservatively count an attempted invocation; it does not measure the hosted facilitator's internal broadcast count. Reconciliation can call settlement again with the same bytes, never a new charge. The successful recorded V2 case has one signature and one local call. The rejected case has zero local calls and independently observed unspent inputs after TTL expiry.

## Trust and operations

This is a local application acceptance policy, not an on-chain quality adjudicator, escrow or refund contract. The supplier remains responsible for source truth. A confirmed direct payment and its network fee cannot be reversed by later evaluation. The model never receives wallet keys or arbitrary transaction tools. Two local test roles and a synthetic catalog are technical evidence, not a production customer or revenue claim.

Preserve both V1 databases and both V2 databases, including WAL files and ignored signed checkpoints. Never clear them to retry a pending charge. The V2 wallet is `.local/v2/cardano-wallets.json` mode0600; environment role overrides used by V1 cannot silently substitute it. On a fresh clone provide your own small preprod funds; no automatic top-up or real-value spend is allowed.
