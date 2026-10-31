import { readFile, writeFile } from 'node:fs/promises';
import { parseCatalog, repairCatalog } from './index.js';
const input = parseCatalog(await readFile(new URL('../../samples/catalog.json', import.meta.url), 'utf8'), 'json');
input.products = input.products.slice(0, 2);
let trace: unknown;
const result = await repairCatalog(input, { timeoutMs: 90_000, onDraft: value => { trace = value; } });
const meaningful = result.products.filter(product => product.diffs.some(diff => diff.source.parts && diff.source.parts.length > 1));
const evidence = {
  checkedAt: new Date().toISOString(), network: 'local', qualificationEvidence: false,
  note: 'Real local model call on clearly synthetic supplier input. This proves catalog integration only, not a paid Cardano request.',
  endpoint: 'http://127.0.0.1:11434/api/chat', input, model: result.model, trace,
  checks: { validStructuredOutput: true, acceptedMeaningfulCompositions: meaningful.length, unchangedPrices: result.products.every((product, index) => product.priceMinor === Number(input.products[index].price.replace(',', '.')) * 100), resultRows: result.summary.total },
  result,
};
await writeFile(new URL('../../docs/evidence/catalog-llm.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
if (meaningful.length === 0 || !result.model?.acceptedEdits) throw new Error('Real model call produced no accepted source composition. Evidence records the actual result.');
console.log(JSON.stringify({ checkedAt: evidence.checkedAt, model: result.model, meaningfulCompositions: meaningful.length, checks: evidence.checks }));
