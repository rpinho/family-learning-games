import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {piece,add,step,spin,meshed,snapshot,restore,contact,PIECE_LIMIT,FLOOR} from '../public/free-build/physics.mjs';
import {activeTime} from '../public/free-build/app.mjs';
import {freeBuildService} from '../free-build-service.mjs';
import {destination,CATALOG} from '../public/catalog.mjs';
import {activityFor} from '../menu-order.mjs';
const run=(ps,n)=>{for(let i=0;i<n;i++)step(ps);};
test('blocks fall and a centred three-block tower remains stacked',()=>{const ps=[piece('block',400,710,'a'),piece('block',400,620,'b'),piece('block',400,540,'c')];run(ps,1800);assert.ok(Math.abs(ps[0].y-(FLOOR-24))<1);assert.ok(ps[0].y-ps[1].y>46);assert.ok(ps[1].y-ps[2].y>46);const high=piece('ball',180,60,'high');high.vy=-900;let min=high.y;for(let i=0;i<60;i++){step([high]);min=Math.min(min,high.y);}assert.ok(min>=44,'the ceiling keeps a thrown ball in the room');});
test('an overhanging block tips; bouncy blocks rebound higher than wood',()=>{const ps=[piece('block',400,722,'a'),piece('block',482,650,'b')];run(ps,500);assert.ok(Math.abs(ps[1].a)>.15);const rebounds=type=>{const p=piece(type,400,180,'a');let hit=false,min=FLOOR;for(let i=0;i<600;i++){step([p]);if(p.vy< -30)hit=true;if(hit)min=Math.min(min,p.y);}return min;};assert.ok(rebounds('bounce')<rebounds('block')-100);});
test('touching gears reverse through a chain; disconnected gears do not spin',()=>{const ps=[piece('gear',200,200,'a'),piece('gear',304,200,'b'),piece('gear',408,200,'c'),piece('gear',650,200,'d')];assert.ok(meshed(ps[0],ps[1]));assert.deepEqual(spin(ps,'a',6),['a','b','c']);assert.equal(ps[1].av,-6);assert.equal(ps[2].av,6);assert.equal(ps[3].av,0);run(ps,120);assert.ok(ps[0].a>0);assert.ok(ps[1].a<0);ps[1].x=320;spin(ps,'a',8);assert.notEqual(ps[1].av,-8);});
test('piece and ball bounds, malformed saves and resume round-trip',()=>{const ps=[];for(let i=0;i<60;i++)add(ps,'block',400,100,'p'+i);assert.equal(ps.length,PIECE_LIMIT);assert.equal(add(ps,'gear',100,100,'extra'),null);const balls=[];for(let i=0;i<3;i++)add(balls,'ball',100,100,'b'+i);assert.equal(balls.length,2);balls[0].a=1.2;assert.deepEqual(snapshot(restore(snapshot(balls))),snapshot(balls));assert.throws(()=>restore([{id:'bad',type:'block',x:Number('invalid'),y:2,a:0,av:0}]));assert.throws(()=>restore(Array(41).fill(snapshot(balls)[0])));assert.throws(()=>restore([...snapshot(balls),snapshot(balls)[0]]));});
test('bounded physics remains finite under a crowded mixed-room stress run',()=>{const ps=[];for(let i=0;i<PIECE_LIMIT;i++)add(ps,i%3===0?'bounce':'block',100+(i%6)*110,60+Math.floor(i/6)*65,'p'+i);run(ps,600);assert.ok(ps.every(p=>Number.isFinite(p.x+p.y+p.a)));});
async function fixture(){const dir=await mkdtemp(join(tmpdir(),'free-build-test-'));await mkdir(dir,{recursive:true});let at=Date.parse('2026-01-02T12:00:00Z');const logs=[];const service=freeBuildService({data:dir,players:['beginner','explorer'],timeZone:'UTC',now:()=>at,log:async r=>logs.push(r)});async function req(player,body){const request=Readable.from(body?[JSON.stringify(body)]:[]);request.method=body?'POST':'GET';request.headers={'content-type':'application/json'};let status,value;await service.handle(request,{writeHead:s=>status=s,end:s=>value=JSON.parse(s)},new URL('http://localhost/api/free-build?player='+player));return {status,...value};}return {dir,logs,req,tick:ms=>at+=ms};}
test('per-player save/resume, revision conflicts, idempotent retries and bounded payloads',async()=>{const f=await fixture(),session='fictional-session';assert.equal((await f.req('beginner',{action:'open',seq:1,revision:0})).status,400);const open=await f.req('beginner',{action:'open',session,seq:1,revision:0});assert.equal(open.status,200);const pieces=snapshot([piece('block',300,700,'toy')]);const msg={action:'place',session,seq:2,revision:1,pieces,pieceType:'block',activeSeconds:0};const saved=await f.req('beginner',msg);assert.equal(saved.revision,2);assert.equal((await f.req('beginner',msg)).revision,2);assert.equal(f.logs.length,2);assert.deepEqual((await f.req('beginner')).pieces,pieces);assert.deepEqual((await f.req('explorer')).pieces,[]);assert.equal((await f.req('beginner',{...msg,seq:3,revision:0})).status,409);assert.equal((await f.req('beginner',{...msg,seq:3,revision:2,pieces:Array(41).fill(pieces[0])})).status,400);assert.equal((await f.req('intruder')).status,400);});
test('daily opens, closes, later-day returns, active seconds and action counts contain no layouts',async()=>{const f=await fixture();let revision=0,seq=0;const session='fictional-logging',pieces=snapshot([piece('gear',250,250,'toy')]);const send=async(action,extra={})=>{const r=await f.req('beginner',{action,session,seq:++seq,revision,pieces,activeSeconds:10,...extra});assert.equal(r.status,200);revision=r.revision;};await send('open');f.tick(10000);await send('place',{pieceType:'gear'});await send('spin');await send('clear',{pieces:[]});await send('close',{pieces:[]});let p=await f.req('beginner');const day=p.days['2026-01-02'];assert.equal(day.opens,1);assert.equal(day.closes,1);assert.equal(day.activeSeconds,10);assert.equal(day.placed.gear,1);assert.equal(day.spins,1);assert.equal(day.clears,1);f.tick(86400000);assert.equal((await f.req('beginner',{action:'open',session:'fictional-nextday',seq:1,revision})).status,200);p=await f.req('beginner');assert.equal(p.days['2026-01-03'].returnedLaterDay,1);assert.ok(f.logs.at(-1).returnedLaterDay);for(const row of f.logs){assert.equal(row.type,'free-build');assert.ok(!('pieces'in row));assert.ok(!('x'in row));}assert.equal(activityFor('hub',f.logs[1]),'free-build');});
test('suspended time is capped and duplicate close does not double-count',async()=>{const f=await fixture();await f.req('beginner',{action:'open',session:'fictional-idle',seq:1,revision:0});f.tick(600000);const msg={action:'close',session:'fictional-idle',seq:2,revision:1,pieces:[],activeSeconds:600};await f.req('beginner',msg);await f.req('beginner',msg);const p=await f.req('beginner');assert.equal(p.days['2026-01-02'].activeSeconds,15);assert.equal(p.days['2026-01-02'].closes,1);});
test('active time follows real foreground seconds even at low frame rates, then stops after idle',()=>{assert.equal(activeTime(1000,6000,500),5);assert.equal(activeTime(19000,24000,1000),2);assert.equal(activeTime(24000,29000,1000),0);assert.equal(activeTime(1000,6000,500,false),0);assert.equal(activeTime(1000,6000,4000),2);});

