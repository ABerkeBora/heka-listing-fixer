import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { CatalogResult, CheckedProduct, SourceProduct } from '../shared/catalog.js';

/** Read-only delivery audit. No signing, payment, model request or state mutation endpoint. */
const sourcePath = 'samples/catalog.json';
const resultPath = 'docs/evidence/payment-live-result.json';
const paymentPath = 'docs/evidence/payment-live.json';
const outputPath = 'docs/evidence/delivery-verification.json';
const expectedInputHash = '3335c09a068c20633a3c8e1ccd926c1269450653995cb2a762cbbac5603c25a2';
if (!existsSync(resultPath)) {
  console.error('Paid delivery result is not present yet. No verification success or payment is claimed.');
  process.exit(2);
}
const sourceFields = ['sku', 'title', 'description', 'price', 'currency', 'manufacturer', 'safety', 'certification', 'sourceUrl', 'sourceText'] as const;
const clean = (value: string) => value.trim().replace(/\s+/gu, ' ');
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const input = JSON.parse(readFileSync(sourcePath, 'utf8')) as { schema: string; language: string; sample: boolean; products: SourceProduct[] };
const result = JSON.parse(readFileSync(resultPath, 'utf8')) as CatalogResult;
const payment = JSON.parse(readFileSync(paymentPath, 'utf8')) as {
  status: string; intentId: string; inputHash: string; jobStatus: string; paymentStatus: string;
  transaction: string; resultHash: string; network: string; asset: string; resultSummary: CatalogResult['summary'];
  receipt: { success: boolean; transaction: string; network: string; extra: { status: string; confirmations: number } };
};
const checks: { name: string; pass: boolean; detail?: string }[] = [];
const record = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, ...(detail ? { detail } : {}) });
const canonical = { schema: input.schema, language: input.language, products: input.products.map(row => Object.fromEntries(sourceFields.map(field => [field, row[field]]))) };
const inputHash = sha(canonical);
const resultHash = sha(result);
record('source file is the approved ten-product synthetic batch', input.sample === true && input.products.length === 10);
record('independently recomputed source hash matches initial request', inputHash === expectedInputHash, inputHash);
record('same input is bound to original intent, payment evidence and result', payment.inputHash === inputHash && result.inputHash === inputHash && payment.intentId === `batch_${inputHash.slice(0, 24)}`);
record('saved result matches hash recorded by paid request', resultHash === payment.resultHash, resultHash);
record('paid request explicitly completed', payment.status === 'PASS' && payment.jobStatus === 'complete' && payment.paymentStatus === 'confirmed');
record('receipt binds exact preprod transaction with numeric confirmed evidence', /^[a-f0-9]{64}$/.test(payment.transaction) && payment.network === 'cardano:preprod' && payment.asset === 'lovelace' && payment.receipt?.success === true && payment.receipt.transaction === payment.transaction && payment.receipt.network === payment.network && payment.receipt.extra?.status === 'confirmed' && Number.isInteger(payment.receipt.extra?.confirmations) && payment.receipt.extra.confirmations >= 1);
record('result schema and row count match approved source', result.schema === input.schema && result.language === input.language && result.products.length === input.products.length);
record('actual local model produced accepted source compositions', result.mode === 'model_checked' && result.model?.provider === 'ollama' && result.model.model === 'qwen3:4b' && result.model.called === true && result.model.acceptedEdits > 0 && result.model.rejectedEdits === 0);
function minor(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) throw new Error('Unexpected source money format in audit input.');
  const [whole, fraction = ''] = value.trim().replace(',', '.').split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
