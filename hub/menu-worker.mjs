// Log parsing belongs off the HTTP thread: drawings can make logs very large.
import {parentPort,workerData} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {menuOrderService} from './menu-order.mjs';
import {smartHome} from './home-order.mjs';
const service=menuOrderService(workerData);
// Each child's private skills profile (age, child-context priorities, outside-report focus) is re-read on every
// scan, so a new report counts without a restart. Missing or malformed = neutral.
async function profileFor(player){
 if(!workerData.skillsDir||!/^[a-z0-9_-]{1,40}$/.test(player))return null;
 try{return JSON.parse(await readFile(join(workerData.skillsDir,player+'.json'),'utf8'));}catch{return null;}
}
parentPort.on('message',async()=>{
 try{
  const rankings={};
  for(const player of workerData.players){
   rankings[player]=await service.ranking(player);
   // The smart home list is optional: a failure keeps the plain frequency order and the default home.
   try{const settings=workerData.home?.[player]||{};rankings[player].home=smartHome({events:service.events(),evidence:service.evidence(),shown:service.shown(),profile:await profileFor(player),player,now:Date.now(),timeZone:workerData.timeZone,shortcuts:settings.shortcuts,nudges:settings.nudges,newGames:settings.newGames});}
   catch(e){rankings[player].homeError=String(e?.message||e).slice(0,200);}
  }
  parentPort.postMessage({rankings});
 }
 catch(e){parentPort.postMessage({error:e.code||e.message||'Menu scan failed'});}
});
