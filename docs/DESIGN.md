# Listing Fixer interface decisions

## Product inventory

- Objects: one supplier batch, at most ten products; each has SKU, title, description, minor-unit price, currency and supplied references.
- Protected facts: manufacturer, safety, certification, price and technical facts remain absent when absent from the source.
- The operator imports supplier JSON/CSV, reviews exceptions and delegates one catalog correction purchase.
- Magnitudes are small: ten sample products, five ready and five needing source attention. Counts always derive from rows.
- A changed field carries its original value, accepted value, source row/field, URL and reason.
- A buyer mandate fixes the seller, preprod asset, service/fee caps, expiry and one action.
- Payment state and result state are separate; a source preview never becomes a paid receipt.
- Product-specific material: the supplier's rows, before/after field marks, missing-source checks, and the one-batch mandate.
- Default data is a clearly identified synthetic sample supplier batch supplied by the catalog service.
- The principal job is deciding which products can be imported and which supplier facts must be obtained.

## Question, finding, and face

Question: Which products are import-ready, and what source is missing?

Finding: The non-ready count in the first sentence is derived from the same products as the filters and footer.

The source row becomes the interface's organizing device: product table at left and a field-level source/diff pane at right. Teal marks accepted changes, not navigation chrome. The asymmetric workbench carries actual source evidence instead of charts or KPI tiles.

## TasteSkill direction

Read `SKILL.md` and `references/app-screens.md`. The app draw dealt `achromatic-ledger` and `framed-sheet`; chose **Achromatic ledger**, seed **568763087**, because a cautious catalog operator reads facts and amounts in repeated rows. The existing white/teal brief is retained; the primary action is near-black and most data uses neutral ink. Geist text, Geist Mono only for SKU/intent/hash identifiers. No decorative animation.

The dealt sidebar shell was simplified to the chapter's no-sidebar shell because the approved product has a single workbench and source/diff need the width; inventing navigation destinations would expand scope. The working surface retains the list layout, sentence-case table headings, tab underline, sparse color, tight radii and tabular prices. The detail layout uses source/diff content instead of the dealt generic analytics grid, as required by the product brief. These are intentional brief-driven composition substitutions, not a blended dashboard.

Grid: at 1440px, 40px gutters leave 1360px = 976px table + 24px gap + 360px detail. At 1200px, 1120px = 736 + 24 + 360; in the narrower desktop band, 28px gutters and a 330px detail retain useful product width. Under 1040px the detail panel becomes a horizontal source sheet; under 640px, rows become two-line list items and selecting a product opens only its detail with a return action.

## Data/state integrity

- All product/status/change counts derive from `CatalogResult.products`.
- Initial data comes from `/api/sample` and `/api/review`; no rows or success counts are copied into markup.
- A paid result requires the server's complete job and payment receipt. The client does not fabricate a transaction.
- The download dialog labels unpaid source reviews and defaults to ready products only. Full review reports include every rejected/missing field and the explicit payment state.
- CSV exports quote fields and neutralize formula-leading text.
- Starting with missing payment setup records and displays the server blocker; it does not present a payment success.
- Source URLs accept only HTTP(S); imported content renders as text. No model or supplier HTML is executed.
- Empty, source loading, HTTP error, rejected source, empty filter, payment unavailable, pending, processing, complete and unresolved receipt are represented.

## Verification

Implementation files are ready for the root agent's build, source checks, and CUA browser QA at 1440, 768 and 390px. Screenshots and critique results should be appended after that walkthrough. The skill's raw browser inspector is intentionally replaced by the authorized CUA route; no separate CDP/browser driver is used.

TasteSkill source lint: 0 FAIL, 5 WARN. The SKU above the product name is an object identifier; mono is restricted to identifiers and literal imported JSON; the only shadow belongs to the modal overlay. These checks are retained for concrete functional reasons.

Receipt refinement: exact six-decimal tADA values use integer parsing, unknown facilitator fee remains unquoted, real explorer URLs are shown only from the server. Receipt reconciliation uses the existing intent through the dedicated POST endpoint. The last job pointer is namespaced in local storage and restores the matching original source from the server; no new payment is submitted on reload. Import/new mandate is blocked while an existing receipt is unresolved.

Phone QA correction: when a row opens its detail below 640px, batch heading/actions, mandate strip and job summary fold away. The product header, detail return action, selected source/checks and error notices stay visible. Returning to All products restores the existing batch and payment state. This keeps the phone's selected source task in one focused pane instead of burying it beneath batch controls. Desktop and tablet retain the complete workbench.

Phone list QA correction: removed the breadcrumb, tightened batch action gaps and the mandate strip, and moved the unpaid/paid review label into the Products heading. The blocked job keeps its heading and a two-line funding reason; its full reason, intent, fees and trace remain inside Intent & receipt details. Redundant job-fact lines fold away on phones. This reserves the first screen for source rows while keeping payment status accessible above them. The mandate explicitly names the local catalog owner as beneficiary, pins the single local catalog endpoint, and authorizes no extra API charges.

Final phone density adjustment: the redundant mandate strip is omitted on phone because the primary action opens the complete mandate. Filters, search, receipt refresh, export and close controls retain44px targets; product rows stay early. Full initial desktop/tablet/phone CUA walkthrough completed; final screenshot files and browser-qa.json contain measured results.

Tablet QA found that a selected source sheet could fall below all ten rows. At641–1040px, selecting a row now opens the source sheet in the workbench with an explicit All products return, keeping the chosen evidence visible. Phone import validation errors are rendered inside the dialog; sample identity survives loading the supplied JSON through import.

## Final paid-state browser QA

The actual confirmed catalog was retrieved from its existing intent through the UI, without creating a new input or payment. CUA Chrome screenshots at 1440×900, 768×1024 and 390×844 show the delivered state, with no horizontal overflow. On the phone the first source row starts at 432.55px; selecting a row starts its focused source pane at 68px. All ten product details show source-bound description composition. Counts agree throughout: ten products, five ready, five needing source, 33 source-linked changes. The missing manufacturer on LF-003 remains `Needs source` after paid processing.

The expanded receipt shows the actual confirmed transaction, service 2.000000 tADA, network fee 0.168581 tADA and seller received 2.000000 tADA. Facilitator fee stays `Not separately quoted`. No localhost application console errors were observed; unrelated installed-browser-extension warnings were excluded. The temporary viewport override was reset and the isolated QA tab was closed.

Evidence: `docs/evidence/browser-paid-qa.json`, `ui-paid-desktop.jpg`, `ui-paid-tablet.jpg`, `ui-paid-phone.jpg`, `ui-paid-receipt.jpg`, `ui-paid-source.jpg` and `ui-paid-phone-source.jpg` in the same evidence directory.

The confirmed job can be opened directly with `?job=<intent-id>` using the same server-verified restore path. A new successful source review clears that job query so an old paid receipt cannot appear beside different input.
