# Evidence boundaries

The completed paid scenario is transaction [1305799c…66dc0](https://preprod.cardanoscan.io/transaction/1305799c411826f9f8463db3b9067913db0286da42320a2297c265aafcd66dc0) on Cardano preprod. All files below describe actual runs unless explicitly identified as unit fixtures or earlier setup history.

- `payment-live.json` and `payment-1305799c…json`: confirmed x402 receipt, original bounded mandate, input/intent/transaction/result binding,10-product delivery.
- `payment-live-result.json`: actual paid model result,10 accepted compositions,5ready/5needs source, protected facts retained.
- `payment-chain.json`: independent public Koios/CBOR verification,13 checks PASS. Seller2000000lovelace, fee168581, buyerchange9997831419, exact value conservation and newer canonical blocks.
- `delivery-verification.json`:53 checks PASS against source bytes, money/facts, provenance and actual paid JSON/CSV/report exports.
- `payment-restart.json`: controlled application stop before receipt, observed connection loss, recovery with the same signed hash, one signature, duplicate POST unchanged.
- `payment-policy-live.json`: actual quote accepted, reduced budget and changed recipient rejected locally before signing; no new economic action, protected state unchanged.
- `payment-preflight.json`: latest real provider/balance/facilitator setup check. It does not assess qualification or overwrite paid-run evidence.
- `payment-challenge.json`: original unsigned x402 challenge; setup/protocol evidence rather than a completed payment.
- `catalog-llm-full.json`: earlier unpaid10-product real local model preflight; `catalog-llm.json` earlier two-product call; rejected attempt preserved separately. These are not paid receipts.
- `tests.txt`, `build.txt`:37 passing tests and production build. `dependency-audit.json`:0 known dependency advisories at the check.
- `browser-paid-qa.json`, `ui-paid-*.jpg`: actual confirmed paid UI at desktop,tablet,phone, with precise fee/transaction/source data. Earlier `browser-qa.json` and images show unpaid and funding-blocked states.
- `server-checks.json`: actual HTTP input, origin, missing-composition and export guards. Unit fixtures in `tests/` are synthetic and never chain history.
- `publish-scan.json`: actual isolated wallet recovery phrases compared against staged public files without printing values; private local state excluded.

No contract is deployed for this direct-address flow. Budget caps live in the local executor and signed-transaction policy. There is no escrow or automatic refund. Official video/Devfolio submission remain separate from the approved build delivery's150-second outline and submission draft.
