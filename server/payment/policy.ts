import { Address } from '@evolution-sdk/evolution';
import { decodeCardanoTransaction, slotToPosixMs, type DecodedCardanoTransaction } from '@x402/cardano';
import type { PaymentRequired, PaymentRequirements, SettleResponse } from '@x402/core/types';

export const NETWORK = 'cardano:preprod' as const;
export const ASSET = 'lovelace' as const;
export const SERVICE_PRICE = '2000000';
export interface PaymentMandate {
  network: typeof NETWORK;
  asset: typeof ASSET;
  allowedSeller: string;
  endpoint: string;
  beneficiary: string;
  serviceCapLovelace: string;
  feeCapLovelace: string;
  apiFeeCapLovelace: '0';
  totalCapLovelace: string;
  expiresAt: string;
  maxActions: 1;
}
export class PaymentPolicyError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'PaymentPolicyError'; }
}
export function reject(code: string, message: string): never { throw new PaymentPolicyError(code, message); }
export function atomic(value: unknown, name: string, allowZero = false): bigint {
  if (typeof value !== 'string' || !(allowZero ? /^(0|[1-9]\d*)$/ : /^[1-9]\d*$/).test(value) || value.length > 20)
    reject('invalid_amount', `${name} must be a canonical integer lovelace string.`);
  return BigInt(value as string);
}
export function validatePreprodAddress(address: string): void {
  try {
    if (!address.startsWith('addr_test1')) throw new Error();
    const parsed=Address.fromBech32(address);
    if(Address.getPaymentCredential(Address.toHex(parsed))?._tag!=='KeyHash')throw new Error();
  } catch { reject('invalid_seller', 'Seller must be a valid Cardano testnet address.'); }
}
export function validateMandate(m: PaymentMandate, seller: string, endpoint: string, now = Date.now()): void {
  if (!m || m.network !== NETWORK || m.asset !== ASSET) reject('network_asset_denied', 'Only Cardano preprod lovelace is authorized.');
  if(m.apiFeeCapLovelace!=='0')reject('api_fee_denied','No extra paid API charges are authorized.');
  validatePreprodAddress(m.allowedSeller);
  if (m.allowedSeller !== seller) reject('seller_denied', 'The seller is outside this delegation.');
  if (m.endpoint !== endpoint) reject('endpoint_denied', 'The endpoint is outside this delegation.');
  if (!m.beneficiary || m.beneficiary.length > 160) reject('invalid_beneficiary', 'A bounded buyer beneficiary is required.');
  if (m.maxActions !== 1) reject('action_limit', 'Exactly one logical paid batch is allowed.');
  const service = atomic(m.serviceCapLovelace, 'Service cap');
  const fee = atomic(m.feeCapLovelace, 'Network fee cap', true);
  const total = atomic(m.totalCapLovelace, 'Total cap');
  if (total < service + fee) reject('invalid_total_cap', 'Total cap must cover the separate service and fee caps.');
  // Small isolated test budgets only; changing these requires an explicit code decision.
  if (service > 5_000_000n || fee > 1_000_000n || total > 6_000_000n) reject('test_budget_limit', 'Delegation exceeds the isolated test budget ceiling.');
  const expiry = Date.parse(m.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now) reject('mandate_expired', 'The delegation has expired.');
  if (expiry > now + 30 * 60_000) reject('expiry_too_far', 'Delegations last at most 30 minutes.');
}
export function validateQuote(q: PaymentRequired, m: PaymentMandate, seller: string, endpoint: string, now = Date.now()): PaymentRequirements {
  validateMandate(m, seller, endpoint, now);
  if (q.x402Version !== 2 || q.resource?.url !== endpoint || q.accepts?.length !== 1)
    reject('quote_binding', 'Quote must bind the exact protected batch endpoint and one x402 v2 offer.');
  const r = q.accepts[0]!;
  if (r.scheme !== 'exact' || r.network !== NETWORK || r.asset !== ASSET) reject('network_asset_denied', 'Quote selected an unauthorized scheme, network or asset.');
  if (r.payTo !== seller || r.payTo !== m.allowedSeller) reject('seller_denied', 'Quote redirects payment to another recipient.');
  const amount = atomic(r.amount, 'Service price');
  if (amount !== BigInt(SERVICE_PRICE)) reject('price_changed', 'The pinned service price changed.');
  if (amount > atomic(m.serviceCapLovelace, 'Service cap')) reject('over_budget', 'Service price exceeds the delegated service cap.');
  if (amount + atomic(m.feeCapLovelace, 'Network fee cap', true) > atomic(m.totalCapLovelace, 'Total cap')) reject('over_budget', 'Service and fee reservation exceed the total cap.');
  if (!Number.isSafeInteger(r.maxTimeoutSeconds) || r.maxTimeoutSeconds < 1 || r.maxTimeoutSeconds > 600)
    reject('invalid_timeout', 'Quote validity must be between 1 and 600 seconds.');
  const extra = r.extra ?? {};
  // Keep this product on direct address payments. Never accept arbitrary scripts or an escrow as a substitution.
  if (Object.keys(extra).some(k => !['confirmationPolicy', 'areFeesSponsored'].includes(k)))
    reject('unsupported_payment_terms', 'Quote contains unsupported payment terms.');
  if (extra.areFeesSponsored !== undefined && extra.areFeesSponsored !== false)
    reject('unsupported_payment_terms', 'Fee sponsorship is not supported.');
  const policy = extra.confirmationPolicy as {l1Confirmations?: unknown} | undefined;
  if (!policy || Object.keys(policy).some(k => k !== 'l1Confirmations') || !Number.isInteger(policy.l1Confirmations) || Number(policy.l1Confirmations) < 1 || Number(policy.l1Confirmations) > 20)
    reject('confirmation_policy', 'At least one newer canonical block is required.');
  return r;
}
export function validateDecodedTransaction(tx: DecodedCardanoTransaction, nonce: string, buyer: string, m: PaymentMandate, amount: string, now = Date.now()): void {
  if(m.apiFeeCapLovelace!=='0')reject('api_fee_denied','No extra paid API charges are authorized.');
  if (!tx.isValid || !tx.signaturesValid || tx.vkeyWitnessCount < 1 || tx.networkId === 1) reject('invalid_transaction', 'Transaction must carry valid testnet signatures.');
  if (!tx.inputs.includes(nonce)) reject('nonce_mismatch', 'Payment nonce is absent from the signed inputs.');
  if (tx.balanceChangingOperations.length || tx.scriptWitnessCount || tx.redeemerCount) reject('unsupported_transaction', 'Only a simple ADA service payment is permitted.');
  if (tx.fee > atomic(m.feeCapLovelace, 'Network fee cap', true)) reject('fee_over_budget', 'Exact signed network fee exceeds the delegated fee cap.');
  if (tx.fee + atomic(amount, 'Service price') > atomic(m.totalCapLovelace, 'Total cap')) reject('over_budget', 'Exact total spend exceeds the delegation.');
  const sellerOutputs = tx.outputs.filter(o => o.address === m.allowedSeller);
  if (sellerOutputs.length !== 1 || sellerOutputs[0]!.coin !== BigInt(amount)) reject('seller_output_mismatch', 'Signed transaction must pay the exact service price to the approved seller.');
  for (const o of tx.outputs) {
    if (o.address !== m.allowedSeller && o.address !== buyer) reject('unauthorized_output', 'Signed transaction includes an unauthorized recipient.');
    if (Object.values(o.assets).some(v => v !== 0n) || o.datum || o.hasReferenceScript) reject('unsupported_output', 'Only lovelace outputs without scripts or datums are permitted.');
  }
  if (buyer === m.allowedSeller) reject('self_payment_denied', 'Buyer and seller must be distinct roles and addresses.');
  if (tx.ttlSlot === undefined || slotToPosixMs(NETWORK, tx.ttlSlot) > Date.parse(m.expiresAt) || slotToPosixMs(NETWORK, tx.ttlSlot) <= now)
    reject('transaction_expiry', 'Signed transaction must expire within the delegation.');
}
export function inspectSignedTransaction(transaction: string, nonce: string, buyer: string, m: PaymentMandate, amount: string): DecodedCardanoTransaction {
  const tx = decodeCardanoTransaction(transaction);
  validateDecodedTransaction(tx, nonce, buyer, m, amount);
  return tx;
}

