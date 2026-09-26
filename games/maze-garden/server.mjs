import http from 'node:http';
import {readFileSync,writeFileSync,renameSync,mkdirSync,appendFileSync,existsSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir,networkInterfaces} from 'node:os';
import {randomBytes} from 'node:crypto';
import {PLAYERS,VERSION,newProfile,action} from './engine.mjs';
import {literacyFrom,DEFAULT_TRACK} from './public/word-break.mjs';
const root=dirname(fileURLToPath(import.meta.url)),data=process.env.MAZE_DATA_DIR||resolve(homedir(),'.local/share/family-learning-games/maze-garden'),port=Number(process.env.PORT||4322);
mkdirSync(resolve(data,'logs'),{recursive:true,mode:0o700});
const letterData=process.env.LETTER_QUEST_DATA||resolve(homedir(),'.local/share/family-learning-games/letter-quest');
// Read-only look at Letter Quest progress so word breaks match each child.
function literacy(id){let save=null;try{save=JSON.parse(readFileSync(resolve(letterData,id+'.json'),'utf8'));}catch{}return literacyFrom(save,DEFAULT_TRACK[id]||'mixed');}
const hosts=new Set(['localhost','127.0.0.1','localhost',...Object.values(networkInterfaces()).flat().filter(Boolean).map(n=>n.address)]);
const log=e=>appendFileSync(resolve(data,'logs',new Date().toISOString().slice(0,10)+'.jsonl'),JSON.stringify({at:new Date().toISOString(),version:VERSION,...e})+'\n',{mode:0o600});
const file=p=>resolve(data,p+'.json');
function save(p){const tmp=file(p.player)+'.tmp';writeFileSync(tmp,JSON.stringify(p),{mode:0o600});renameSync(tmp,file(p.player));}
function load(player){return existsSync(file(player))?JSON.parse(readFileSync(file(player),'utf8')):newProfile(player);}
function send(res,status,value){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; frame-ancestors 'none'");
 try{const url=new URL(req.url,`http://${req.headers.host}`);if(!hosts.has(url.hostname))return send(res,403,{error:'Local access only'});
 if(req.headers.origin&&req.headers.origin!==url.origin)return send(res,403,{error:'Origin mismatch'});
 if(url.pathname==='/api/health')return send(res,200,{version:VERSION,name:'Maze Garden'});
 if(url.pathname.startsWith('/api/')){const player=url.searchParams.get('player');if(!Object.hasOwn(PLAYERS,player))return send(res,400,{error:'Choose a player'});
 if(req.method==='GET'&&url.pathname==='/api/state')return send(res,200,{...load(player),serverNow:Date.now()});
 if(req.method==='GET'&&url.pathname==='/api/word-break')return send(res,200,literacy(player));
 if(req.method!=='POST'||req.headers['content-type']!=='application/json')return send(res,405,{error:'Use JSON POST'});
 let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>30000)return send(res,413,{error:'Too much data'});body+=chunk;}const input=JSON.parse(body);
 if(url.pathname==='/api/event'){log({player,event:'client',type:String(input.type||'').slice(0,40),detail:String(input.detail||'').slice(0,500)});return send(res,200,{ok:true});}
 if(url.pathname!=='/api/action')return send(res,404,{error:'Not found'});let p=load(player);if(input.revision!==p.revision)return send(res,409,{error:'Another window updated this player. Refresh to continue.',state:p});
 if(input.type==='recalibrate'&&p.calibration!==2){const backups=resolve(data,'backups');mkdirSync(backups,{recursive:true,mode:0o700});const snapshot=resolve(backups,`${player}-before-book-mazes-${p.revision}.json`);if(!existsSync(snapshot))writeFileSync(snapshot,JSON.stringify(p),{mode:0o600,flag:'wx'});}
 const before=p.completed;action(p,{...input,seed:randomBytes(4).readUInt32LE()});save(p);log({player,event:input.type,maze:p.active?.id,revision:p.revision,grid:p.active?.n,metrics:p.active?.metrics,cells:input.cells,answer:input.answer,mode:input.mode,delta:input.delta,hint:input.type==='hint'?p.active?.hintCue:undefined,completed:p.completed>before?p.history.at(-1):undefined});return send(res,200,{...p,serverNow:Date.now()});}
 if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Not allowed'});
 if(/^\/voice\/(manifest\.json|[a-f0-9]{16}\.wav)$/.test(url.pathname)){try{const content=readFileSync(resolve(data,'voice',url.pathname.split('/').at(-1)));res.writeHead(200,{'Content-Type':url.pathname.endsWith('.wav')?'audio/wav':'application/json','Cache-Control':url.pathname.endsWith('.wav')?'public, max-age=31536000, immutable':'no-store'});res.end(content);}catch{send(res,404,{error:'Voice unavailable'});}return;}
 const name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);const base=resolve(root,'public');const target=name==='engine.mjs'?resolve(root,name):resolve(base,name);
 if(target!==resolve(root,'engine.mjs')&&!target.startsWith(base+'/'))return send(res,403,{error:'Forbidden'});
 if(!types[extname(target)])return send(res,404,{error:'Not found'});let content;try{content=readFileSync(target);}catch{return send(res,404,{error:'Not found'});}res.writeHead(200,{'Content-Type':types[extname(target)],'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:content);
 }catch(e){log({event:'server-error',message:e.message});send(res,400,{error:e.message});}});
server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Maze Garden: http://localhost:${server.address().port}`));