test('spinning gears deflect balls with their teeth in both directions and either array order',()=>{
 for(const speed of [-8,8])for(const reverse of [false,true]){const gear=piece('gear',400,400,'gear'),ball=piece('ball',400,280,'ball'),ps=reverse?[ball,gear]:[gear,ball];spin(ps,'gear',speed);run(ps,60);assert.ok(Math.sign(ball.vx)===Math.sign(speed)&&Math.abs(ball.vx)>70);assert.ok(Math.abs(ball.x-400)>15);assert.equal(gear.x,400);assert.equal(gear.y,400);}
});
test('blocks rest on solid gears in either array order, then a resting contact is carried and tips',()=>{
 for(const reverse of [false,true]){const gear=piece('gear',400,500,'gear'),block=piece('block',400,390,'block'),ps=reverse?[block,gear]:[gear,block];run(ps,900);assert.ok(Math.abs(block.y-424)<1);assert.ok(Math.abs(block.vy)<1);spin(ps,'gear',8);run(ps,80);assert.ok(block.x>415,'resting teeth push the block');assert.ok(Math.abs(block.a)>.05,'block tips as it leaves');}
});
test('off-centre ball and block impacts turn a resting gear and its meshed train',()=>{
 for(const type of ['ball','block']){const a=piece('gear',400,400,'a'),b=piece('gear',504,400,'b'),toy=piece(type,365,260,'toy');toy.vy=300;const ps=[a,toy,b];run(ps,40);assert.ok(Math.abs(a.av)>.05,type+' transfers torque');assert.ok(Math.abs(a.av+b.av)<1e-8);}
});
test('passive trains lose energy; a hand spin lasts four to six seconds',()=>{
 const ps=[piece('gear',300,300,'a'),piece('gear',404,300,'b')];spin(ps,'a',7);run(ps,480);assert.ok(ps[0].av>.025);run(ps,240);assert.equal(ps[0].av,0);
});
test('forty awake toys with twenty gears stay bounded, including floor and two-gear wedges',()=>{
 const ps=[];for(let i=0;i<20;i++)add(ps,'gear',90+i%6*114,110+Math.floor(i/6)*170,'g'+i);for(let i=0;i<20;i++)add(ps,i<2?'ball':i%2?'block':'bounce',90+i%6*114,80+Math.floor(i/6)*145,'t'+i);
 for(const p of ps){p.vx=400;p.vy=-300;p.av=12;}
 let peak=0;for(let i=0;i<7200;i++){step(ps);const energy=ps.reduce((s,p)=>s+(p.m*(p.vx*p.vx+p.vy*p.vy)/2)+(p.type==='gear'?5408:p.m*(p.w*p.w+p.h*p.h)/12)*p.av*p.av/2,0);peak=Math.max(peak,energy);assert.ok(Number.isFinite(energy)&&energy<5e7);assert.ok(ps.every(p=>Math.abs(p.vx)<=900&&Math.abs(p.vy)<=1000&&Math.abs(p.av)<=16));}
 assert.ok(ps.reduce((s,p)=>s+Math.abs(p.vx)+Math.abs(p.vy)+Math.abs(p.av),0)<25,'crowded room settles without perpetual jitter');
 for(const order of [false,true]){const g=piece('gear',400,650,'g'),b=piece('ball',400,700,'b'),g2=piece('gear',504,650,'g2'),toys=order?[b,g2,g]:[g,b,g2];spin(toys,'g',16);run(toys,2400);assert.ok(toys.every(p=>Number.isFinite(p.x+p.y+p.av)));assert.ok(Math.abs(b.vx)+Math.abs(b.vy)<2);}
});
test('overlapping gear drops snap or choose the nearest clear peg, and tap additions find clear space',async()=>{
 const {snapGear,clearSpot}=await import('../public/free-build/physics.mjs');const ps=[];for(let i=0;i<20;i++){const p=add(ps,'gear',400,300,'g'+i);p.x=400;p.y=300;snapGear(ps,p);for(const q of ps)if(q!==p)assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>=103.98);}
 const p=piece('block',400,300,'block');ps.push(p);clearSpot(ps,p);assert.ok(ps.every(q=>q===p||!contact(p,q)));const gear=add(ps,'gear',400,220,'tap-gear');clearSpot(ps,gear);assert.ok(ps.every(q=>q===gear||!contact(gear,q)),'tapped gear stays clear of all toy bodies');
});
test('legacy overlaps load safely and a toy inside a gear settles gently',()=>{
 const rows=snapshot([piece('gear',400,400,'a'),piece('gear',400,400,'b'),piece('ball',400,400,'ball')]),ps=restore(rows);assert.ok(Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)>=103.98);run(ps,1800);assert.ok(ps.every(p=>Number.isFinite(p.x+p.y+p.a)));assert.ok(ps[2].y<=FLOOR-44);
});
test('held toys can cross the floor, release safely, and bin tests the body including a rotated block',async()=>{
 const {releasePiece,bodyInRect}=await import('../public/free-build/physics.mjs');const p=piece('gear',400,400,'gear');p.held=true;p.y=790;run([p],60);assert.equal(p.y,790);releasePiece(p);assert.equal(p.y,FLOOR-52);assert.equal(p._returnY,790);run([p],60);assert.ok(p._returnY===undefined||Math.abs(p._returnY-p.y)<1);
 const bin={left:650,top:650,right:800,bottom:800},ball=piece('ball',615,700,'ball');assert.ok(bodyInRect(ball,bin));ball.x=600;assert.ok(!bodyInRect(ball,bin));const block=piece('block',625,630,'block');block.a=Math.PI/4;assert.ok(bodyInRect(block,bin));
});
test('starter persists on open; explicit clear survives a later open; gesture/contact rows stay small',async()=>{
 const {starter}=await import('../public/free-build/physics.mjs');const f=await fixture(),pieces=snapshot(starter());await f.req('beginner',{action:'open',session:'fictional-start',seq:1,revision:0,pieces});assert.equal((await f.req('beginner')).pieces.length,4);
 await f.req('beginner',{action:'spin',session:'fictional-start',seq:2,revision:1,pieces,activeSeconds:0,gesture:'tap',toyGearContacts:3});assert.equal(f.logs.at(-1).gesture,'tap');assert.equal(f.logs.at(-1).toyGearContacts,3);
 assert.equal((await f.req('beginner',{action:'update',session:'fictional-start',seq:3,revision:2,pieces,activeSeconds:0,gesture:'arbitrary text'})).status,400);
 await f.req('beginner',{action:'clear',session:'fictional-start',seq:3,revision:2,pieces:[],activeSeconds:0});assert.equal((await f.req('beginner')).cleared,true);
 await f.req('beginner',{action:'open',session:'fictional-return',seq:1,revision:3,pieces});assert.deepEqual((await f.req('beginner')).pieces,[]);assert.ok(f.logs.every(r=>JSON.stringify(r).length<400&&!('pieces'in r)));
});


