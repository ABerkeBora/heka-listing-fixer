# Listing Fixer

Source-bound catalog repair for small ecommerce teams. A buyer agent hires one fixed catalog service with a short-lived budget, pays a Cardano preprod x402 request, and receives a checked catalog, field diffs and source references.

**Live preprod request confirmed:** [transaction1305799c…66dc0](https://preprod.cardanoscan.io/transaction/1305799c411826f9f8463db3b9067913db0286da42320a2297c265aafcd66dc0),2 tADA service +0.168581 tADA network fee. The paid10-product result, receipt, independent chain checks and restart recovery are saved in [evidence](docs/evidence/VERIFICATION.md). A source preview is free and never payment evidence.

[Open paid result locally](http://127.0.0.1:3107/?job=batch_3335c09a068c20633a3c8e1c) · [Morning handoff](MORNING_HANDOFF.md) · [Track requirements](TRACK_REQUIREMENTS.md) · [Paid result](docs/evidence/payment-live-result.json)

## Run locally

Requires Node.js 24+ and npm. No parent repository or hosted deployment is needed.

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
