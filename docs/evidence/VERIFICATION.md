# Evidence boundaries

- `catalog-llm-full.json`: actual local qwen3:4b call on all ten supplied products;10 accepted source-clause compositions,0 rejected; price/currency preservation checked. Unpaid model integration evidence.
- `catalog-llm.json`: actual earlier two-product accepted call. `catalog-llm-rejected.json`: actual rejected draft retained to show fail-closed validation.
- `payment-preflight.json`: real Koios balance read and hosted facilitator supported-schemes response. Balance0; setup evidence only.
- `payment-challenge.json`: actual x402402 challenge for the same useful catalog job; unsigned, unpaid. Includes rejected altered offers. Not qualifying paid evidence.
- `payment-live.json`: actual attempt through the application. BLOCKED means no payment/receipt/result claimed.
- `server-checks.json`: actual HTTP checks against the running application, including invalid SKU before payment, cross-site rejection and duplicate logical intent.
- `dependency-audit-initial.json`: initial vulnerable starter dependency graph. `dependency-audit.json`: final upgraded graph (audit reports0 known vulnerabilities at check).
- `ui-*.jpg`: screenshots from the real browser through CUA; sample data and blocked test wallet only.

Unit-test fixtures under `tests/` exercise transaction policy, receipt tampering, concurrency, restart recovery and source validation. They are synthetic by design and never presented as chain history. There is no deployed contract in this direct address flow. A paid preprod transaction remains a required missing qualification item while balance is0.
