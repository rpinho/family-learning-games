// Log parsing belongs off the HTTP thread: drawings can make logs very large.
import {parentPort,workerData} from 'node:worker_threads';
import {menuOrderService} from './menu-order.mjs';
const service=menuOrderService(workerData);
parentPort.on('message',async()=>{
 try{const rankings={};for(const player of workerData.players)rankings[player]=await service.ranking(player);parentPort.postMessage({rankings});}
 catch(e){parentPort.postMessage({error:e.code||e.message||'Menu scan failed'});}
});
