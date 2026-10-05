// running on its own local port (scripts/deploy/cli.mjs preview create). Opening /preview/<name>/?player=... on the
// staging site sets a cookie and goes to the site; while the cookie is set, the staging hub sends
//  - everything to the preview's own hub (a preview of the hub or the Book), or
//  - that one game's traffic (/g/<game>/...) to the preview's game (a preview of one game),
// and /preview/exit clears it. The registry is the deploy tool's previews.json (read-only here).
import {readFileSync} from 'node:fs';
export const COOKIE='fg_preview';
const NAME=/^[a-z0-9][a-z0-9-]{1,30}$/;
let cache={at:0,file:null,value:{previews:{}}};
export function readRegistry(file,now=Date.now()){
 if(cache.file===file&&now-cache.at<2000)return cache.value;
 let value={previews:{}};try{value=JSON.parse(readFileSync(file,'utf8'));}catch{}
 cache={at:now,file,value};return value;
}
export const running=(reg,name)=>{const p=reg?.previews?.[name];return p&&['active','approved'].includes(p.state)?p:null;};
export function cookieOf(req){const m=String(req.headers?.cookie||'').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-z0-9-]{2,31})`));return m?m[1]:null;}
// What to do with a request on the staging site. Returns null (serve normally) or one of:
//  {kind:'enter', name, location, cookie}  {kind:'exit', location, cookie}  {kind:'unknown', location, cookie}
//  {kind:'hub', preview}  {kind:'game', preview}
export function previewRoute(req,url,reg){
 const m=url.pathname.match(/^\/preview\/([^/]+)\/?$/);
 if(url.pathname==='/preview/exit'||url.pathname==='/preview/exit/')return {kind:'exit',location:'/'+(url.search||''),cookie:`${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`};
 if(m){const name=m[1],p=NAME.test(name)&&running(reg,name);
  if(!p)return {kind:'unknown',name,location:'/',cookie:`${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`};
  const player=url.searchParams.get('player');
  const hash=p.game==='hub'?'':`#${p.card||p.game}`;
  return {kind:'enter',name,location:`/${player?`?player=${encodeURIComponent(player)}`:''}${hash}`,cookie:`${COOKIE}=${name}; Path=/; Max-Age=43200; SameSite=Lax`};}
 const name=cookieOf(req),p=name&&running(reg,name);
 if(!p)return null;
 if(p.game==='hub')return {kind:'hub',preview:p};
 if(url.pathname.startsWith(`/g/${p.game}/`))return {kind:'game',preview:p};
 return null;
}
// The small banner (grown-ups can leave the preview from it).
export const bannerHTML=name=>`<div role="note" style="position:fixed;z-index:99999;top:0;left:8px;background:#6a1b9a;color:#fff;font:700 13px/1.2 system-ui,sans-serif;padding:4px 10px;border-radius:0 0 10px 10px;letter-spacing:.06em">PREVIEW · ${String(name).replace(/[^a-z0-9-]/g,'')} · <a href="/preview/exit" style="color:#fff">exit</a></div>`;