test('contact impulses and train synchronization cannot amplify kinetic energy',()=>{
 const ps=[piece('gear',300,400,'a'),piece('gear',404,400,'b'),piece('gear',508,400,'c'),piece('ball',300,303.2,'ball')];ps[0].av=10;ps[1].av=2;ps[2].av=-3;ps[3].vx=-180;ps[3].vy=50;
 const energy=()=>ps.reduce((sum,p)=>sum+p.m*(p.vx*p.vx+p.vy*p.vy)/2+(p.type==='gear'?5408:p.m*(p.w*p.w+p.h*p.h)/12)*p.av*p.av/2,0);
 for(let i=0;i<100;i++){const before=energy();step(ps,0);assert.ok(energy()<=before+1e-6,'passive contact only redistributes or dissipates energy');}
});


test('balls rebound from a resting gear, including fast impacts, in either array order',()=>{
 for(const reverse of [false,true])for(const speed of [200,900]){const gear=piece('gear',400,500,'gear'),ball=piece('ball',400,390,'ball');ball.vy=speed;const ps=reverse?[ball,gear]:[gear,ball];let rebound=false;for(let i=0;i<45;i++){step(ps);rebound||=ball.vy< -50;}assert.ok(rebound,'solid gear rebounds a falling ball');}
});

