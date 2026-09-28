import http from 'node:http';
import {gunzipSync,brotliDecompressSync,inflateSync,gzipSync,brotliCompressSync,constants as Z} from 'node:zlib';
// Caching through the proxy. The proxy rewrites text (a prefix per game and player, the bridge in HTML), so its
// ETag is the upstream ETag plus the rewrite version: a 304 is only possible when both are unchanged.
export const REWRITE_V='r1';
const ours=e=>e?String(e).replace(/"$/,`-${REWRITE_V}"`):null;
const theirs=e=>{const m=String(e||'').match(/^(W\/)?"(.*)-(r\d+)"$/);return m&&m[3]===REWRITE_V?`${m[1]||''}"${m[2]}"`:null;};
// Rewritten, compressed bodies kept in memory by URL (with prefix) + upstream ETag + encoding (bounded).
const BODIES=new Map();let bodyBytes=0;const MAX_BODIES=64e6;
function remember(k,v){if(BODIES.has(k))return;BODIES.set(k,v);bodyBytes+=v.body.length;while(bodyBytes>MAX_BODIES&&BODIES.size){const [k0,v0]=BODIES.entries().next().value;BODIES.delete(k0);bodyBytes-=v0.body.length;}}
function encodingFor(req){const a=String(req.headers['accept-encoding']||'');return /\bbr\b/.test(a)?'br':/\bgzip\b/.test(a)?'gzip':null;}
function compress(buf,enc){return enc==='br'?brotliCompressSync(buf,{params:{[Z.BROTLI_PARAM_QUALITY]:5}}):enc==='gzip'?gzipSync(buf,{level:6}):buf;}
// No-store only for pages and the game's API; the upstream's own long cache is kept; everything else revalidates.
export function cacheFor(path,type,upstream){if(/html/.test(type||'')||/^\/api\//.test(path))return 'no-store';const u=String(upstream||'');return /max-age=[1-9]|immutable/.test(u)?u:'no-cache';}

// All app-relative traffic stays under a game AND player namespace. Only trusted
// loopback ports from server config are upstreams; callers cannot select hosts.
export function rewriteText(text,prefix){
 // Do not rewrite suffix fragments such as `/events` in base + `/events`.
 return text.replace(/(["'`])\/(?=(?:api|assets|voice|audio|icons|_next)(?:\/|["'`?])|[a-zA-Z0-9_.-]+\.(?:m?js|css|png|svg|ico|json|webmanifest|woff2|wav|mp3)(?:["'`/?])|\?)/g,(_,quote)=>quote+prefix)
  .replace(/url\(\/(?!\/)/g,'url('+prefix);
}
export function proxy(req,res,{port,prefix,path,player,players,game,releases={}},log){
 const attr=v=>String(v||'').replace(/[^\w.:-]/g,'');
 const target=new URL(path,'http://localhost');
 if(target.searchParams.has('player'))target.searchParams.set('player',player);
 const who=target.pathname.match(/^\/api\/([^/]+)/)?.[1];
 if(players.includes(who)&&who!==player){if(/\/events$/.test(target.pathname)){void log({type:'discarded_initial_event',game,player});res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true,"discarded":true}');return;}res.writeHead(409,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Use Grown-ups on the Games home screen to change player.'}));return;}
 const headers={...req.headers,host:`localhost:${port}`,'accept-encoding':'identity','sec-fetch-site':'same-origin'};
 delete headers.cookie;delete headers.authorization;delete headers['if-modified-since'];
 // A conditional request carries the upstream ETag behind ours (dropped when the rewrite has changed since).
 if(headers['if-none-match']){const t=String(headers['if-none-match']).split(',').map(x=>theirs(x.trim())).filter(Boolean);if(t.length)headers['if-none-match']=t.join(', ');else delete headers['if-none-match'];}for(const k of Object.keys(headers))if(k.startsWith('x-forwarded-')||k.startsWith('tailscale-'))delete headers[k];
 if(headers.origin)headers.origin=`http://localhost:${port}`;
 if(headers.referer)headers.referer=`http://localhost:${port}/?player=${player}`;
 const upstream=http.request({host:'127.0.0.1',port,path:target.pathname+target.search,method:req.method,headers,timeout:15000},r=>{
  const type0=r.headers['content-type']||'',upEtag=r.headers.etag||null;
  const h={...r.headers,'cache-control':cacheFor(target.pathname,type0,r.headers['cache-control']),'x-frame-options':'SAMEORIGIN'};
  delete h.etag;delete h['set-cookie'];delete h['content-length'];delete h['transfer-encoding'];
  const noStore=h['cache-control']==='no-store';if(upEtag&&!noStore)h.etag=ours(upEtag);
  if(r.statusCode===304){delete h['content-type'];res.writeHead(304,h);res.end();r.resume();return;}
  if(h['content-security-policy'])h['content-security-policy']=h['content-security-policy'].replace(/frame-ancestors [^;]+/g,"frame-ancestors 'self'");
  if(h.location?.startsWith('/'))h.location=prefix+h.location.slice(1);
  const type=h['content-type']||'',text=/html|javascript|css|json/.test(type);
  if(!text){if(r.headers['content-length']&&!h['content-encoding'])h['content-length']=r.headers['content-length'];res.writeHead(r.statusCode,h);r.pipe(res);return;}
  const enc=encodingFor(req),key=upEtag&&!noStore&&r.statusCode===200?`${prefix}|${target.pathname}${target.search}|${upEtag}|${enc||'identity'}`:null;
  if(key&&BODIES.has(key)){const hit=BODIES.get(key);r.resume();delete h['content-encoding'];if(enc){h['content-encoding']=enc;h.vary='Accept-Encoding';}h['content-length']=hit.body.length;res.writeHead(200,h);res.end(req.method==='HEAD'?undefined:hit.body);return;}
  const chunks=[];let size=0;r.on('data',b=>{size+=b.length;if(size>12e6){r.destroy();res.destroy();return;}chunks.push(b);});
  r.on('end',()=>{try{
   let b=Buffer.concat(chunks);if(h['content-encoding']==='gzip')b=gunzipSync(b);else if(h['content-encoding']==='br')b=brotliDecompressSync(b);else if(h['content-encoding']==='deflate')b=inflateSync(b);delete h['content-encoding'];
   let body=b.toString();if(/html|javascript|css|json/.test(type))body=rewriteText(body,prefix);
   if(/html/.test(type))body=body.replace(/<head([^>]*)>/i,`<head$1><script src="/bridge.mjs" data-game="${game}" data-player="${player}" data-prefix="${prefix}" data-hub-release="${attr(releases.hub)}" data-game-release="${attr(releases.game)}"></script><link rel="stylesheet" href="/embedded.css">`);
   let out=Buffer.from(body);if(enc&&out.length>1024){out=compress(out,enc);h['content-encoding']=enc;h.vary='Accept-Encoding';}
   if(key&&(!enc||h['content-encoding']))remember(key,{body:out});
   h['content-length']=out.length;res.writeHead(r.statusCode,h);res.end(req.method==='HEAD'?undefined:out);
  }catch(e){log({type:'proxy_error',game,player,detail:e.message});if(!res.headersSent)res.writeHead(502);res.end('Could not load this game. Return to Games and try again.');}});
 });
 upstream.on('timeout',()=>upstream.destroy(new Error('Game timed out')));
 upstream.on('error',e=>{void log({type:'proxy_error',game,player,detail:e.message});
  // ECONNREFUSED = the game never received the request (it is restarting), so clients may safely retry.
  if(!res.headersSent)res.writeHead(503,{'Content-Type':'text/html','Retry-After':'2',...(e.code==='ECONNREFUSED'?{'x-family-retry':'1'}:{})});
  res.end('<meta http-equiv="refresh" content="3"><p>This game is starting. It will open by itself in a moment.</p>');});
 req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
}
