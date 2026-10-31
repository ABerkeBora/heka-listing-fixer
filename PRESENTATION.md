# 2.5-minute presentation outline

This is a150-second outline, not a recorded video. Prefer V2 after its actual paid proof in docs/evidence/v2/payment-live.json; V1 remains available at the v1-baseline tag and original paid link. Never present the rejected authorization hash as a submitted payment.

- **0:00–0:20 — Customer and source.** A small ecommerce team needs a safe import file from ten supplier rows. Open `/next`, inspect a source row and the five missing-fact flags. The sample is explicitly synthetic; model work and preprod payment are real.
- **0:20–0:45 — Buyer chooses what is worth paying for.** Show minimum ready products and allowed title/description edits before delegation. Expand source/acceptance hashes and the mandate: fixed seller, one request, separate service/fee caps and expiry. The model never gets keys.
- **0:45–1:10 — A real rejection without collection.** Open the recorded six-ready order. Actual model produced five ready; acceptance failed, zero local settlement calls, no receipt, no paid export. Explain signed authorization is not broadcast. Independent chain proof after expiry found unspent inputs.
- **1:10–1:45 — Successful paid delivery.** Open the recorded five-ready V2 order. Acceptance passed before settlement; show its NEW confirmed transaction,2tADA seller amount, exact fee and receipt. Open the result manifest binding acceptance/input/result/receipt. Show client verification and one source-linked model composition.
- **1:45–2:10 — Safe retry and protected source.** Missing manufacturer/safety stays “Needs source”; download ready rows and manifest. Same input+rule resolves to the same intent, signature and transaction. Show hash/budget mutation rejections with unchanged paid state.
- **2:10–2:30 — Business and limits.** Fixed-price per-batch catalog correction replaces manual copy cleanup. Acceptance is checked by the local app before direct payment; it is not escrow, a refund, or an on-chain quality judge. Sources remain the supplier’s responsibility. Show public source and reproducible commands.

Recording:150seconds maximum, English UI, readable diff/receipt, no private wallet/env files. Video and Devfolio submission are still user/team actions. Use MORNING_HANDOFF_V2.md for the verified paid and rejection direct links and latest evidence.