test('starter ball rests at the teeth and a first spin still carries it after waiting',async()=>{
 const {starter}=await import('../public/free-build/physics.mjs');const ps=starter();assert.equal(ps.filter(p=>p.type==='gear').length,2);assert.ok(meshed(ps[0],ps[1]));assert.ok(ps[0].av*ps[1].av<0);run(ps,1200);const before=ps[2].x;spin(ps,ps[1].id,7);run(ps,180);assert.ok(ps[2].x>before+40);assert.ok(ps[2].vx>50);
});


test('the tapped side immediately chooses direction, and repeated taps reach the speed cap',async()=>{
 const {tapSpin}=await import('../public/free-build/physics.mjs');const ps=[piece('gear',300,300,'a'),piece('gear',404,300,'b')];for(let i=0;i<6;i++)tapSpin(ps,'a',1);assert.equal(ps[0].av,16);tapSpin(ps,'a',-1);assert.equal(ps[0].av,-7);assert.equal(ps[1].av,7);tapSpin(ps,'a',-1);assert.equal(ps[0].av,-14);tapSpin(ps,'a',-1);assert.equal(ps[0].av,-16);tapSpin(ps,'a',1);assert.equal(ps[0].av,7);
});


test('a gear remains solid and carries toys while its knob is being cranked',()=>{
 const gear=piece('gear',400,400,'gear'),ball=piece('ball',400,303.2,'ball'),ps=[gear,ball];gear.cranking=true;spin(ps,'gear',8);run(ps,60);assert.equal(gear.a,0,'the hand owns the knob angle');assert.ok(ball.x>415&&ball.vx>60,'the cranked teeth remain in contact');gear.cranking=false;step(ps);assert.ok(gear.a>0,'release resumes free rotation');
});


test('a motionless toy wedged under a gear gently slides to clear floor instead of sinking',()=>{
 for(const type of ['ball','block']){const gear=piece('gear',400,650,'gear'),toy=piece(type,400,700,'toy'),ps=[gear,toy];run(ps,600);assert.ok(toy.y+toy.h/2<=FLOOR+.2);assert.ok(!contact(gear,toy)||contact(gear,toy).depth<.3);assert.ok(Math.abs(toy.vx)+Math.abs(toy.vy)<2);assert.equal(gear.x,400);assert.equal(gear.y,650);}
});
