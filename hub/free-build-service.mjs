import {readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {restore,snapshot,TYPES} from './public/free-build/physics.mjs';
const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
const emptyDay=()=>({opens:0,closes:0,activeSeconds:0,placed:Object.fromEntries(TYPES.map(t=>[t,0])),spins:0,clears:0,returnedLaterDay:0});
export function freeBuildService({data,players,log=async()=>{},timeZone='UTC',now=()=>Date.now()}){
 const queues=new Map(),date=at=>new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(at),file=p=>join(data,`free-build-${p}.json`);
 const load=async p=>{try{return JSON.parse(await readFile(file(p),'utf8'));}catch(e){if(e.code==='ENOENT')return {revision:0,pieces:[],days:{},sessions:{},lastDay:null};throw e;}};
 return {close:()=>Promise.allSettled([...queues.values()]),async handle(req,res,u){
  const player=u.searchParams.get('player');if(!players.includes(player))return send(res,400,{error:'Choose a player.'});
  if(req.method==='GET'){await queues.get(player)?.catch(()=>{});try{const p=await load(player);return send(res,200,{revision:p.revision,pieces:p.pieces,days:p.days,cleared:p.cleared??Object.values(p.days).some(d=>d.clears>0)});}catch{return send(res,503,{error:'Could not open the room.'});}}
  if(req.method!=='POST')return send(res,405,{error:'Unsupported action.'});
  if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required.'});
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>18000)return send(res,413,{error:'Too much data.'});}
  let input;try{input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))throw Error();}catch{return send(res,400,{error:'Invalid JSON.'});}
  const work=(queues.get(player)||Promise.resolve()).catch(()=>{}).then(async()=>{try{
   const p=await load(player),at=now(),day=date(at),{action,session,seq}=input;
   const refuse=(msg,status=400)=>{throw Object.assign(Error(msg),{status});};
   if(typeof session!=='string'||!/^[a-zA-Z0-9-]{8,60}$/.test(session)||!Number.isSafeInteger(seq)||seq<1||!['open','update','place','remove','spin','clear','close'].includes(action))refuse('Invalid action.');
   let s=Object.hasOwn(p.sessions,session)?p.sessions[session]:null;
   if(s&&seq<=s.seq)return send(res,200,{revision:p.revision,pieces:p.pieces}); // Safe retry, including a lost open response.
   if(action!=='open'&&(!s||s.closed))refuse('Reopen the room.',409);
   if(input.revision!==p.revision)refuse('This room changed in another tab. Reopen it to continue.',409);
   const summary=p.days[day]||=emptyDay();let activeDelta=0,returned=false;
   if(input.toyGearContacts!==undefined&&(!Number.isSafeInteger(input.toyGearContacts)||input.toyGearContacts<0||input.toyGearContacts>10000000))refuse('Invalid contacts.');
   if(input.gesture!==undefined&&!['tap','crank','move'].includes(input.gesture))refuse('Invalid gesture.');
   if(action==='open'){
    if(s)refuse('Session already open.',409);
    returned=!!p.lastDay&&day>p.lastDay;summary.opens++;summary.returnedLaterDay+=Number(returned);p.lastDay=day;
    s=p.sessions[session]={seq:0,last:at,seconds:0,closed:false,toyGearContacts:0};
    if(!p.pieces.length&&!p.cleared&&!Object.values(p.days).some(d=>d.clears>0)&&input.pieces){try{p.pieces=snapshot(restore(input.pieces));}catch{refuse('Invalid room.');}}
    const keys=Object.keys(p.sessions);for(const key of keys.slice(0,Math.max(0,keys.length-32)))delete p.sessions[key];
   }else{
    let pieces;try{pieces=snapshot(restore(input.pieces));}catch{refuse('Invalid room.');}
    if(!Number.isFinite(input.activeSeconds)||input.activeSeconds<0)refuse('Invalid time.');
    // Foreground interaction only, at most 15 seconds between heartbeats; never count a suspended tab as play.
    activeDelta=Math.max(0,Math.min(input.activeSeconds-s.seconds,(at-s.last)/1000,15));
    s.seconds=Math.max(s.seconds,input.activeSeconds);s.last=at;summary.activeSeconds+=activeDelta;
    if(action==='place'){if(!TYPES.includes(input.pieceType))refuse('Invalid piece type.');summary.placed[input.pieceType]++;}
    if(action==='spin')summary.spins++;
    if(action==='clear'){summary.clears++;p.cleared=true;}
    if(action==='close'){summary.closes++;s.closed=true;}
    p.pieces=pieces;
   }
   s.toyGearContacts=Math.max(s.toyGearContacts||0,input.toyGearContacts||0);s.seq=seq;p.revision++;
   await writeFile(file(player)+'.tmp',JSON.stringify(p),{mode:0o600});await rename(file(player)+'.tmp',file(player));
   // Counts only: no images, layouts, coordinates, names or free text in play logs.
   await log({type:'free-build',player,action,seq,day,activeSeconds:activeDelta,pieceType:action==='place'?input.pieceType:undefined,returnedLaterDay:returned,pieceCount:p.pieces.length,...(['spin','update'].includes(action)&&input.gesture?{gesture:input.gesture}:{}),toyGearContacts:s.toyGearContacts});
   send(res,200,{revision:p.revision,pieces:p.pieces});
  }catch(e){send(res,e.status||503,{error:e.status?e.message:'Could not save the room. Try again.'});}});
  queues.set(player,work);await work;
 }};
}
