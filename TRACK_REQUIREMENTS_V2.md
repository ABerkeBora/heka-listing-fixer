# Listing Fixer V2 — Cardano requirements

Selected track: **Cardano — Agentic Commerce on Cardano** only. Start gate checked31 October2026 04:31 Europe/Berlin, before V2 application code. The actual Cardano tab was selected and qualification, full About, submission and judging panels expanded in the live browser. General How to submit tab read separately. Official x402 guide and Express starter opened. No sponsor requirements from the default BSV tab were imported.

Sources:
- https://hackathon.tum-blockchain.com/prizes#cardano
- https://hackathon.tum-blockchain.com/prizes#how-to-submit
- https://developers.cardano.org/x402/
- https://developers.cardano.org/templates/x402-express/

## Mandatory qualification and requested delivery

| Requirement | V2 implementation | Evidence / status |
|---|---|---|
| Useful completed paid request via x402 on Cardano preprod | Source-bound catalog composition after buyer acceptance check | PASS — new V2 transaction7869104649f7723510e722ce0621078e81daf7fc6b4d9cb535d3fbebb19a21b2; payment-live.json and payment-chain.json13checks |
| Real delegated agent economic action after bounded initial mandate | Fixed seller/network/asset/endpoint/caps/expiry and one intent; buyer's immutable threshold and edit fields | PASS — payment-live.json mandate/acceptance, confirmed receipt, one signature/one settlement; policy-verification.json9checks |
| Save transaction hash, show result and setup/limits in README | Delivery manifest binds input, acceptance, result and receipt; direct explorer link | PASS — README; delivery-verification.json15checks and bound manifest |
| Public repository and setup/run README | Same public ABerkeBora/heka-listing-fixer repository; v1-baseline tag, codex/next branch | Baseline published4bb9d5b; V2 publication PENDING |
| Buyer acceptance failure does not settle/broadcast | Deterministic validation after real model/useful-result check and before facilitator settlement call | PASS — acceptance-rejected.json plus no-settlement-verification.json10checks, actual model5ready/6required; expired signed authorization absent from chain, inputs unspent at recorded pre-success observation |
| Preserve V1 and isolate V2 | `/` + existing DB/receipts retained; `/next`, `/api/next`, own DB/wallet | PASS — v1-regression.json6checks; separate V2 databases/wallet and payment-v2.test.ts isolation cases |
| Tests/build/three-width browser QA | Relevant security, binding and payment tests; desktop/tablet/phone | PASS — tests57/57, production build, browser-qa.json12checks and11screenshots at1440/768/390px |

## Organizer submission items (separate user action)

| Requirement | Preparation | Status |
|---|---|---|
| Video at most2.5minutes, target user/problem/business case/end-to-end paid request | PRESENTATION.md updated to include acceptance failure/success | PENDING recording by user |
| Detailed Devfolio description including Cardano tools and real use | SUBMISSION_DRAFT.md | PENDING final user submission |
| One entry per team; up to3partner tracks; automatic TUM consideration | Coordination outside this project's entry | PENDING user/team submission |
| Deadline Saturday31October2026 at15:00 Europe/Berlin | Recheck at finish | Verified start gate |

## Judging preferences (not extra mandatory qualification)

Original useful customer workflow, clear pitch/UX, technical execution, meaningful paid task and explorer evidence. Payment tied to a passed check is a highlighted preference. V2 implements a **local application acceptance policy before settlement**, not escrow, refund, an on-chain adjudicator or an on-chain budget allowance. Hosted facilitator can only relay the complete signed transaction; its internal broadcasts are not directly instrumented. Local settlement calls and independent chain presence are distinct evidence.

Final rule recheck:31October2026 at04:42CET (UTC03:42), using freshly reloaded general tab then actual Cardano tab with submission/judging panels expanded. Qualification and submission rules are unchanged. Mandatory Cardano paid-request integration is PASS. Recording the150-second video and submitting the Devfolio entry remain PENDING user/team actions, outside authorized execution. Deadline remains31October2026 at15:00Europe/Berlin; one entry/team, up to3partner tracks. Browser final QA is PASS. Publication row is reconciled against the actual remote commit before completion.
