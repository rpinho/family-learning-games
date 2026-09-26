import http from 'node:http';
import {gunzipSync,brotliDecompressSync,inflateSync} from 'node:zlib';
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
 delete headers.cookie;delete headers.authorization;delete headers['if-none-match'];delete headers['if-modified-since'];delete headers['x-forwarded-host'];
 if(headers.origin)headers.origin=`http://localhost:${port}`;
 if(headers.referer)headers.referer=`http://localhost:${port}/?player=${player}`;
 const upstream=http.request({host:'127.0.0.1',port,path:target.pathname+target.search,method:req.method,headers,timeout:15000},r=>{
  const h={...r.headers,'cache-control':'no-store','x-frame-options':'SAMEORIGIN'};
  delete h.etag;delete h['set-cookie'];delete h['content-length'];delete h['transfer-encoding'];
  if(h['content-security-policy'])h['content-security-policy']=h['content-security-policy'].replace(/frame-ancestors [^;]+/g,"frame-ancestors 'self'");
  if(h.location?.startsWith('/'))h.location=prefix+h.location.slice(1);
  const type=h['content-type']||'',text=/html|javascript|css|json/.test(type);
  if(!text){res.writeHead(r.statusCode,h);r.pipe(res);return;}
  const chunks=[];let size=0;r.on('data',b=>{size+=b.length;if(size>12e6){r.destroy();res.destroy();return;}chunks.push(b);});
  r.on('end',()=>{try{
   let b=Buffer.concat(chunks);if(h['content-encoding']==='gzip')b=gunzipSync(b);else if(h['content-encoding']==='br')b=brotliDecompressSync(b);else if(h['content-encoding']==='deflate')b=inflateSync(b);delete h['content-encoding'];
   let body=b.toString();if(/html|javascript|css|json/.test(type))body=rewriteText(body,prefix);
   if(/html/.test(type))body=body.replace(/<head([^>]*)>/i,`<head$1><script src="/bridge.mjs" data-game="${game}" data-player="${player}" data-prefix="${prefix}" data-hub-release="${attr(releases.hub)}" data-game-release="${attr(releases.game)}"></script><link rel="stylesheet" href="/embedded.css">`);
   res.writeHead(r.statusCode,h);res.end(body);
  }catch(e){log({type:'proxy_error',game,player,detail:e.message});if(!res.headersSent)res.writeHead(502);res.end('Could not load this game. Return to Games and try again.');}});
 });
 upstream.on('timeout',()=>upstream.destroy(new Error('Game timed out')));
 upstream.on('error',e=>{void log({type:'proxy_error',game,player,detail:e.message});
  // ECONNREFUSED = the game never received the request (it is restarting), so clients may safely retry.
  if(!res.headersSent)res.writeHead(503,{'Content-Type':'text/html','Retry-After':'2',...(e.code==='ECONNREFUSED'?{'x-family-retry':'1'}:{})});
  res.end('<meta http-equiv="refresh" content="3"><p>This game is starting. It will open by itself in a moment.</p>');});
 req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
}
