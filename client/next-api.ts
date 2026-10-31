import type { CatalogInput, CatalogResult } from '../shared/catalog';
import { canonicalAcceptance, canonicalInput, canonicalOrder, canonicalResult, parseAcceptancePolicy, type AcceptanceDecision, type AcceptancePolicy, type DeliveryManifest } from '../shared/acceptance';
import { request, type InputFormat, type Job, type Mandate, type PaymentIntent, type SystemStatus } from './api';

export interface AcceptanceReview {
  result: CatalogResult;
  inputHash: string;
  acceptance: AcceptancePolicy;
  acceptanceHash: string;
  orderHash: string;
}
export type NextJob = Omit<Job, 'status' | 'payment'> & {
  status: Job['status'] | 'acceptance_not_met';
  acceptance: AcceptancePolicy;
  acceptanceHash: string;
  orderHash: string;
  decision?: AcceptanceDecision | null;
  manifest?: DeliveryManifest | null;
  payment?: PaymentIntent & { settlementCalls?: number; mandate?: Mandate & { acceptanceHash?: string; orderHash?: string }; quote?: { extensions?: Record<string, { info?: Record<string, unknown> }> } | null };
  mandate?: Mandate;
};
export interface VerifiedDelivery {
  inputHash: string;
  acceptanceHash: string;
  orderHash: string;
  resultHash: string;
  transaction: string;
}
export const nextApi = {
  status: () => request<SystemStatus>('/api/next/status'),
  sample: () => request<{ input: string; format: InputFormat }>('/api/next/sample'),
  review: (input: string, format: InputFormat, acceptance: AcceptancePolicy) => request<AcceptanceReview>('/api/next/review', { input, format, acceptance }),
  start: (input: string, format: InputFormat, acceptance: AcceptancePolicy, acceptanceHash: string, mandate: Mandate) => request<{ job: NextJob; duplicate?: boolean }>('/api/next/jobs', { input, format, acceptance, acceptanceHash, mandate }),
  job: (id: string) => request<{ job: NextJob }>(`/api/next/jobs/${encodeURIComponent(id)}`),
  reconcile: (id: string) => request<{ job: NextJob }>(`/api/next/jobs/${encodeURIComponent(id)}/reconcile`, {}),
};
export async function hashText(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
async function sourceInputHash(result: CatalogResult) {
  const input: CatalogInput = { schema: result.schema, language: result.language, products: result.products.map(row => row.source) };
  return hashText(canonicalInput(input));
}
export async function verifyAcceptanceReview(review: AcceptanceReview): Promise<void> {
  const policy = parseAcceptancePolicy(review.acceptance, review.result.products.length);
  const inputHash = await sourceInputHash(review.result);
  const acceptanceHash = await hashText(canonicalAcceptance(policy));
  const orderHash = await hashText(canonicalOrder(inputHash, acceptanceHash));
  if (review.inputHash !== inputHash || review.result.inputHash !== inputHash || review.acceptanceHash !== acceptanceHash || review.orderHash !== orderHash) {
    throw new Error('The source and acceptance hashes did not match. Delegation is blocked; review the batch again.');
  }
}
export async function verifyNextDelivery(job: NextJob, expected?: Pick<AcceptanceReview, 'inputHash' | 'acceptanceHash' | 'orderHash'> | null): Promise<VerifiedDelivery> {
  if (job.status !== 'complete' || !job.result || !job.manifest || !job.payment?.receipt) throw new Error('A complete result, delivery manifest and confirmed receipt are required.');
  const manifest = job.manifest;
  const inputHash = await sourceInputHash(job.result);
  const policy = parseAcceptancePolicy(job.acceptance, job.result.products.length);
  const acceptanceHash = await hashText(canonicalAcceptance(policy));
  const orderHash = await hashText(canonicalOrder(inputHash, acceptanceHash));
  const resultHash = await hashText(canonicalResult(job.result));
  const receipt = job.payment.receipt;
  const manifestReceipt = manifest.receipt as Record<string, unknown> | null;
  const extra = receipt.extra as Record<string, unknown> | undefined;
  const manifestExtra = manifestReceipt?.extra as Record<string, unknown> | undefined;
  const quoteBinding = job.payment.quote?.extensions?.['listing-acceptance']?.info;
  const readyCount = job.result.products.filter(product => product.status === 'ready').length;
  if (job.payment.mandate?.acceptanceHash !== acceptanceHash || job.payment.mandate?.orderHash !== orderHash || quoteBinding?.inputHash !== inputHash || quoteBinding?.acceptanceHash !== acceptanceHash || quoteBinding?.orderHash !== orderHash) throw new Error('The payment mandate or quote is not bound to the reviewed source and acceptance rule.');
  if (expected && (expected.inputHash !== inputHash || expected.acceptanceHash !== acceptanceHash || expected.orderHash !== orderHash)) throw new Error('The delivered order differs from the acceptance rule reviewed before delegation.');
  if (job.inputHash !== inputHash || job.result.inputHash !== inputHash || job.acceptanceHash !== acceptanceHash || job.orderHash !== orderHash) throw new Error('The delivered input or acceptance binding is invalid.');
  if (manifest.schema !== 'listing-delivery-v2' || manifest.intentId !== job.id || manifest.inputHash !== inputHash || manifest.acceptanceHash !== acceptanceHash || manifest.orderHash !== orderHash || manifest.resultHash !== resultHash || canonicalAcceptance(manifest.acceptance) !== canonicalAcceptance(policy)) throw new Error('The delivery manifest does not match the received catalog and acceptance rule.');
  if (!manifest.decision.met || manifest.decision.inputHash !== inputHash || manifest.decision.acceptanceHash !== acceptanceHash || manifest.decision.orderHash !== orderHash || !job.decision?.met || job.decision.acceptanceHash !== acceptanceHash || job.result.summary.ready !== readyCount || readyCount < policy.minimumReadyProducts) throw new Error('The delivered catalog has no matching successful acceptance decision.');
  if (job.payment.status !== 'confirmed' || receipt.success !== true || receipt.network !== 'cardano:preprod' || extra?.status !== 'confirmed' || !Number.isInteger(extra?.confirmations) || Number(extra?.confirmations) < 1 || manifest.network !== 'cardano:preprod' || !job.payment.transaction || manifest.transaction !== job.payment.transaction || receipt.transaction !== manifest.transaction || !manifestReceipt || manifestReceipt.success !== true || manifestReceipt.transaction !== manifest.transaction || manifestReceipt.network !== manifest.network || canonicalJson(manifestReceipt) !== canonicalJson(receipt) || manifestExtra?.status !== 'confirmed' || !Number.isInteger(manifestExtra?.confirmations) || Number(manifestExtra?.confirmations) < 1) throw new Error('The delivery receipt is not confirmed or does not match this transaction.');
  return { inputHash, acceptanceHash, orderHash, resultHash, transaction: manifest.transaction };
}
