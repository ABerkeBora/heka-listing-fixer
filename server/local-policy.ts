import type { Request,Response,NextFunction } from 'express';

/** A local browser page may delegate to the wallet; unrelated sites may not. */
export function localOnly(port:number) {
 const hosts=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
 const origins=new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]);
 return (req:Request,res:Response,next:NextFunction)=>{
  if(!hosts.has(req.headers.host??''))return res.status(403).json({error:'Use the local application address.'});
  const origin=req.headers.origin;
  if(origin&&!origins.has(origin))return res.status(403).json({error:'Requests from another website are blocked.'});
  const fetchSite=req.headers['sec-fetch-site'];
  // External links may open the harmless app shell. APIs, assets, embeds and writes stay same-site.
  const shellNavigation=req.method==='GET'&&['/','/next','/next/'].includes(req.path)&&req.headers['sec-fetch-mode']==='navigate'&&req.headers['sec-fetch-dest']==='document';
  if(fetchSite==='cross-site'&&!shellNavigation)return res.status(403).json({error:'Cross-site requests are blocked.'});
  if(['POST','PUT','PATCH','DELETE'].includes(req.method)&&!req.is('application/json'))return res.status(415).json({error:'Send application/json.'});
  next();
 };
}
export const safeError=(error:unknown)=>error instanceof Error?error.message:'The request could not be completed.';
