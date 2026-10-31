import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import type { PaymentMandate } from './policy.js';
import type { PaymentPayload, PaymentRequired, SettleResponse } from '@x402/core/types';

export type PaymentStatus = 'ready'|'quoting'|'quoted'|'signing'|'signed'|'payment_pending'|'confirmed'|'blocked'|'rejected'|'processing_failed'|'receipt_unresolved';
export interface PaymentEvent { at:string; decision:string; detail:string; }
export interface IntentRecord {
  id:string; inputHash:string; mandate:PaymentMandate; status:PaymentStatus; reason:string|null;
  quote:PaymentRequired|null; payload:PaymentPayload|null; transaction:string|null; networkFeeLovelace:string|null;
  result:unknown; receipt:SettleResponse|null; events:PaymentEvent[]; createdAt:string; updatedAt:string;
  verified:boolean;
}
export class PaymentStore {
  readonly db:DatabaseSync;
  constructor(path:string) {
    if(path!==':memory:') mkdirSync(dirname(path),{recursive:true,mode:0o700});
    this.db=new DatabaseSync(path); this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    this.db.exec(`CREATE TABLE IF NOT EXISTS payment_intents (id TEXT PRIMARY KEY,input_hash TEXT UNIQUE NOT NULL,transaction_hash TEXT UNIQUE,record TEXT NOT NULL);`);
    if(path!==':memory:') chmodSync(path,0o600);
  }
  get(id:string):IntentRecord|null {const row=this.db.prepare('SELECT record FROM payment_intents WHERE id=?').get(id);return row?JSON.parse(String(row.record)):null;}
  byInput(hash:string):IntentRecord|null {const row=this.db.prepare('SELECT record FROM payment_intents WHERE input_hash=?').get(hash);return row?JSON.parse(String(row.record)):null;}
  byTransaction(hash:string):IntentRecord|null {const row=this.db.prepare('SELECT record FROM payment_intents WHERE transaction_hash=?').get(hash);return row?JSON.parse(String(row.record)):null;}
  all():IntentRecord[] {return this.db.prepare('SELECT record FROM payment_intents').all().map(r=>JSON.parse(String(r.record)));}
  save(record:IntentRecord):void {record.updatedAt=new Date().toISOString();this.db.prepare('INSERT INTO payment_intents (id,input_hash,transaction_hash,record) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET transaction_hash=excluded.transaction_hash,record=excluded.record').run(record.id,record.inputHash,record.transaction,JSON.stringify(record));}
  event(id:string,decision:string,detail:string,status?:PaymentStatus,reason?:string|null):IntentRecord {const r=this.get(id);if(!r)throw new Error('Unknown payment intent.');r.events.push({at:new Date().toISOString(),decision,detail});if(status)r.status=status;if(reason!==undefined)r.reason=reason;this.save(r);return r;}
  close():void {this.db.close();}
}
export function publicPaymentIntent(r:IntentRecord) {
  return {intentId:r.id,inputHash:r.inputHash,mandate:r.mandate,status:r.status,reason:r.reason,quote:r.quote,transaction:r.transaction,hasSignedPayload:Boolean(r.payload),
    explorerUrl:r.transaction?`https://preprod.cardanoscan.io/transaction/${r.transaction}`:null,
    servicePriceLovelace:r.quote?.accepts[0]?.amount??null,networkFeeLovelace:r.networkFeeLovelace,
    facilitatorFeeLovelace:null, // Not quoted or measured separately by this hosted facilitator.
    sellerNetLovelace:r.receipt?.success?r.quote?.accepts[0]?.amount??null:null,
    receipt:r.receipt,result:r.status==='confirmed'?r.result:null,events:r.events,createdAt:r.createdAt,updatedAt:r.updatedAt};
}
export type PublicPaymentIntent=ReturnType<typeof publicPaymentIntent>;
