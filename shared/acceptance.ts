import { SOURCE_FIELDS, type CatalogInput, type CatalogResult } from './catalog.js';

export type DisplayEditField = 'title' | 'description';
export interface AcceptancePolicy {
  schema: 'listing-acceptance-v1';
  minimumReadyProducts: number;
  allowedDisplayEditFields: DisplayEditField[];
}
export interface AcceptanceViolation { code: string; message: string; sku?: string; field?: string }
export interface AcceptanceDecision {
  schema: 'listing-acceptance-decision-v1';
  met: boolean;
  code: 'acceptance_met' | 'acceptance_not_met';
  inputHash: string;
  acceptanceHash: string;
  orderHash: string;
  readyProducts: number;
  minimumReadyProducts: number;
  allowedDisplayEditFields: DisplayEditField[];
  violations: AcceptanceViolation[];
}
export interface DeliveryManifest {
  schema: 'listing-delivery-v2';
  intentId: string;
  inputHash: string;
  acceptanceHash: string;
  orderHash: string;
  resultHash: string;
  acceptance: AcceptancePolicy;
  decision: AcceptanceDecision;
  network: 'cardano:preprod';
  transaction: string;
  receipt: unknown;
  createdAt: string;
}
export class AcceptancePolicyError extends Error {
  readonly status = 422;
  readonly code = 'invalid_acceptance';
  constructor(message: string) { super(message); this.name = 'AcceptancePolicyError'; }
}
/** Closed policy schema. Arrays are sorted into one canonical semantic order. */
export function parseAcceptancePolicy(value: unknown, productCount = 10): AcceptancePolicy {
  if (!Number.isSafeInteger(productCount) || productCount < 1 || productCount > 10) throw new AcceptancePolicyError('Acceptance requires a batch of 1–10 products.');
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'allowedDisplayEditFields,minimumReadyProducts,schema') throw new AcceptancePolicyError('Supply exactly schema, minimumReadyProducts and allowedDisplayEditFields.');
  const policy = value as AcceptancePolicy;
  if (policy.schema !== 'listing-acceptance-v1') throw new AcceptancePolicyError('Only listing-acceptance-v1 conditions are supported.');
  if (!Number.isSafeInteger(policy.minimumReadyProducts) || policy.minimumReadyProducts < 1 || policy.minimumReadyProducts > productCount) throw new AcceptancePolicyError(`Minimum ready products must be an integer from 1 to ${productCount}.`);
  if (!Array.isArray(policy.allowedDisplayEditFields) || policy.allowedDisplayEditFields.length < 1 || policy.allowedDisplayEditFields.length > 2 || policy.allowedDisplayEditFields.some(field => field !== 'title' && field !== 'description') || new Set(policy.allowedDisplayEditFields).size !== policy.allowedDisplayEditFields.length) throw new AcceptancePolicyError('Allow title, description, or both exactly once.');
  return { schema: 'listing-acceptance-v1', minimumReadyProducts: policy.minimumReadyProducts, allowedDisplayEditFields: (['title', 'description'] as const).filter(field => policy.allowedDisplayEditFields.includes(field)) };
}
/** Browser-safe canonical strings: hash UTF-8 bytes with SHA-256 on either side. */
export function canonicalAcceptance(policy: AcceptancePolicy): string { return JSON.stringify(parseAcceptancePolicy(policy)); }
export function canonicalOrder(inputHash: string, acceptanceHash: string): string {
  if (!/^[a-f0-9]{64}$/.test(inputHash) || !/^[a-f0-9]{64}$/.test(acceptanceHash)) throw new AcceptancePolicyError('Order binding needs lowercase SHA-256 input and acceptance hashes.');
  return JSON.stringify({ schema: 'listing-order-v2', inputHash, acceptanceHash });
}
export function canonicalInput(input: CatalogInput): string {
  return JSON.stringify({ schema: input.schema, language: input.language, products: input.products.map(row => Object.fromEntries(SOURCE_FIELDS.map(field => [field, row[field]]))) });
}
/** Result hashes deliberately preserve V1's exact JSON.stringify semantics. */
export function canonicalResult(result: CatalogResult): string { return JSON.stringify(result); }
export function canonicalManifest(manifest: DeliveryManifest): string {
  return JSON.stringify({ schema: manifest.schema, intentId: manifest.intentId, inputHash: manifest.inputHash, acceptanceHash: manifest.acceptanceHash, orderHash: manifest.orderHash, resultHash: manifest.resultHash, acceptance: manifest.acceptance, decision: manifest.decision, network: manifest.network, transaction: manifest.transaction, receipt: manifest.receipt, createdAt: manifest.createdAt });
}