const composedRows: string[] = [];
for (const [index, source] of input.products.entries()) {
  const sku = clean(source.sku);
  const row = result.products[index];
  if (!row) { record(`${sku}: result row exists`, false); continue; }
  record(`${sku}: original source bytes retained`, sourceFields.every(field => row.source?.[field] === source[field]));
  record(`${sku}: money and protected facts unchanged`, row.sku === sku && row.priceMinor === minor(source.price) && row.currency === clean(source.currency).toUpperCase() && row.manufacturer === clean(source.manufacturer) && row.safety === clean(source.safety) && row.certification === clean(source.certification) && row.sourceUrl === clean(source.sourceUrl));
  const missing = ['title', 'description', 'price', 'currency', 'manufacturer', 'safety', 'certification'].filter(field => !clean(source[field as keyof SourceProduct]));
  if (!clean(source.sourceUrl) && !clean(source.sourceText)) missing.push('source');
  record(`${sku}: missing source stays marked and excluded from ready status`, missing.length === 0 || (row.status !== 'ready' && missing.every(field => row.issues.some(issue => issue.code === 'needs_source' && issue.field === field))));
  const sourceClauses = source.sourceText.split('|').map(clean);
  let validDiffs = true;
  let useful = false;
  for (const diff of row.diffs) {
    if (!sourceFields.includes(diff.field as typeof sourceFields[number]) || diff.before !== source[diff.field as keyof SourceProduct] || diff.source.row !== index + 1 || diff.source.url !== clean(source.sourceUrl)) validDiffs = false;
    if (diff.source.parts) {
      const parts = diff.source.parts;
      const separator = diff.field === 'title' ? ' · ' : ' ';
      if (!['title', 'description'].includes(diff.field) || parts.length < 2 || parts[0].field !== diff.field || parts[0].text !== clean(source[diff.field as keyof SourceProduct]) || parts.map(part => part.text).join(separator) !== diff.after || row[diff.field as 'title' | 'description'] !== diff.after) validDiffs = false;
      const additions = parts.slice(1);
      if (!additions.every(part => part.field === 'sourceText' && sourceClauses.includes(part.text) && /^(?:Material|Dimensions|Capacity|Colour|Pages):\s*\S/.test(part.text)) || new Set(additions.map(part => part.text)).size !== additions.length) validDiffs = false;
      if (additions.some(part => !clean(source[diff.field as keyof SourceProduct]).toLowerCase().includes(part.text.toLowerCase()))) useful = true;
    } else {
      const expected = diff.field === 'price' ? minor(source.price) === null ? '' : (minor(source.price)! / 100).toFixed(2) : diff.field === 'currency' ? clean(source.currency).toUpperCase() : clean(source[diff.field as keyof SourceProduct]);
      if (diff.after !== expected || diff.source.field !== diff.field) validDiffs = false;
    }
  }
  for (const field of ['title', 'description'] as const) {
    if (row[field] !== clean(source[field]) && !row.diffs.some(diff => diff.field === field && diff.source.parts)) validDiffs = false;
  }
  record(`${sku}: every displayed edit has exact field or complete clause provenance`, validDiffs);
  if (useful) composedRows.push(sku);
}
record('paid result adds useful supplied details beyond free normalization', composedRows.length > 0, `${composedRows.length} products with composed source details`);
const summary = {
  total: result.products.length,
  ready: result.products.filter(row => row.status === 'ready').length,
  needsSource: result.products.filter(row => row.status === 'needs_source').length,
  review: result.products.filter(row => row.status === 'review').length,
  changes: result.products.reduce((sum, row) => sum + row.diffs.length, 0),
};
record('summary is computed from delivered rows and agrees with payment evidence', JSON.stringify(summary) === JSON.stringify(result.summary) && JSON.stringify(summary) === JSON.stringify(payment.resultSummary) && summary.total === summary.ready + summary.needsSource + summary.review);
function readCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\r' || char === '\n') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('Export has an unterminated CSV cell.');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const readyRows = result.products.filter(row => row.status === 'ready');
const exportChecks: Record<string, unknown> = {};
try {
  const url = `http://127.0.0.1:3107/api/jobs/${encodeURIComponent(payment.intentId)}/download/`;
  const responseJson = await fetch(url + 'json', { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  const json = await responseJson.json() as CatalogResult;
  record('actual paid JSON export includes exactly ready rows and unchanged output', responseJson.ok && JSON.stringify(json.products) === JSON.stringify(readyRows) && json.inputHash === inputHash);
  const responseCsv = await fetch(url + 'csv', { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  const csv = readCsv(await responseCsv.text());
  const [header, ...rows] = csv;
  const col = (name: string) => header.indexOf(name);
  record('actual paid CSV export excludes every needs-source/review product', responseCsv.ok && rows.length === readyRows.length && rows.every((cells, index) => cells[col('sku')] === readyRows[index].sku && cells[col('status')] === 'ready' && cells[col('price')] === (readyRows[index].priceMinor! / 100).toFixed(2) && cells[col('manufacturer')] === readyRows[index].manufacturer && cells[col('safety')] === readyRows[index].safety && cells[col('certification')] === readyRows[index].certification));
  const responseReport = await fetch(url + 'report', { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  const report = await responseReport.json() as { intentId: string; inputHash: string; payment: { transaction: string }; result: CatalogResult };
  record('actual full report preserves all rows, source gaps and receipt transaction', responseReport.ok && report.intentId === payment.intentId && report.inputHash === inputHash && report.payment.transaction === payment.transaction && sha(report.result) === resultHash);
  Object.assign(exportChecks, { jsonRows: json.products?.length, csvRows: rows.length, reportRows: report.result?.products?.length, readySkus: readyRows.map(row => row.sku), excludedSkus: result.products.filter(row => row.status !== 'ready').map(row => row.sku) });
} catch (error) { record('actual paid HTTP exports are readable and consistent', false, error instanceof Error ? error.message : 'Export verification failed.'); }
const evidence = {
  checkedAt: new Date().toISOString(), status: checks.every(check => check.pass) ? 'PASS' : 'FAIL',
  audit: 'Independent delivered-catalog and read-only HTTP export verification. No model, signature or payment operation performed.',
  sourcePath, resultPath, paymentPath, expectedInputHash, inputHash, resultHash,
  intentId: payment.intentId, transaction: payment.transaction, checks,
  checksPassed: checks.filter(check => check.pass).length, checksTotal: checks.length,
  summary, usefulCompositionSkus: composedRows, exports: exportChecks,
  qualificationBoundary: 'Verifies matching useful delivery and receipt binding. Independent chain settlement/output proof is recorded separately.',
};
writeFileSync(outputPath, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ status: evidence.status, checksPassed: evidence.checksPassed, checksTotal: evidence.checksTotal, inputHash, resultHash, summary, outputPath }, null, 2));
if (evidence.status !== 'PASS') process.exitCode = 1;
