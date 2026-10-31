import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {request as httpRequest} from 'node:http';
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


test('cross-site top-level GET may open only the app shell; APIs, assets, embeds and writes remain blocked',async()=>{
 const app=express();let writes=0;
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));
 const addr=server.address();if(!addr||typeof addr==='string')throw new Error();
 app.use(localOnly(addr.port));
 app.get('/',(_q,r)=>r.send('<main>Listing Fixer</main>'));
 app.get('/next',(_q,r)=>r.send('<main>Listing Fixer acceptance</main>'));
 app.get('/api/status',(_q,r)=>r.json({privateStatus:true}));
 app.get('/assets/app.js',(_q,r)=>r.send('private asset'));
 app.post(['/', '/api/authorize'],(_q,r)=>{writes++;r.json({ok:true});});
 const root=`http://127.0.0.1:${addr.port}`;
 // node:http preserves Fetch Metadata exactly, so these exercise the real HTTP middleware.
 const read=(path:string,method='GET',headers:Record<string,string>={})=>new Promise<{status:number;body:string}>((resolve,reject)=>{
  const req=httpRequest(`${root}${path}`,{method,headers:{'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document',...headers}},res=>{
   let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode??0,body}));
  });req.on('error',reject);req.end(method==='POST'?'{}':undefined);
 });
 try{
  const shell=await read('/');assert.equal(shell.status,200);assert.match(shell.body,/Listing Fixer/);
  assert.equal((await read('/next')).status,200);
  assert.equal((await read('/api/next/status')).status,403);
  assert.equal((await read('/next','GET',{'sec-fetch-dest':'iframe'})).status,403);
  assert.equal((await read('/api/status')).status,403);
  assert.equal((await read('/assets/app.js')).status,403);
  assert.equal((await read('/','POST',{'content-type':'application/json'})).status,403);
  assert.equal((await read('/api/authorize','POST',{'content-type':'application/json'})).status,403);
  assert.equal((await read('/','GET',{'sec-fetch-mode':'cors'})).status,403);
  assert.equal((await read('/','GET',{'sec-fetch-dest':'iframe'})).status,403);
  assert.equal((await read('/','GET',{origin:'https://malicious.example'})).status,403);
  assert.equal(writes,0);
 }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});
