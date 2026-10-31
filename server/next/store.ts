import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname} from 'node:path';
import type {CatalogInput,CatalogResult} from '../../shared/catalog.ts';
import type {AcceptancePolicy} from '../../shared/acceptance.ts';
import type {validateAcceptance,createDeliveryManifest} from '../acceptance.ts';
import type {PaymentMandate} from '../payment/policy.ts';
import type {PublicPaymentIntent} from '../payment/index.ts';

export type NextJobStatus='quoted'|'payment_pending'|'processing'|'complete'|'blocked'|'failed'|'receipt_unresolved'|'acceptance_not_met';
export interface NextJob {
 id:string;inputHash:string;orderHash:string;acceptanceHash:string;acceptance:AcceptancePolicy;
 input:CatalogInput;mandate:PaymentMandate;status:NextJobStatus;createdAt:string;updatedAt:string;
 events:{at:string;stage:string;message:string}[];
 resource?:CatalogResult;result?:CatalogResult;decision?:ReturnType<typeof validateAcceptance>;
 manifest?:ReturnType<typeof createDeliveryManifest>;payment?:PublicPaymentIntent;error?:string;
}
/** V2 identity is input + immutable acceptance, never the V1 input-only namespace. */
export class NextJobStore {
 readonly db:DatabaseSync;
 constructor(path='data/v2-jobs.sqlite'){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});
  this.db=new DatabaseSync(path);
  this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS next_jobs(id TEXT PRIMARY KEY,order_hash TEXT UNIQUE NOT NULL,body TEXT NOT NULL);');
  if(path!==':memory:')chmodSync(path,0o600);
 }
 get(id:string):NextJob|undefined{const row=this.db.prepare('SELECT body FROM next_jobs WHERE id=?').get(id);return row?JSON.parse(String(row.body)):undefined;}
 byOrder(hash:string):NextJob|undefined{const row=this.db.prepare('SELECT body FROM next_jobs WHERE order_hash=?').get(hash);return row?JSON.parse(String(row.body)):undefined;}
 put(job:NextJob){job.updatedAt=new Date().toISOString();this.db.prepare('INSERT INTO next_jobs(id,order_hash,body) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(job.id,job.orderHash,JSON.stringify(job));return job;}
 patch(id:string,patch:Partial<NextJob>,event?:{stage:string;message:string}){const job=this.get(id);if(!job)throw new Error('Unknown V2 job.');Object.assign(job,patch);if(event)job.events.push({at:new Date().toISOString(),...event});return this.put(job);}
 unfinished(){return(this.db.prepare('SELECT body FROM next_jobs').all()).map(row=>JSON.parse(String(row.body)) as NextJob).filter(j=>!['complete','blocked','failed','acceptance_not_met'].includes(j.status));}
 close(){this.db.close();}
}
export function publicNextJob(job:NextJob){const {input,resource,...safe}=job;return {...safe,sourceInput:JSON.stringify(input,null,2),sourceFormat:'json' as const};}
