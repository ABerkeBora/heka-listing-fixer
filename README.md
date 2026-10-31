# Listing Fixer

Source-bound catalog repair for small ecommerce teams. A buyer agent hires one fixed catalog service with a short-lived budget, pays a Cardano preprod x402 request, and receives a checked catalog, field diffs and source references.

**Live preprod request confirmed:** [transaction1305799c…66dc0](https://preprod.cardanoscan.io/transaction/1305799c411826f9f8463db3b9067913db0286da42320a2297c265aafcd66dc0),2 tADA service +0.168581 tADA network fee. The paid10-product result, receipt, independent chain checks and restart recovery are saved in [evidence](docs/evidence/VERIFICATION.md). A source preview is free and never payment evidence.

[Open paid result locally](http://127.0.0.1:3107/?job=batch_3335c09a068c20633a3c8e1c) · [Morning handoff](MORNING_HANDOFF.md) · [Track requirements](TRACK_REQUIREMENTS.md) · [Paid result](docs/evidence/payment-live-result.json)

## Buyer acceptance — V2

Open [the acceptance workbench](http://127.0.0.1:3107/next). The original [V1 workbench](http://127.0.0.1:3107/) and paid receipt remain intact; the immutable [`v1-baseline`](https://github.com/ABerkeBora/heka-listing-fixer/tree/v1-baseline) tag records commit `4bb9d5b`. V2 source lives on [`codex/next`](https://github.com/ABerkeBora/heka-listing-fixer/tree/codex/next).

**V2 live proof:** [confirmed new transaction](https://preprod.cardanoscan.io/transaction/7869104649f7723510e722ce0621078e81daf7fc6b4d9cb535d3fbebb19a21b2) —2tADA service +0.168405tADA network fee, one signature/one settlement. [Open the paid V2 result](http://127.0.0.1:3107/next?job=next_79721f59050ed46dc6cccef5de7394df) · [Open the unpaid six-ready rejection](http://127.0.0.1:3107/next?job=next_686079ceccc9fc622b09a8970793e65a). Independent chain, acceptance, delivery and retry proofs live in [V2 evidence](docs/evidence/v2/).

Before delegation, the buyer fixes a **minimum ready product count** and whether the service may edit **title, description, or both**. A canonical SHA-256 acceptance hash binds those conditions to the source, quote, mandate and intent. The source-bound model and existing useful-output check run first. The deterministic acceptance check then runs **before the facilitator settlement call**. An insufficient result stays unpaid and is labeled “Acceptance not met”. A successful delivery binds the exact source, acceptance, result hash and confirmed receipt in one downloadable manifest, checked again by the browser.

The policy is enforced by this local application. It is not a ledger-enforced quality condition, escrow or automatic refund. A signed authorization may exist before the check; it is not a broadcast or a collection. A rejected authorization is never retried, and a new order cannot reuse its wallet inputs until the signed transaction expires plus a30-second safety margin. Confirmed payments remain final under the direct-payment trust model.

V2 uses `/api/next`, `data/v2-jobs.sqlite`, `data/v2-payment.sqlite`, `.local/v2/cardano-wallets.json` and its own browser storage namespace. The unchanged catalog and payment validators are shared. Same source + same condition resolves to one intent; a different condition is a distinct order. Existing mandates cannot be changed by retrying with another budget.

```sh
npm run v2:wallets
npm run v2:fund
```

The funding command defaults to a plan. In the prepared local workspace, an isolated10testADA setup transfer is already recorded; reruns only reconcile that saved hash. On a fresh clone, fund the printed V2 buyer through the preprod faucet, or explicitly execute the fixed small setup transfer from this project's own funded V1 test wallet with `npm run v2:fund -- --execute`. Secrets and signed checkpoints remain ignored. Generate/fund wallets before `npm start`, or restart the app after first provisioning. No automatic top-up occurs.

```sh
npm run v2:run -- --reject  # fixed six-ready rule; real model, no settlement
npm run v2:verify-rejection # after the rejected authorization expires +30seconds
npm run v2:run              # fixed five-ready rule; distinct real paid order
npm run v2:verify-chain
npm run v2:verify-delivery
npm run v2:policy-proof
npm run v2:v1-regression
```

The shipped synthetic sample has five schema-ready products and five source gaps. The no-settlement script captures the unspent-input snapshot **after rejection expiry and before the successful order spends those same inputs**. Its historical PASS is retained if a later observation finds the inputs spent by subsequent work. Never delete SQLite or signed intents to retry. See [V2 handoff](MORNING_HANDOFF_V2.md), [current Goal](NEXT_GOAL_STATUS.md) and [V2 track mapping](TRACK_REQUIREMENTS_V2.md) for actual run evidence and limitations.

## Run locally

Requires Node.js 24+ and npm. For V2, clone/check out the `codex/next` branch; the `v1-baseline` tag preserves V1. No parent repository or hosted deployment is needed.

```sh
npm ci
cp .env.example .env
npm run build
npm start
```

Open [127.0.0.1:3107](http://127.0.0.1:3107). The server binds only to the loopback address and rejects cross-site requests. `npm run dev` starts the source build while developing; `npm run build` checks TypeScript and produces the production client.

For the paid catalog service, run an existing local Ollama installation with `qwen3:4b` at `http://127.0.0.1:11434`. The application does not download models or restart a shared model service. Free source review works while model or payment access is unavailable.

## Try a fresh catalog

1. Load the supplied 10-product sample, or paste JSON/CSV using the [documented columns](docs/CATALOG.md).
2. Choose **Review catalog**. This checks the input without a payment, preserves prices and source facts, and identifies missing information.
3. Inspect a product's source and changes. “Ready” means it passes this schema's checks; source truth and legal compliance are not certified.
4. With a funded isolated buyer wallet and supplied source specifications, authorize one short-lived catalog mandate. The buyer agent validates the fixed seller, quote, fee and expiry, then signs the payment and requests the model service without a separate payment click.
5. Download the checked JSON/CSV and report after the receipt and result are matched. Rows missing source information stay out of the ready-only export. If no useful extra source composition is available, the paid service rejects the job rather than charging for free lint.

The supplied catalog is explicitly synthetic sample data with `.example` source references. It is not an assertion about real goods, customers, certifications or manufacturer statements.

## Cardano preprod payment

See [payment setup and trust boundaries](docs/PAYMENTS.md). Only test ADA (`lovelace`) on Cardano preprod is allowed. Buyer and seller are separate wallets. The service price is **2,000,000 lovelace (2 tADA)** per batch, with a separate network fee cap; the default delegated total is 2,500,000 lovelace. The exact signed fee is inspected before any transaction is released.

Wallet secrets remain in an ignored local file with mode `0600`, never in the browser, source catalog or model request. The seller uses only a receiving address. This is a local server-side funded-wallet executor with application-enforced caps, not a new on-chain session wallet or escrow. Revoke the agent by stopping the app and removing its isolated test funds/secret.

The official x402 Cardano scheme signs a complete transaction, verifies the authorization, prepares the resource, and settles through the facilitator. Cached unpaid results are not exposed by the application. A signed transaction and its hash are persisted before submission; reconciliation reuses that payload and cannot sign a fresh charge for the same input. See payment tests for the exact implemented boundary.

Direct address payments do not provide automatic refunds or an on-chain quality adjudicator. A confirmed service payment and network fee cannot be undone by a later catalog review. The service fails closed on unsupported payment terms, an invalid draft, missing data or unresolved receipt. Cardano finality is probabilistic; the configured confirmation policy requires at least one newer canonical block.

## Validation

```sh
npm test
npm run build
npm run cardano:verify
npm run cardano:policy-proof
npm run verify:delivery
```

[Evidence](docs/evidence/) records what was actually run. [Presentation outline](PRESENTATION.md) fits 2.5 minutes; [submission draft](SUBMISSION_DRAFT.md) is prepared text only. No competition entry is submitted by this repository.

## Architecture

- `client/`: catalog workbench, source/diff review and bounded delegation.
- `server/catalog/`: strict input parser, source-preserving validation, bounded local model call and exports.
- `server/payment/`: x402 quote/transaction policy, separate buyer signer, seller handler and durable payment reconciliation.
- `server/store.ts`: persistent input/job/result binding in SQLite; cached unpaid resources are hidden from public job responses.
- `data/` and `.local/`: ignored local state. Preserve payment history when trying a fresh sample; do not delete it to “retry”.

Track: [Cardano — Agentic Commerce on Cardano](https://hackathon.tum-blockchain.com/prizes#cardano). This project uses the [official x402 Express path](https://developers.cardano.org/templates/x402-express/), not the API3 or BSV tracks. License: MIT.
