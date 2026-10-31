# Listing Fixer next Goal

- State: ACTIVE — create_goal and get_goal both returned active at 2026-10-31T03:31:46Z. Owner thread01a18fd2-92d6-7100-88a7-6232ab986e44; no separate Goal ID returned. No token budget requested/set.
- Checked: 31 October 2026 04:31 Europe/Berlin; Goal tool UTC timestamp03:31:46Z is authoritative.
- get_goal: null; previous actual completion verified in V1 completion audit and BUILD_STATUS.md at04:25:12 CET.
- Objective: Bind the buyer's immutable catalog acceptance conditions to the paid job. Reject before settlement/broadcast when the result fails; otherwise deliver one verifiable record binding acceptance, input, receipt and result hash.
- Source brief: local readonly docs/NEXT_GOALS/listing-fixer.md and PROTOCOL.md in the coordinating Heka workspace.
- Scope: 1–10 English listing-v1 products; buyer minimumReadyProducts + allowed title/description fields; immutable canonical acceptance hash; separate V2 API/job/storage/executor; real no-settlement and new paid preprod evidence. Preserve V1 `/` and data. No escrow/automatic refund/on-chain quality judge, no mainnet/hosting/submission/new paid services.

## Progress

- Baseline commit4bb9d5b and immutable v1-baseline tag published; working branchcodex/next.
- Start gate completed in live Cardano/general tabs before V2 code; official x402 starter/guide read.
- Isolated V2 buyer funded with10testADA via setup transaction3d1beb10f12b4c70c6e0b939462c9dff102da5630344ec6e5fa7056ba5528943; fee168581lovelace. Not paid-job evidence.
- Final57tests and production build PASS. Real model rejection:5ready/6required,0settlements, no receipt; after-TTL chain absence/unspent snapshotPASS. New paid success:7869104649f7723510e722ce0621078e81daf7fc6b4d9cb535d3fbebb19a21b2, one signature/settlement;13chain,15delivery,9policy and6V1regression checksPASS. Final rule recheck04:42CET unchanged. Browser QA12/12PASS with11finalscreenshots. Source publication/summary metadata are being finalized; Goal remains ACTIVE until the actual completion tool succeeds.
