import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {rewriteText,proxy} from '../proxy.mjs';
test('Root assets, imports, APIs, CSS and voice URLs stay scoped without corrupting router separators',()=>{const p='/g/word-arcade/admin/';assert.equal(rewriteText('fetch(`/api/${id}`); import "/assets/x.js"; const slash="/"; const https="https://example.com/a";',p),'fetch(`/g/word-arcade/admin/api/${id}`); import "/g/word-arcade/admin/assets/x.js"; const slash="/"; const https="https://example.com/a";');assert.equal(rewriteText('url(/icons/a.png)',p),'url(/g/word-arcade/admin/icons/a.png)');});
test('Concatenated action/event suffixes are not mistaken for root paths',()=>{assert.equal(rewriteText('`/api/${id}` + "/events"','/g/game/admin/'),'`/g/game/admin/api/${id}` + "/events"');});
test('Proxy rewrites app traffic, strips credentials, preserves body and constrains player',async()=>{
 let received;const up=http.createServer(async(req,res)=>{let body='';for await(const b of req)body+=b;received={headers:req.headers,url:req.url,body};res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; frame-ancestors 'none'");res.setHeader('Content-Type','text/html');res.end('<html><head><script src="/app.mjs"></script></head></html>');});await new Promise(r=>up.listen(0,'127.0.0.1',r));
 const hub=http.createServer((req,res)=>proxy(req,res,{port:up.address().port,prefix:'/g/game/admin/',path:req.url,player:'admin',players:['admin','beginner'],game:'game'},()=>{}));await new Promise(r=>hub.listen(0,'127.0.0.1',r));
 try{const base='http://127.0.0.1:'+hub.address().port;const r=await fetch(base+'/?player=beginner',{method:'POST',headers:{Origin:'http://localhost:9999',Cookie:'private=1',Authorization:'secret'},body:'keep-this'});const html=await r.text();assert(html.includes('src="/g/game/admin/app.mjs"'));assert(html.includes('src="/bridge.mjs"'));assert(html.includes('href="/embedded.css"'));assert(html.indexOf('/embedded.css')<html.indexOf('/g/game/admin/app.mjs'));assert.equal(r.headers.get('x-frame-options'),'SAMEORIGIN');assert(r.headers.get('content-security-policy').includes("frame-ancestors 'self'"));assert.equal(received.url,'/?player=admin');assert.equal(received.body,'keep-this');assert.equal(received.headers.cookie,undefined);assert.equal(received.headers.authorization,undefined);assert.equal((await fetch(base+'/api/beginner')).status,409);}finally{hub.closeAllConnections();up.closeAllConnections();await Promise.all([new Promise(r=>hub.close(r)),new Promise(r=>up.close(r))]);}
});
test('Proxy caching: no-store only for pages and APIs, upstream long cache kept, ETag 304s pass through, text compressed and remembered',async()=>{
 const {cacheFor,REWRITE_V}=await import('../proxy.mjs');const {gunzipSync}=await import('node:zlib');
 assert.equal(cacheFor('/','text/html'),'no-store');assert.equal(cacheFor('/api/x','application/json','max-age=60'),'no-store');
 assert.equal(cacheFor('/assets/a.js','text/javascript','public, max-age=31536000, immutable'),'public, max-age=31536000, immutable');assert.equal(cacheFor('/app.js','text/javascript','no-store'),'no-cache');
 let hits=0,cond=null;const js='import "/assets/b.js";\n'+'const filler = "'+'x'.repeat(4000)+'";\n';
 const up=http.createServer((req,res)=>{hits++;cond=req.headers['if-none-match']||null;if(cond==='"v1"'){res.writeHead(304,{ETag:'"v1"'});return res.end();}
  res.writeHead(200,{'Content-Type':'text/javascript','ETag':'"v1"','Cache-Control':'public, max-age=31536000, immutable'});res.end(js);});
 await new Promise(r=>up.listen(0,'127.0.0.1',r));
 const hub=http.createServer((req,res)=>proxy(req,res,{port:up.address().port,prefix:'/g/game/admin/',path:req.url,player:'admin',players:['admin'],game:'game'},()=>{}));await new Promise(r=>hub.listen(0,'127.0.0.1',r));
 const get=(h={})=>new Promise(ok=>http.get({host:'127.0.0.1',port:hub.address().port,path:'/assets/a.js',headers:h},r=>{const c=[];r.on('data',b=>c.push(b));r.on('end',()=>ok({s:r.statusCode,h:r.headers,b:Buffer.concat(c)}));}));
 try{
  const a=await get({'accept-encoding':'gzip'});assert.equal(a.s,200);assert.equal(a.h['content-encoding'],'gzip');assert.equal(a.h.vary,'Accept-Encoding');
  assert.equal(a.h.etag,`"v1-${REWRITE_V}"`);assert.match(a.h['cache-control'],/immutable/);assert.match(gunzipSync(a.b).toString(),/"\/g\/game\/admin\/assets\/b\.js"/);
  const b=await get({'accept-encoding':'gzip','if-none-match':a.h.etag});assert.equal(b.s,304);assert.equal(cond,'"v1"','the upstream sees its own ETag');
  const n=hits;const c=await get({'accept-encoding':'gzip'});assert.equal(c.s,200);assert.deepEqual(c.b,a.b,'the same rewritten, compressed body');assert.equal(hits,n+1);
  const d=await get({'if-none-match':'"v1-r0"'});assert.equal(d.s,200,'an ETag from an older rewrite is not trusted');assert.equal(cond,null);
 }finally{hub.close();up.close();}
});
