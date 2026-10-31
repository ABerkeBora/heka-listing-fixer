import { DatabaseSync } from 'node:sqlite';
import { mkdirSync,chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CatalogInput, CatalogResult } from '../shared/catalog.ts';

export type JobStatus = 'blocked'|'quoted'|'payment_pending'|'processing'|'complete'|'failed'|'receipt_unresolved';
export type JobEvent = {at:string;stage:string;message:string};
export type Job = {
 id:string;inputHash:string;status:JobStatus;createdAt:string;updatedAt:string;
 input:CatalogInput; mandate:Record<string,unknown>; events:JobEvent[];
 result?:CatalogResult; resource?:CatalogResult; payment?:unknown;error?:string;
};

export class JobStore {
 readonly db:DatabaseSync;
 constructor(path:string) {
  mkdirSync(dirname(path),{recursive:true,mode:0o700}); chmodSync(dirname(path),0o700); this.db=new DatabaseSync(path); chmodSync(path,0o600);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY,input_hash TEXT NOT NULL UNIQUE,body TEXT NOT NULL);
  `);
 }
 get(id:string):Job|undefined { const row=this.db.prepare('SELECT body FROM jobs WHERE id=?').get(id) as {body:string}|undefined; return row?JSON.parse(row.body):undefined; }
 byInput(hash:string):Job|undefined { const row=this.db.prepare('SELECT body FROM jobs WHERE input_hash=?').get(hash) as {body:string}|undefined; return row?JSON.parse(row.body):undefined; }
 put(job:Job) {job.updatedAt=new Date().toISOString(); this.db.prepare('INSERT INTO jobs(id,input_hash,body) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(job.id,job.inputHash,JSON.stringify(job));return job;}
 patch(id:string,patch:Partial<Job>,event?:{stage:string;message:string}) {const j=this.get(id);if(!j)throw new Error('Unknown job');Object.assign(j,patch);if(event)j.events.push({at:new Date().toISOString(),...event});return this.put(j);}
 unfinished():Job[]{return (this.db.prepare('SELECT body FROM jobs').all() as {body:string}[]).map(r=>JSON.parse(r.body)).filter((j:Job)=>!['complete','blocked','failed'].includes(j.status));}
 close(){this.db.close();}
}
export function publicJob(job:Job){const {input,resource,...safe}=job;return {...safe,sourceInput:JSON.stringify(input,null,2),sourceFormat:'json' as const};}
