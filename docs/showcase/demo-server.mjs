// Public-safe, memory-only Castle Kingdom and Book review. Never reads a household save.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {createWorldModel} from './world-model.mjs';
import {demoChapter} from './demo-chapter.mjs';
import {artFor} from '../../hub/public/book-scene.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),publicDir=resolve(root,'hub/public'),demoDir=resolve(root,'docs/showcase');
const library=JSON.parse(await readFile(resolve(publicDir,'book-art/library.json'),'utf8'));
const {definition,freshWorld,worldAction,ROOMS,FRIENDS,GATES,LOCKS}=createWorldModel();
// Extra rooms use generic public paintings; no private artwork is loaded.
const backgrounds={bakery:'treehouse-town',workshop:'castle-forest','river-bridge':'castle-forest','castle-moon-hill':'castle-forest','castle-night':'castle-forest'};
for(const [id,r] of Object.entries(ROOMS))r.bg=backgrounds[id]||id;
const art=artFor(Object.values(ROOMS).map(r=>({scene:{bg:r.bg,actors:['hero','bo','grown-up','pip'].map(id=>({id,pose:'idle'})),props:[{id:'treasure-chest',n:1}]}})),library);
// Reuse the public chess set and its existing third-party notices for capture comparisons.
for(const color of ['white','black'])for(const [piece,letter]of Object.entries({rook:'R',knight:'N',pawn:'P',bishop:'B'}))art.props[`chess-${color}-${piece}`]={url:`/chess/pieces/${color[0]}${letter}.svg`,h:.12,ar:1};
// Meaningful three-quarter poses for the walk and conversation.
for(const [id,pose] of [['hero','walk'],['bo','carry'],['grown-up','point'],['pip','reach']])if(art.actors[id]?.poses[pose])art.actors[id].poses.idle=art.actors[id].poses[pose];
const lines={start:{text:'The map has three missing pieces. Help your friends, then open the castle treasure.'},selected:{text:'Choose a place where your tool will help.'},tomorrow:{text:'You opened the castle! A new adventure is waiting.'}};
lines['next-acorns']={text:'Let’s find three acorns for the fox. Walk through the forest together.'};
for(const key of ['first','next-lantern','next-ball','next-net','next-chess','next-reading','next-score','next-bridge','next-map','next-night','next-treasure','next-done','piece','ready','found','selected'])if(!lines[key])lines[key]={text:'Follow the goal ribbon. Talk to your friends and use the tools you collect.'};
for(const [id,pair] of Object.entries(FRIENDS))pair.forEach((text,i)=>lines['friend-'+id+'-'+i]={text});
for(const [id,g] of Object.entries(GATES)){lines[id]={text:g.prompt};lines['hint-'+id]={text:g.hint};}
for(const [id,l] of Object.entries(LOCKS))lines['lock-'+id]={text:l.hint};
const states=new Map();
function getState(session){if(!states.has(session))states.set(session,{...freshWorld(),solved:['chess'],items:['castle-key','spyglass','map-chess'],visited:['castle-gate','chess-courtyard'],tutorial:{walk:true,talk:true}});return states.get(session);}
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.m4a':'audio/mp4'};
const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
const bookHTML=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>The Three Golden Keys</title><link rel="stylesheet" href="/book.css"><main></main><script type="module" src="/book-demo.mjs"></script>`;
const bookJS=`import {mountBook} from '/book.mjs';const book=await(await fetch('/api/demo-book'+location.search)).json();mountBook(document.querySelector('main'),{player:'hero',book,preview:true,capture:new URL(location.href).searchParams.get('capture')==='1'});`;
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost'),session=u.searchParams.get('session')||'review';
 if(u.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<!doctype html><meta charset="utf-8"><title>A little adventure</title><style>body{background:#f5efdf;color:#234032;font:22px Georgia;max-width:760px;margin:12vh auto;padding:24px}h1{font-weight:400;font-size:48px}a{display:inline-block;background:#234032;color:#fff7df;border-radius:16px;padding:20px;margin:12px 16px 12px 0;text-decoration:none}</style><h1>A world worth exploring.</h1><p>Painted places. Friendly faces. Little discoveries.</p><a href="/world?player=hero">The Castle Kingdom →</a><a href="/book-demo?capture=1">The Three Golden Keys →</a>');}
 if(u.pathname==='/api/demo-book')return json(res,{chapter:demoChapter(library,{extras:u.searchParams.has('extras')}),date:'2026-10-03',collection:{keys:['A','B','C']},progress:{page:0},preview:true});
 if(u.pathname==='/api/world'){
  if(req.method==='POST'){let raw='';for await(const part of req){raw+=part;if(raw.length>4096)return json(res,{error:'Too much data'},413);}const b=JSON.parse(raw),state=getState(session);if(b.revision!==state.revision)return json(res,{error:'Refresh this demo'},409);const result=worldAction(state,b);states.set(session,result.state);return json(res,result);}
  // A separate fictional end-state demonstrates the working castle-door animation.
  if(u.searchParams.get('reveal')==='1')states.set(session,{...freshWorld(),questStarted:true,doorOpen:true,solved:['chess','reading','score'],items:['castle-key','spyglass','map-chess','map-reading','map-score'],tutorial:{walk:true,talk:true}});
  return json(res,{state:getState(session),art,lines,definition,name:'Explorer',preview:true});
 }
 if(u.pathname==='/book-demo'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(bookHTML);}
 if(u.pathname==='/book-demo.mjs'){res.writeHead(200,{'Content-Type':'text/javascript'});return res.end(bookJS);}
 const name=u.pathname==='/world'?'world.html':decodeURIComponent(u.pathname.slice(1));
 const base=/^world(?:-|\.)/.test(name)?demoDir:publicDir,target=resolve(base,name);
 if(!target.startsWith(base+'/')||!types[extname(target)])return json(res,{error:'Not found'},404);
 const bytes=await readFile(target);res.writeHead(200,{'Content-Type':types[extname(target)],'Cache-Control':'no-store'});res.end(bytes);
}catch(e){json(res,{error:e.message},e.status||500);}});
server.listen(Number(process.env.PORT||5710),'127.0.0.1',()=>console.log('Public-safe showcase demo ready on loopback.'));
