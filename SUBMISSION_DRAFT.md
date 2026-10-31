# Listing Fixer

## Problem

Small ecommerce teams receive product information in inconsistent supplier files. Cleaning a catalog can accidentally alter prices, lose source references, or fill missing manufacturer and safety claims with plausible text. Teams need a checked import file and a clear list of source gaps.

## What we built

Listing Fixer is a local catalog workbench for batches of up to ten products. It imports CSV or JSON into one English schema, preserves source facts, validates money and identifiers, and exposes field-level source/diff evidence. A bounded local model produces a catalog draft; deterministic checks control what can be accepted. Missing protected facts remain missing and are excluded from ready-only export.

A buyer agent can hire the fixed Listing Fixer seller through an x402 paid request on Cardano preprod. One initial mandate fixes the network, asset, seller, endpoint, beneficiary, service cap, exact network fee cap, expiry and maximum action count. The model has no wallet or arbitrary transaction authority. A durable intent links source input, quote, signed transaction, receipt and delivered catalog.

## Cardano tools and economic flow

The implementation follows the Cardano Foundation x402 Express starter and uses `@x402/cardano`, `@x402/core`, the Evolution SDK and the hosted preprod facilitator. Koios is the SDK-supported free chain provider alternative; a Blockfrost project can also be configured. Buyer and seller are separate roles. The customer buys a source-bound catalog result for a fixed per-batch price, not a cosmetic transfer.

Direct address payments provide no automatic refund or on-chain quality decision. Confirmation is probabilistic, source truth is inherited from the supplier, and the funded local executor enforces delegation caps in application code.

## Current evidence — fill from final handoff

- Public repository: https://github.com/ABerkeBora/heka-listing-fixer
- Live paid preprod transaction: **BLOCKED until actual funded request succeeds; never substitute a fixture hash.**
- Setup, tests, model evidence and known limits: README, TRACK_REQUIREMENTS and MORNING_HANDOFF.
- Video: **PENDING recording after live payment verification**, maximum 2.5 minutes.

## Beyond the event

A production version would isolate each customer signer, authenticate service access, establish seller operating procedures and source licensing, price against real compute costs, and evaluate a proper dispute/refund mechanism if the business needs one. It would retain the same source-bound acceptance rules and reconciliation discipline.

Do not submit this text with a live payment claim until the matching evidence exists. No competition entry has been submitted by the build agent.
