import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {localOnly} from '../server/local-policy.ts';

test('local delegated wallet API rejects cross-site origin and unsafe content types',async()=>{
 const app=express();let actions=0;
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));
 const addr=server.address();if(!addr||typeof addr==='string')throw new Error();
 app.use(localOnly(addr.port));app.post('/authorize',(_q,r)=>{actions++;r.json({ok:true});});
 const url=`http://127.0.0.1:${addr.port}/authorize`;
 try{
  let response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',origin:'https://malicious.example'},body:'{}'});assert.equal(response.status,403);
  response=await fetch(url,{method:'POST',headers:{'content-type':'text/plain'},body:'{}'});assert.equal(response.status,415);
  response=await fetch(url,{method:'POST',headers:{'content-type':'application/json','sec-fetch-site':'cross-site'},body:'{}'});assert.equal(response.status,403);
  response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',origin:`http://127.0.0.1:${addr.port}`},body:'{}'});assert.equal(response.status,200);assert.equal(actions,1);
 }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});
