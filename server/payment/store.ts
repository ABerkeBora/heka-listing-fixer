import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import type { PaymentMandate } from './policy.js';
import type { PaymentPayload, PaymentRequired, SettleResponse } from '@x402/core/types';

export type PaymentStatus = 'ready'|'quoting'|'quoted'|'signing'|'signed'|'payment_pending'|'confirmed'|'blocked'|'rejected'|'processing_failed'|'receipt_unresolved'|'acceptance_not_met';
export interface PaymentEvent { at:string; decision:string; detail:string; }
export interface IntentRecord {
  id:string; inputHash:string; mandate:PaymentMandate; status:PaymentStatus; reason:string|null;
  quote:PaymentRequired|null; payload:PaymentPayload|null; transaction:string|null; networkFeeLovelace:string|null;
  result:unknown; receipt:SettleResponse|null; events:PaymentEvent[]; createdAt:string; updatedAt:string;
  verified:boolean;
  settlementCalls?:number;
  dedupeKey?:string;
}
export class PaymentStore {
  readonly db:DatabaseSync;
  constructor(path:string,private options:{dedupeBy?:'inputHash'|'orderHash'}={}) {
    if(path!==':memory:') mkdirSync(dirname(path),{recursive:true,mode:0o700});
    this.db=new DatabaseSync(path); this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    if(options.dedupeBy==='orderHash') {
      this.db.exec(`CREATE TABLE IF NOT EXISTS payment_intents (id TEXT PRIMARY KEY,input_hash TEXT NOT NULL,dedupe_key TEXT UNIQUE NOT NULL,transaction_hash TEXT UNIQUE,record TEXT NOT NULL);`);
      const columns=this.db.prepare('PRAGMA table_info(payment_intents)').all();if(!columns.some(c=>c.name==='dedupe_key')){this.db.close();throw new Error('Order-bound payment service requires a separate V2 database.');}
    } else this.db.exec(`CREATE TABLE IF NOT EXISTS payment_intents (id TEXT PRIMARY KEY,input_hash TEXT UNIQUE NOT NULL,transaction_hash TEXT UNIQUE,record TEXT NOT NULL);`);
    if(path!==':memory:') chmodSync(path,0o600);
  }
  get(id:string):IntentRecord|null {const row=this.db.prepare('SELECT record FROM payment_intents WHERE id=?').get(id);return row?JSON.parse(String(row.record)):null;}
  byInput(hash:string):IntentRecord|null {const row=this.db.prepare('SELECT record FROM payment_intents WHERE input_hash=?').get(hash);return row?JSON.parse(String(row.record)):null;}
  byTransaction(hash:string):IntentRecord|null {const row=this.db.prepare('SELECT record FROM payment_intents WHERE transaction_hash=?').get(hash);return row?JSON.parse(String(row.record)):null;}
  byDedupeKey(key:string):IntentRecord|null {const column=this.options.dedupeBy==='orderHash'?'dedupe_key':'input_hash';const row=this.db.prepare(`SELECT record FROM payment_intents WHERE ${column}=?`).get(key);return row?JSON.parse(String(row.record)):null;}
  all():IntentRecord[] {return this.db.prepare('SELECT record FROM payment_intents').all().map(r=>JSON.parse(String(r.record)));}
  save(record:IntentRecord):void {record.updatedAt=new Date().toISOString();
    if(this.options.dedupeBy==='orderHash') {
      const key=record.dedupeKey??record.mandate.orderHash;if(!key||!/^[a-f0-9]{64}$/.test(key))throw new Error('V2 payment requires a canonical order deduplication key.');
      this.db.prepare('INSERT INTO payment_intents (id,input_hash,dedupe_key,transaction_hash,record) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET transaction_hash=excluded.transaction_hash,record=excluded.record').run(record.id,record.inputHash,key,record.transaction,JSON.stringify(record));
    } else this.db.prepare('INSERT INTO payment_intents (id,input_hash,transaction_hash,record) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET transaction_hash=excluded.transaction_hash,record=excluded.record').run(record.id,record.inputHash,record.transaction,JSON.stringify(record));
  }
  event(id:string,decision:string,detail:string,status?:PaymentStatus,reason?:string|null):IntentRecord {const r=this.get(id);if(!r)throw new Error('Unknown payment intent.');r.events.push({at:new Date().toISOString(),decision,detail});if(status)r.status=status;if(reason!==undefined)r.reason=reason;this.save(r);return r;}
  close():void {this.db.close();}
}
export function publicPaymentIntent(r:IntentRecord) {
  return {intentId:r.id,inputHash:r.inputHash,mandate:r.mandate,status:r.status,reason:r.reason,quote:r.quote,transaction:r.transaction,hasSignedPayload:Boolean(r.payload),settlementCalls:r.settlementCalls??null,acceptanceHash:r.mandate.acceptanceHash??null,orderHash:r.mandate.orderHash??null,
    explorerUrl:r.transaction?`https://preprod.cardanoscan.io/transaction/${r.transaction}`:null,
    servicePriceLovelace:r.quote?.accepts[0]?.amount??null,networkFeeLovelace:r.networkFeeLovelace,
    facilitatorFeeLovelace:null, // Not quoted or measured separately by this hosted facilitator.
    sellerNetLovelace:r.receipt?.success?r.quote?.accepts[0]?.amount??null:null,
    receipt:r.receipt,result:r.status==='confirmed'?r.result:null,events:r.events,createdAt:r.createdAt,updatedAt:r.updatedAt};
}
export type PublicPaymentIntent=ReturnType<typeof publicPaymentIntent>;
