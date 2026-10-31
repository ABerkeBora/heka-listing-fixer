import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { canonicalAcceptance, canonicalInput, canonicalOrder, canonicalResult, canonicalManifest, parseAcceptancePolicy, AcceptancePolicyError, type AcceptancePolicy, type DisplayEditField } from '../shared/acceptance.js';
import { acceptanceHash, orderHash, resultHash, validateAcceptance, createDeliveryManifest } from '../server/acceptance.js';
import { hashInput, parseCatalog, repairCatalog, reviewCatalog } from '../server/catalog/index.js';
import type { CatalogResult, CatalogInput } from '../shared/catalog.js';
const source = () => parseCatalog(readFileSync(new URL('../samples/catalog.json', import.meta.url), 'utf8'), 'json');
const policy = (minimumReadyProducts = 5, allowedDisplayEditFields: DisplayEditField[] = ['title', 'description']): AcceptancePolicy => ({ schema: 'listing-acceptance-v1', minimumReadyProducts, allowedDisplayEditFields });
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
function mockedModel(field: DisplayEditField, seen?: (request: Record<string, any>) => void): typeof fetch {
 return async (_url, init) => {
  const request = JSON.parse(String(init?.body)); seen?.(request);
  const data = JSON.parse(request.messages[1].content) as { products: { sku: string; availableSpecifications: { sourceField: string; text: string }[] }[] };
  return new Response(JSON.stringify({ message: { content: JSON.stringify({ edits: data.products.map(row => ({ sku: row.sku, field, parts: row.availableSpecifications.slice(0, 1) })) }) } }), { status: 200 });
 };
}
const generated = (input = source(), fields?: DisplayEditField[]) => repairCatalog(input, { allowedDisplayEditFields: fields, fetchImpl: mockedModel(fields?.includes('description') === false ? 'title' : 'description') });

