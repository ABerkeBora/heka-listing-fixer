# Listing Fixer repository instructions

## Authorized scope

The user selected this project for implementation on 31 October 2026 and authorized routine autonomous decisions, public source publishing to `ABerkeBora/heka-listing-fixer`, and test-network actions. Historical handoff-only text in HANDOFF.md is superseded. Current build/evidence state is in BUILD_STATUS.md, TRACK_REQUIREMENTS.md and MORNING_HANDOFF.md.

- Own only this project directory, `/Users/wargly/Documents/ChatGPT/Heka/projects/listing-fixer` in the original workspace. Use its absolute path explicitly for shell/git commands. Never change parent or sibling repositories, shared model services or their ports.
- Local port: `3107`, loopback only. Public repo: `ABerkeBora/heka-listing-fixer`. Verify Git root before commits. Use repository-local `ABerkeBora` identity with the correct verified account email or `23353551+ABerkeBora@users.noreply.github.com`; do not alter global Git identity.
- Deliver a locally runnable app and source repository. No hosted deployment, competition submission, third-party messages, mainnet value or new paid services are authorized.

## Product

Ten products maximum, one English `listing-v1` schema. The buyer agent pays the fixed seller for a source-bound catalog correction result after one bounded initial mandate. Source review is free; fixture/preview results never count as paid evidence. Never invent a manufacturer, safety statement, certification, price or missing fact. Model proposals are untrusted; deterministic validation controls both source acceptance and payment policy. No legal/GPSR certification claims.

The mandate fixes network, asset, seller, endpoint, beneficiary, per-action and total service/network caps, expiry and one logical batch. Use integer amounts. The model never sees keys, chooses destinations, or emits arbitrary calldata. State which limits are application-enforced. Persist intent/input hash/signed bytes/transaction before submission, reconcile before retry, and never sign a second payment for an unresolved input. Distinguish pending, confirmed, rejected and unpaid states. Direct address payments have no automatic quality refund guarantee.

## Selected track and mandatory gates

Only **Cardano — Agentic Commerce on Cardano** is selected. Do not add API3 or BSV requirements.

Before application or payment implementation, open https://hackathon.tum-blockchain.com/prizes, select the actual Cardano tab, expand qualification/submission/judging and read general submission. A URL hash may still show default BSV content. Follow the official x402 guide https://developers.cardano.org/x402/ and Express starter https://developers.cardano.org/templates/x402-express/. Record source URLs and Europe/Berlin check time in TRACK_REQUIREMENTS.md; separate mandatory qualification/submission from optional judging examples.

The mandatory qualifying evidence is a useful completed paid request on **Cardano preprod**, with the real transaction hash and result. A generated wallet, reachable provider, successful model call or fixture does not satisfy it. Before reporting readiness, reopen the selected track and general submission, record recheck time, and give every mandatory item PASS/PENDING/FAIL/BLOCKED with actual evidence. Carry all unresolved items into MORNING_HANDOFF.md.

Generic submission requires a public repository/setup README, detailed description and video of at most 2.5 minutes. Rules checked at launch state one submission per team, up to three partner tracks, deadline 31 October 2026 15:00 Europe/Berlin. Recheck before submission preparation. Prepare text/outline; do not submit for the user.

## Secrets and access

Only isolated test wallets. Store credentials under ignored `.local/` or `.env`, mode0600; never output keys, recovery phrases, payment payloads or private model reasoning to chat, browser, public logs or repo. Do not read sibling wallets or shared funding keys. Publish `.env.example` placeholders only. Public Koios is an officially supported SDK provider alternative to Blockfrost; verify access, balance, actual transaction and receipt separately. Faucet CAPTCHA/account verification requires the user when applicable; never bypass it.

## Interface and checks

English UI, compact source/diff workbench, light neutral surfaces and restrained teal data accent. Make the main task available first; no invented metrics, balances or success states. Distinguish source sample once. Follow TasteSkill app-screen workflow where available (`design-taste-frontend/SKILL.md`, `references/app-screens.md`), prioritizing the product's simple flow. Default coordination and morning handoff language: Turkish.

Run meaningful catalog/payment/security tests, production build and real-browser walkthrough at desktop/tablet/phone. Use the session's authorized browser route. Preserve real payment history. Inspect the publishable tree for secrets before commit/push. Deliver standalone README, lockfile, env example, source samples, evidence, presentation outline, submission draft and concise MORNING_HANDOFF.md with honest limits and smallest remaining actions. Review target is 08:00–09:00 Europe/Berlin, aiming for08:00; finish early when complete.
