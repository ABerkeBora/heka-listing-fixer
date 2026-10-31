# Listing Fixer

## Problem

Small ecommerce teams receive product information in inconsistent supplier files. Cleaning a catalog can accidentally alter prices, lose source references, or fill missing manufacturer and safety claims with plausible text. Teams need a checked import file and a clear list of source gaps.

## What we built

Listing Fixer is a local catalog workbench for batches of up to ten products. It imports CSV or JSON into one English schema, preserves source facts, validates money and identifiers, and exposes field-level source/diff evidence. A bounded local model produces a catalog draft; deterministic checks control what can be accepted. Missing protected facts remain missing and are excluded from ready-only export.

A buyer agent can hire the fixed Listing Fixer seller through an x402 paid request on Cardano preprod. One initial mandate fixes the network, asset, seller, endpoint, beneficiary, service cap, exact network fee cap, expiry and maximum action count. The model has no wallet or arbitrary transaction authority. A durable intent links source input, quote, signed transaction, receipt and delivered catalog. In V2, the buyer also fixes a minimum ready count and allowed display-edit fields before delegation. A canonical acceptance hash is bound to source, quote and mandate. The model result passes deterministic source/usefulness checks and buyer acceptance before settlement. Rejected work receives no settlement request; a successful delivery manifest binds acceptance, input, result and the exact confirmed receipt. V1 remains preserved at the v1-baseline tag.

## Cardano tools and economic flow

The implementation follows the Cardano Foundation x402 Express starter and uses `@x402/cardano`, `@x402/core`, the Evolution SDK and the hosted preprod facilitator. Koios is the SDK-supported free chain provider alternative; a Blockfrost project can also be configured. Buyer and seller are separate roles. The customer buys a source-bound catalog result for a fixed per-batch price, not a cosmetic transfer.

Direct address payments provide no automatic refund or on-chain quality decision. Confirmation is probabilistic, source truth is inherited from the supplier, and the funded local executor enforces delegation caps in application code.

## Current evidence — use the final V2 handoff

- Public repository: https://github.com/ABerkeBora/heka-listing-fixer
- Live paid preprod transaction: https://preprod.cardanoscan.io/transaction/1305799c411826f9f8463db3b9067913db0286da42320a2297c265aafcd66dc0 —2 tADA seller payment,0.168581 tADA fee, matching10-product result and confirmed receipt.
- V2 confirmed paid transaction: https://preprod.cardanoscan.io/transaction/7869104649f7723510e722ce0621078e81daf7fc6b4d9cb535d3fbebb19a21b2 —2tADA seller payment,0.168405tADA fee, one signature/settlement; acceptance/input/result/receipt bound in one manifest.
- V2 success, actual model no-settlement rejection and immutable hash/budget/retry evidence: see MORNING_HANDOFF_V2.md and docs/evidence/v2/. The original transaction above remains V1 baseline evidence.
- Setup, tests, model evidence and known limits: README, TRACK_REQUIREMENTS_V2 and MORNING_HANDOFF_V2.
- Video: **PENDING recording**, maximum 2.5 minutes; live payment and screenshots are now available.

## Beyond the event

A production version would isolate each customer signer, authenticate service access, establish seller operating procedures and source licensing, price against real compute costs, and evaluate a proper dispute/refund mechanism if the business needs one. It would retain the same source-bound acceptance rules and reconciliation discipline.

Matching live payment evidence now exists. No competition entry has been submitted by the build agent; record the video and submit through the user/team process.