test('canonical acceptance is browser-safe, closed, ordered and semantically stable', async () => {
 const a = policy(); const b = { allowedDisplayEditFields: ['description', 'title'], minimumReadyProducts: 5, schema: 'listing-acceptance-v1' } as AcceptancePolicy;
 assert.equal(canonicalAcceptance(a), canonicalAcceptance(b));
 assert.equal(canonicalAcceptance(a), '{"schema":"listing-acceptance-v1","minimumReadyProducts":5,"allowedDisplayEditFields":["title","description"]}');
 const browserHash = Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalAcceptance(a)))).toString('hex');
 assert.equal(browserHash, acceptanceHash(a));
 assert.equal(sha(canonicalInput(source())), hashInput(source()));
 assert.equal(hashInput(source()), '3335c09a068c20633a3c8e1ccd926c1269450653995cb2a762cbbac5603c25a2');
});
test('invalid minimum, duplicate/empty/protected fields and unknown policy keys are rejected', () => {
 for (const value of [policy(0), policy(11), policy(1.5), { ...policy(), minimumReadyProducts: '5' }, { ...policy(), allowedDisplayEditFields: [] }, { ...policy(), allowedDisplayEditFields: ['title', 'title'] }, { ...policy(), allowedDisplayEditFields: ['price'] }, { ...policy(), allowPriceChanges: true }, { ...policy(), schema: 'other' }]) assert.throws(() => parseAcceptancePolicy(value, 10), AcceptancePolicyError);
 assert.throws(() => parseAcceptancePolicy(policy(5), 4));
});
test('same input and condition dedupe to one order; changed buyer condition creates a distinct order', () => {
 const input = hashInput(source()); const a = acceptanceHash(policy(5)); const b = acceptanceHash(policy(6));
 assert.equal(orderHash(input, a), sha(canonicalOrder(input, a)));
 assert.equal(orderHash(input, a), orderHash(input, acceptanceHash(policy(5, ['description', 'title']))));
 assert.notEqual(orderHash(input, a), orderHash(input, b));
 assert.notEqual(orderHash(input, a), orderHash(input, acceptanceHash(policy(5, ['description']))));
 assert.throws(() => canonicalOrder('A'.repeat(64), a));
});
test('realistic checked source composition meets five-ready condition but deterministically rejects six', async () => {
 const input = source(); const result = await generated(input);
 const met = validateAcceptance(input, result, policy(5)); assert.equal(met.met, true); assert.equal(met.readyProducts, 5); assert.deepEqual(met.violations, []);
 const rejected = validateAcceptance(input, result, policy(6)); assert.equal(rejected.met, false); assert.equal(rejected.code, 'acceptance_not_met'); assert.equal(rejected.readyProducts, 5); assert.ok(rejected.violations.some(item => item.code === 'minimum_ready_not_met'));
});
test('title-only model request preserves description raw bytes and removes even normalization diffs', async () => {
 const input = source(); const result = await repairCatalog(input, { allowedDisplayEditFields: ['title'], fetchImpl: mockedModel('title', request => {
  assert.deepEqual(request.format.properties.edits.items.properties.field.enum, ['title']);
  assert.match(request.messages[0].content, /ONE title edit/);
 }) });
 assert.ok(result.products.every((row, i) => row.description === input.products[i].description && row.diffs.every(diff => diff.field !== 'description')));
 assert.ok(result.products[0].title.includes(' · Material: solid oak'));
 assert.equal(validateAcceptance(input, result, policy(5, ['title'])).met, true);
});
test('description-only request preserves titles including whitespace, while V1 default still normalizes both', async () => {
 const input = source(); const restricted = await generated(input, ['description']); const original = await generated(input);
 assert.equal(restricted.products[0].title, input.products[0].title);
 assert.ok(restricted.products.every(row => row.diffs.every(diff => diff.field !== 'title')));
 assert.equal(validateAcceptance(input, restricted, policy(5, ['description'])).met, true);
 assert.equal(original.products[0].title, 'DESK ORGANISER — OAK');
 assert.ok(original.products[0].diffs.some(diff => diff.field === 'title'));
});
test('forbidden model display proposal fails before rendering even if source-bound', async () => {
 await assert.rejects(repairCatalog(source(), { allowedDisplayEditFields: ['title'], fetchImpl: mockedModel('description') }), /outside the buyer acceptance/);
});
test('forbidden deterministic whitespace change is rejected by acceptance validator', async () => {
 const input = source(); const result = await generated(input, ['description']);
 result.products[0].title = result.products[0].title.trim();
 const verdict = validateAcceptance(input, result, policy(5, ['description']));
 assert.equal(verdict.met, false); assert.ok(verdict.violations.some(item => item.code === 'display_field_not_allowed'));
});
test('protected facts, source bytes, hidden gaps and inflated counters never satisfy the condition', async () => {
 const input = source(); const base = await generated(input);
 for (const mutate of [
  (result: CatalogResult) => { result.products[0].priceMinor = 1; },
  (result: CatalogResult) => { result.products[0].manufacturer = 'Invented maker'; },
  (result: CatalogResult) => { result.products[0].safety = 'Certified safe'; },
  (result: CatalogResult) => { result.products[0].certification = 'CE'; },
  (result: CatalogResult) => { result.products[0].source.sourceText = 'Altered source'; },
  (result: CatalogResult) => { result.products[2].issues = []; result.products[2].status = 'ready'; result.summary.ready++; result.summary.needsSource--; },
  (result: CatalogResult) => { result.summary.ready = 10; },
  (result: CatalogResult) => { result.products[0].description = 'A fabricated claim.'; },
 ]) {
  const result = structuredClone(base); mutate(result);
  const decision = validateAcceptance(input, result, policy(5)); assert.equal(decision.met, false); assert.ok(decision.violations.length);
 }
});
test('malformed source parts and wrong input binding return a structured rejection', async () => {
 const input = source(); const result = await generated(input); const bad = structuredClone(result);
 bad.products[0].diffs.find(diff => diff.source.parts)!.source.parts = [null] as any;
 assert.equal(validateAcceptance(input, bad, policy()).met, false);
 const wrong = structuredClone(result); wrong.inputHash = '0'.repeat(64);
 assert.ok(validateAcceptance(input, wrong, policy()).violations.some(item => item.code === 'result_binding'));
});
test('delivery manifest binds acceptance, source, order, result and exact confirmed receipt', async () => {
 const input = source(); const result = await generated(input); const transaction = '1'.repeat(64);
 const receipt = { success: true, transaction, network: 'cardano:preprod', extra: { status: 'confirmed', confirmations: 1 } };
 const manifest = createDeliveryManifest({ intentId: 'next_test', input, policy: policy(), result, transaction, receipt });
 assert.equal(manifest.inputHash, hashInput(input)); assert.equal(manifest.acceptanceHash, acceptanceHash(policy())); assert.equal(manifest.orderHash, orderHash(manifest.inputHash, manifest.acceptanceHash));
 assert.equal(manifest.resultHash, resultHash(result)); assert.equal(manifest.resultHash, sha(canonicalResult(result))); assert.equal(manifest.decision.met, true); assert.equal(JSON.parse(canonicalManifest(manifest)).transaction, transaction);
 assert.throws(() => createDeliveryManifest({ intentId: 'next_test', input, policy: policy(6), result, transaction, receipt }), /Acceptance not met/);
 assert.throws(() => createDeliveryManifest({ intentId: 'next_test', input, policy: policy(), result, transaction, receipt: { ...receipt, extra: { status: 'confirmed', confirmations: '1' } } }), /confirmed preprod receipt/);
 assert.throws(() => createDeliveryManifest({ intentId: 'next_test', input, policy: policy(), result, transaction, receipt: { ...receipt, transaction: '2'.repeat(64) } }), /confirmed preprod receipt/);
});
