# Cardano payment boundary

Listing Fixer uses the official x402 Cardano `exact` SDK and resource-server primitives. It follows the official [Express starter](https://developers.cardano.org/templates/x402-express/) with an explicit Express handler so that payment state is durable and a transaction is bound to exactly one catalog intent. Only **Cardano preprod, lovelace, direct address payments** are enabled. No contracts are deployed for this flow.

## Current live status

`docs/evidence/payment-preflight.json` records the actual check. The hosted Cardano Foundation facilitator is reachable and supports the selected scheme. The buyer can read preprod UTXOs through public Koios without a Blockfrost key. Both distinct test wallets were generated locally; the buyer has **0 lovelace** at the recorded check. No qualifying paid request, confirmed receipt, seller proceeds or paid result exists yet.

The official Cardano faucet requires a human reCAPTCHA; the inspected widget also displayed a free-quota warning. It was not solved or bypassed. The official Masumi dispenser requires a registration verification code, which is unavailable. These are access blockers, not test failures disguised as payments. Blockfrost is an optional provider for this buyer; it is no longer the blocking dependency.

## Roles and bought result

- Payer: the catalog owner's bounded buyer agent, holding a separate preprod test wallet.
- Recipient: the fixed Listing Fixer seller address, a distinct wallet role.
- Bought result: source-bound repair of at most ten products, English target schema, field changes, checked JSON/CSV and deterministic validation report.
- Economic action: after one initial user delegation, the agent selects this matching service, accepts its fixed 2 tADA offer, builds and signs the payment, and requests settlement without an extra manual payment click.

The seller receives exactly `2000000` lovelace in the signed output. The buyer additionally pays the transaction's exact network fee; it is inspected from the signed CBOR before submission. The service price, network fee and total cap are separate integer strings. There is no product collateral. A separately charged facilitator/API fee is not quoted by the hosted service and is displayed as unknown, never invented as zero. Local Ollama requires no external paid API call. The mandate explicitly authorizes **zero extra API charges**; missing or nonzero API fee caps are rejected.

## Mandate

`PaymentMandate` in `server/payment/policy.ts` pins network, asset, seller, exact batch endpoint, beneficiary, service cap, network fee cap, a required `apiFeeCapLovelace: '0'`, total cap, expiry, and one logical action. The UI defaults are 2 tADA service + 0.5 tADA maximum network fee = 2.5 tADA maximum total. The reproducible CLI scenario deliberately uses a tighter 0.3 tADA fee / 2.3 tADA total cap. The product has an additional hard test ceiling of 5 tADA service, 1 tADA fee, 6 tADA total, and a maximum 30-minute delegation.

Limits are enforced by the application validator and the resulting complete signed transaction. They are **not an on-chain wallet budget or smart-contract allowance**. The server-side wallet is for a small isolated test budget; this product does not implement general session keys or account abstraction.

The model receives catalog data only. It cannot read keys, select a new recipient, asset or network, supply arbitrary calldata, or invoke wallet tools. The signer validates the exact transaction's recipient outputs, service amount, change address, native assets, nonce, signatures, TTL and fee before any signed payment is submitted.

## Lifecycle and retries

1. Root validates catalog syntax/limits before any paid request.
2. `prepare({intentId,inputHash,mandate})` commits the delegation. SQLite uniquely binds input hash and intent.
3. `execute(intentId)` fetches the protected batch endpoint and validates its real x402 402 challenge.
4. Official signer constructs the complete payment. A deterministic inspection enforces the caps and exact outputs. The signed payload, nonce, canonical transaction hash and exact network fee are committed **before network submission**.
5. The buyer sends `PAYMENT-SIGNATURE`. Seller checks the exact offer/resource and binds the transaction hash uniquely to that intent. The official facilitator verifies it.
6. Seller creates and privately caches the useful catalog result. It must match the input hash, paid service and product counts, and include an actual model call with at least one accepted source composition, with an actual diff adding a supplied source-text detail that was absent from the original field. Invalid, failed or entirely unhelpful model work does not invoke settlement.
7. The facilitator settles the same signed bytes. Only a valid receipt for the exact hash and preprod network, with `status=confirmed` and integer `confirmations>=1`, releases the result.
8. Receipt/input/intent/result are returned together. Root permits exports only for a confirmed paid job.

The per-intent queue covers seller verification, generation and settlement, preventing overlapping proof retries from overwriting newer state or running the model twice. The buyer serializes execution and refuses another payment while an older signed intent remains unresolved. SQLite keeps the signed bytes and transaction binding across restarts. Do not delete the database to retry a payment.

A timeout, network error or process restart never causes a fresh signature for an existing signed intent. `reconcile(intentId)` replays the exact stored proof, and the SDK's settlement retry observes the same transaction. If no payload was signed, reconcile records that no payment exists and does not initiate payment. A fresh explicit initial delegation may replace an **unsigned** attempt; it may not replace signed bytes. A definitive rejection also retains the signed tombstone rather than quietly paying again.

Expired unsigned delegations cannot pay. Signed transaction TTL is no later than the mandate expiry; retrying expired bytes cannot create a new valid payment. If the original result cannot be reconciled, stop and inspect that hash. No automatic top-up or replacement payment exists.

## Trust and recovery

The direct-address flow has no escrow, on-chain quality adjudicator or automatic refund. Resource validation runs before settlement, and the result is held until confirmation, but a genuine settlement may still have spent service price and network fee even when a later HTTP response is lost. Do not describe a receipt timeout as a refund or as zero spend.

The hosted facilitator supplies settlement evidence; public Koios provides the buyer's chain data. An authenticated facilitator receipt does not prove that upstream catalog facts are true. The catalog validator conservatively rejects unsupported claims, while supplied sources remain the user's responsibility. Cardano confirmations have probabilistic finality.

The source/request binding is an application-level mapping of intent + input hash + exact endpoint + canonical transaction hash, persisted locally. The default address payment does not put the input/output hashes into an escrow datum or adjudicate product quality on chain.

## API for the main server

```ts
const payment = createPaymentService({
  dbPath: 'data/payment.sqlite',
  resourceBaseUrl: 'http://127.0.0.1:3107',
  onResource: async (intentId, inputHash) => bareCatalogResult,
});
app.get('/api/service/jobs/:id', payment.sellerMiddleware, payment.sellerHandler);
```

`readiness(force?)` is asynchronous and returns public addresses, actual buyer balance, provider, blockers and price. `prepare` is synchronous; `execute` and `reconcile` are asynchronous. `publicIntent` returns no private key or signed payload; it exposes a result only after confirmed receipt. `hasSignedPayload` tells orchestration whether retry must reconcile. `sellerAddress`, `buyerAddress` and `endpoint(id)` expose pinned public configuration.

Statuses: `ready`, `quoting`, `quoted`, `signing`, `signed`, `payment_pending`, `confirmed`, `blocked`, `rejected`, `processing_failed`, `receipt_unresolved`.

## Setup and live completion

```sh
npm run cardano:wallets
npm run cardano:preflight
```

Wallet generation is idempotent. It stores credentials only in ignored `.local/cardano-wallets.json` with mode `0600`; only public addresses print. Optional `.env` variables are `CARDANO_WALLET_FILE`, `CARDANO_BUYER_MNEMONIC`, `SELLER_ADDRESS`, `BLOCKFROST_PROJECT_ID`. The provider and facilitator are pinned to preprod. Never paste mnemonic/private keys into chat, logs, screenshots or model prompts.

Fund the printed buyer address with 5 **test ADA on preprod** (funding reserve, not the service charge; excess remains in the buyer change output), complete the official faucet's human challenge, wait for UTXOs, refresh the connection check, and start one fresh catalog delegation in the app. Save its actual transaction, seller output and result. Until that succeeds, Cardano qualification and the real delegated economic action remain **BLOCKED**.

## Verification

`tests/payment-policy.test.ts` checks budgets, wrong seller/network/resource, expiry, fee and output tampering, invalid signatures/nonce, weak or mismatched receipt, SQLite restart persistence and duplicate transaction/input binding. `tests/payment-service.test.ts` checks unsigned recovery, exact-proof retry after timeout, duplicate intent behavior, and concurrent wrong-request rejection without result execution or protected state mutation. Synthetic unit fixtures are labeled and are not live chain evidence.

The reference starter pins x402 2.26.0. This project pins the compatible 2.29.0 releases and Express 5.3.0 after an npm audit identified a vulnerable transitive validation dependency in the older release. API typechecking and the payment tests were rerun after upgrading; package-lock.json records exact versions.

The read-only preflight reports setup prerequisites separately from qualification. It does not assess or overwrite a completed payment record; `payment-live.json` and its matching receipt/result remain the authoritative run evidence. A later low wallet balance does not invalidate a previously completed job.