export function validateReceiptBinding(receipt:SettleResponse, transaction:string|null, binding:{intentId:string;inputHash:string}, delivered:{intentId?:string;inputHash?:string}):void {
  if(!receipt.success||!transaction||receipt.transaction!==transaction||receipt.network!==NETWORK||binding.intentId!==delivered.intentId||binding.inputHash!==delivered.inputHash)
    reject('receipt_mismatch','Payment receipt does not match the requested catalog result.');
  if(receipt.extra?.status!=='confirmed'||!Number.isInteger(receipt.extra?.confirmations)||Number(receipt.extra?.confirmations)<1)
    reject('confirmation_policy','Receipt does not meet the minimum confirmation policy.');
}

/** The purchased resource is the model-checked catalog, never the free source review. */
export function validatePaidCatalogResult(value:unknown,inputHash:string):void {
  if(!value||typeof value!=='object'||Array.isArray(value))reject('result_binding','Seller did not produce the purchased catalog result.');
  const r=value as Record<string,unknown>;
  if(r.inputHash!==inputHash||r.schema!=='listing-v1'||r.language!=='en'||r.mode!=='model_checked')reject('result_binding','Seller result is bound to a different input or service.');
  const model=r.model as Record<string,unknown>|null;
  if(!model||model.provider!=='ollama'||model.called!==true)reject('result_binding','Paid catalog service must include its actual model call.');
  if(!Number.isInteger(model.acceptedEdits)||Number(model.acceptedEdits)<1||Number(model.acceptedEdits)>20||!Number.isInteger(model.rejectedEdits)||Number(model.rejectedEdits)<0||Number(model.rejectedEdits)>20||Number(model.acceptedEdits)+Number(model.rejectedEdits)>20)
    reject('result_binding','Paid catalog service must deliver at least one useful validated source composition.');
  if(!Array.isArray(r.products)||r.products.length<1||r.products.length>10)reject('result_binding','Seller returned an invalid catalog size.');
  const normalized=(text:string)=>text.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
  const usefulComposition=r.products.some(row=>{
    if(!row||typeof row!=='object'||!Array.isArray((row as {diffs?:unknown}).diffs))return false;
    return ((row as {diffs:unknown[]}).diffs).some(value=>{
      if(!value||typeof value!=='object')return false;
      const d=value as {before?:unknown;after?:unknown;source?:{parts?:{field?:unknown;text?:unknown}[]}};
      if(typeof d.before!=='string'||typeof d.after!=='string'||normalized(d.before)===normalized(d.after)||!Array.isArray(d.source?.parts)||d.source.parts.length<2)return false;
      const before=normalized(d.before),after=normalized(d.after);
      return d.source.parts.some(part=>part.field==='sourceText'&&typeof part.text==='string'&&normalized(part.text).length>0&&!before.includes(normalized(part.text))&&after.includes(normalized(part.text)));
    });
  });
  if(!usefulComposition)reject('result_binding','Paid catalog must add a validated source detail to at least one composed field.');
  const summary=r.summary as Record<string,unknown>|null;
  const statuses=r.products.map(row=>row&&typeof row==='object'?(row as {status?:unknown}).status:undefined);
  if(statuses.some(status=>!['ready','needs_source','review'].includes(String(status)))||!summary||summary.total!==r.products.length||summary.ready!==statuses.filter(status=>status==='ready').length||summary.needsSource!==statuses.filter(status=>status==='needs_source').length||summary.review!==statuses.filter(status=>status==='review').length)
    reject('result_binding','Seller result counts do not match its checked product rows.');
}
