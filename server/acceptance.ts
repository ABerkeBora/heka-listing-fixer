import { createHash } from 'node:crypto';
import { SOURCE_FIELDS, type CatalogInput, type CatalogResult, type SourceProduct } from '../shared/catalog.js';
import { canonicalAcceptance, canonicalOrder, canonicalResult, parseAcceptancePolicy, type AcceptanceDecision, type AcceptancePolicy, type AcceptanceViolation, type DeliveryManifest } from '../shared/acceptance.js';
import { hashInput, reviewCatalog, sourceParts, validateInput } from './catalog/index.js';

const digest = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const clean = (text: string) => text.trim().replace(/\s+/gu, ' ');
export function acceptanceHash(policy: AcceptancePolicy): string { return digest(canonicalAcceptance(policy)); }
export function orderHash(inputHash: string, conditionHash: string): string { return digest(canonicalOrder(inputHash, conditionHash)); }
export function resultHash(result: CatalogResult): string { return digest(canonicalResult(result)); }

/** Buyer-selected condition, evaluated after the unchanged V1 useful-output guard and before settlement. */
export function validateAcceptance(input: CatalogInput, result: CatalogResult, rawPolicy: AcceptancePolicy): AcceptanceDecision {
  validateInput(input);
  const policy = parseAcceptancePolicy(rawPolicy, input.products.length);
  const inputDigest = hashInput(input); const acceptanceDigest = acceptanceHash(policy);
  const violations: AcceptanceViolation[] = [];
  const add = (code: string, message: string, sku?: string, field?: string) => violations.push({ code, message, ...(sku ? { sku } : {}), ...(field ? { field } : {}) });
  if (!result || typeof result !== 'object') {
    return { schema: 'listing-acceptance-decision-v1', met: false, code: 'acceptance_not_met', inputHash: inputDigest, acceptanceHash: acceptanceDigest, orderHash: orderHash(inputDigest, acceptanceDigest), readyProducts: 0, minimumReadyProducts: policy.minimumReadyProducts, allowedDisplayEditFields: policy.allowedDisplayEditFields, violations: [{ code: 'result_missing', message: 'No checked catalog result exists.' }] };
  }
  if (result.inputHash !== inputDigest || result.schema !== input.schema || result.language !== input.language) add('result_binding', 'Result does not match the approved source, schema and language.');
  if (!Array.isArray(result.products) || result.products.length !== input.products.length) add('row_count', 'Result row count differs from the approved source batch.');
  const baseline = reviewCatalog(input);
  let readyProducts = 0;
  const rows = Array.isArray(result.products) ? result.products : [];
  for (const [index, source] of input.products.entries()) {
    const row = rows[index]; const expected = baseline.products[index]; const sku = clean(source.sku); const before = violations.length;
    if (!row || typeof row !== 'object') { add('row_missing', 'A source product is missing from the result.', sku); continue; }
    if (row.sku !== expected.sku) add('sku_changed', 'Product identity or source row order changed.', sku, 'sku');
    if (!row.source || SOURCE_FIELDS.some(field => row.source[field] !== source[field]) || Object.keys(row.source).length !== SOURCE_FIELDS.length) add('source_changed', 'Original source field bytes were changed.', sku, 'source');
    for (const field of ['priceMinor', 'currency', 'manufacturer', 'safety', 'certification', 'sourceUrl'] as const) {
      if (row[field] !== expected[field]) add('protected_field_changed', 'A protected source value changed.', sku, field);
    }
    if (!Array.isArray(row.diffs) || !Array.isArray(row.issues)) { add('row_report_invalid', 'Diff and issue arrays are required.', sku); continue; }
    if (row.issues.some(issue => !issue || typeof issue !== 'object' || typeof issue.code !== 'string' || typeof issue.field !== 'string') || row.diffs.some(diff => !diff || typeof diff !== 'object' || typeof diff.field !== 'string' || typeof diff.before !== 'string' || typeof diff.after !== 'string' || !diff.source || typeof diff.source !== 'object' || (diff.source.parts !== undefined && (!Array.isArray(diff.source.parts) || diff.source.parts.some(part => !part || typeof part !== 'object' || typeof part.field !== 'string' || typeof part.text !== 'string'))))) { add('row_report_invalid', 'Diffs, issues and source parts must use the expected structured schema.', sku); continue; }
    for (const field of ['title', 'description'] as const) {
      const fieldDiffs = row.diffs.filter(diff => diff?.field === field);
      if (!policy.allowedDisplayEditFields.includes(field)) {
        if (row[field] !== source[field] || fieldDiffs.length) add('display_field_not_allowed', 'This display field was not authorized for any editing, including normalization.', sku, field);
      } else {
        if (typeof row[field] !== 'string') { add('display_field_invalid', 'Display field must remain text.', sku, field); continue; }
        if (row[field] !== source[field] && fieldDiffs.length !== 1) add('diff_missing', 'Each changed display field requires one source diff.', sku, field);
        if (row[field] !== clean(source[field])) {
          const diff = fieldDiffs[0]; const parts = diff?.source?.parts;
          const available = sourceParts(source).filter(part => part.sourceField === 'sourceText');
          if (!diff || !Array.isArray(parts) || parts.length < 2 || parts[0].field !== field || parts[0].text !== clean(source[field]) || parts.slice(1).some(part => part.field !== 'sourceText' || !available.some(candidate => candidate.text === part.text)) || new Set(parts.map(part => `${part.field}:${part.text}`)).size !== parts.length || parts.map(part => part.text).join(field === 'title' ? ' · ' : ' ') !== row[field] || diff.after !== row[field]) add('source_composition_invalid', 'Edited display text is not a deterministic composition of complete allowed source parts.', sku, field);
          if (field === 'title' && row[field].length > 200) add('title_too_long', 'Composed title exceeds 200 characters.', sku, field);
        }
      }
    }
    for (const diff of row.diffs) {
      if (!diff || !SOURCE_FIELDS.includes(diff.field as keyof SourceProduct) || diff.before !== source[diff.field as keyof SourceProduct] || diff.source?.row !== index + 1 || diff.source?.url !== clean(source.sourceUrl)) add('diff_binding', 'Diff does not cite the original source row and field.', sku, diff?.field);
      else if (diff.field === 'title' || diff.field === 'description') {
        if (diff.after !== row[diff.field]) add('diff_value_mismatch', 'Display diff does not match the delivered value.', sku, diff.field);
      } else {
        const expectedAfter = diff.field === 'price' ? expected.priceMinor === null ? '' : (expected.priceMinor / 100).toFixed(2) : diff.field === 'currency' ? expected.currency : clean(source[diff.field as keyof SourceProduct]);
        if (diff.after !== expectedAfter || diff.source.field !== diff.field || diff.source.parts) add('protected_diff_changed', 'Protected field diff changed the source fact or provenance.', sku, diff.field);
      }
    }
    const sourceGaps = expected.issues.filter(issue => issue.code === 'needs_source');
    if (sourceGaps.some(gap => !row.issues.some(issue => issue.code === gap.code && issue.field === gap.field))) add('source_gap_hidden', 'A missing source fact was omitted from the report.', sku);
    if (!['ready', 'needs_source', 'review'].includes(row.status)) add('row_status_invalid', 'Unknown product readiness status.', sku);
    if (row.status === 'ready') {
      if (expected.status !== 'ready' || row.issues.length !== 0) add('readiness_inflated', 'A row with missing sources or unresolved review issues cannot count as ready.', sku);
      if (violations.length === before) readyProducts++;
    }
  }
  const summary = { total: rows.length, ready: rows.filter(row => row?.status === 'ready').length, needsSource: rows.filter(row => row?.status === 'needs_source').length, review: rows.filter(row => row?.status === 'review').length, changes: rows.reduce((sum, row) => sum + (Array.isArray(row?.diffs) ? row.diffs.length : 0), 0) };
  if (!result.summary || Object.entries(summary).some(([key, value]) => result.summary[key as keyof typeof summary] !== value)) add('summary_mismatch', 'Result counters do not reconcile with its rows and diffs.');
  if (readyProducts < policy.minimumReadyProducts) add('minimum_ready_not_met', `${readyProducts} products pass the checks; the buyer requires ${policy.minimumReadyProducts}.`);
  return { schema: 'listing-acceptance-decision-v1', met: violations.length === 0, code: violations.length ? 'acceptance_not_met' : 'acceptance_met', inputHash: inputDigest, acceptanceHash: acceptanceDigest, orderHash: orderHash(inputDigest, acceptanceDigest), readyProducts, minimumReadyProducts: policy.minimumReadyProducts, allowedDisplayEditFields: policy.allowedDisplayEditFields, violations };
}
export function createDeliveryManifest(args: { intentId: string; input: CatalogInput; policy: AcceptancePolicy; result: CatalogResult; transaction: string; receipt: unknown }): DeliveryManifest {
  const policy = parseAcceptancePolicy(args.policy, args.input.products.length);
  const decision = validateAcceptance(args.input, args.result, policy);
  if (!decision.met) throw new Error('Acceptance not met; a paid delivery manifest cannot be created.');
  const receipt = args.receipt as { success?: unknown; transaction?: unknown; network?: unknown; extra?: { status?: unknown; confirmations?: unknown } } | null;
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(args.intentId) || !/^[a-f0-9]{64}$/.test(args.transaction) || receipt?.success !== true || receipt.transaction !== args.transaction || receipt.network !== 'cardano:preprod' || receipt.extra?.status !== 'confirmed' || !Number.isInteger(receipt.extra.confirmations) || Number(receipt.extra.confirmations) < 1) throw new Error('A matching confirmed preprod receipt is required for a delivery manifest.');
  return { schema: 'listing-delivery-v2', intentId: args.intentId, inputHash: decision.inputHash, acceptanceHash: decision.acceptanceHash, orderHash: decision.orderHash, resultHash: resultHash(args.result), acceptance: policy, decision, network: 'cardano:preprod', transaction: args.transaction, receipt: args.receipt, createdAt: args.result.createdAt };
}
