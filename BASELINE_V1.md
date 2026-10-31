# Listing Fixer V1 baseline

31 October 2026 04:31 Europe/Berlin. Verified original Goal completion at 04:25:12 CET in BUILD_STATUS.md and docs/evidence/completion-audit.json. Current get_goal returned null (no active Goal), not a newly inferred completion.

- Functional V1 commit: `a36d5d6d0e7b1febba524eb629af1afc7ea74ec7`, branch `codex/build`, public repository https://github.com/ABerkeBora/heka-listing-fixer.
- Immutable baseline tag: `v1-baseline`, pointing at the baseline-document commit that follows the functional commit above. Resolve with `git rev-parse v1-baseline^{commit}`.
- Main view: http://127.0.0.1:3107/
- Confirmed paid job: http://127.0.0.1:3107/?job=batch_3335c09a068c20633a3c8e1c
- Start: `npm ci`, copy `.env.example` to `.env` only on a fresh installation, `npm run build`, `npm start`. Existing ignored wallet and databases must be retained.
- Live Cardano preprod direct payment: `1305799c411826f9f8463db3b9067913db0286da42320a2297c265aafcd66dc0`.
- Seller 2000000 lovelace, network fee 168581 lovelace; actual useful model result 5 ready / 5 needs source; result hash `05f15c335e49591d6e1d2d97dc295e817fb1d66ccc88f5dcec86a13871224095`.
- Existing local state: `data/jobs.sqlite`, `data/payment.sqlite` and their WAL files; ignored wallet `.local/cardano-wallets.json`. Preserve signed bytes, receipts, result and all job history. Do not erase/recreate databases for a retry.
- Evidence: docs/evidence/payment-live.json, payment-chain.json, payment-restart.json, delivery-verification.json, browser-paid-qa.json, completion-audit.json. 37 tests, production build, 13 chain checks and 53 delivery checks passed at V1 delivery.
- No deployed contract or hosted frontend; loopback port3107 and local Ollama qwen3:4b. No escrow/refund/on-chain quality adjudicator.
- Video recording and Devfolio entry remain separate user submission steps; presentation outline and draft are ready.

V2 uses `/next`, `/api/next`, separate SQLite and isolated executor wallet. V1 receipt and intent cannot serve as V2 evidence. Small testADA funding of that executor may use spare V1 test-wallet funds as a separately documented setup transfer, never as a paid customer job or under the old completed mandate.

Timestamp correction in V2: the initial baseline document in the immutable tag used05:34Europe/Berlin in error. The recorded UTC03:31 Goal/start event corresponds to04:31CET (UTC+1) on31October. The tag remains untouched; functional commit and payment evidence timestamps are unchanged.
