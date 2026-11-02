import {readFile, writeFile, rename, mkdir} from 'node:fs/promises';
import {join} from 'node:path';

// Same-origin checks live at the hub boundary. Each game keeps its own save and
// serializes writes per player, including reads made while a write is pending.
export function gameStore({data, name, players, fresh, validate, update}) {
 const queues=new Map();
 const file=player=>join(data,`${name}-${player}.json`);
 const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 async function load(player){
  let p;try{p=JSON.parse(await readFile(file(player),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;p=fresh();}
  validate(p);return p;
 }
 return {close:()=>Promise.allSettled([...queues.values()]),async handle(req,res,u){
  const player=u.searchParams.get('player');
  if(!players.includes(player))return send(res,400,{error:'Choose a player.'});
  if(u.pathname!==`/api/${name}`)return send(res,404,{error:'Unknown activity route.'});
  if(req.method==='GET'){
   try{await queues.get(player)?.catch(()=>{});return send(res,200,{profile:await load(player),serverNow:Date.now()});}
   catch{return send(res,503,{error:'Could not open your saved place.'});}
  }
  if(req.method!=='POST')return send(res,405,{error:'Unsupported action.'});
  if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required.'});
  let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>2048)return send(res,413,{error:'Too much data.'});}
  let input;try{input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))throw Error();}
  catch{return send(res,400,{error:'Invalid JSON.'});}
  const work=(queues.get(player)||Promise.resolve()).catch(()=>{}).then(async()=>{
   try{
    const p=await load(player);
    if(!(name==='word-search'&&input.type==='open')&&input.revision!==p.revision)throw Object.assign(Error('Your saved place changed. Reopen it to continue.'),{status:409});
    const result=await update(p,input,player);
    if(result.changed!==false){
     await mkdir(data,{recursive:true,mode:0o700});
     await writeFile(file(player)+'.tmp',JSON.stringify(p),{mode:0o600});
     await rename(file(player)+'.tmp',file(player));
    }
    send(res,200,{profile:p,result,serverNow:Date.now()});
   }catch(e){send(res,e.status||503,{error:e.status?e.message:'Could not save. Reopen your saved place before continuing.'});}
  });queues.set(player,work);await work;
 }};
}
