import {icon} from './world-icons.mjs';
import './world-audio-scope.mjs';
import {createWorldModel,walkPath,bodyAt,worldSpot} from './world-model.mjs';
let ROOMS,GATES,mapPieces,ITEMS,LOCKS,friendDone,nextHint,nextGoal,goalTarget,MAP_GATES,definition;
import {selectBackground,backgroundRect} from './book-painted-layout.mjs';
import {relHeight,zonesOnScreen} from './world-layout.mjs';
import {createCoachAudio} from './world-audio.mjs';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URL(location.href).searchParams,player=params.get('player'),query=new URLSearchParams({player:player||'',preview:'1',session:params.get('session')||'review',...(params.has('reveal')?{reveal:'1'}:{})});
if(params.get('preview')!=='1'){params.set('preview','1');history.replaceState(null,'','/world?'+params);}
const pieceSVG=`<svg viewBox="0 0 60 50" aria-hidden="true"><path d="M5 7h19c-4-9 16-9 12 0h18v15c-10-3-10 14 0 11v12H34c4-9-14-9-10 0H5V31c10 4 10-15 0-11Z" fill="#d4b16d" stroke="#876432" stroke-width="2"/><path d="m12 32 10-9 12 7 13-14" fill="none" stroke="#756640" stroke-width="3"/></svg>`;
let data,state,art,lines,bg,geometry,hero,friend,position,blocks=[],path=[],exitSide=null,walking=false,frame=0,lastTime=0,mutations=Promise.resolve(),captionTimer,voiceTurn=0,muted=false,lastLine=null,challengeGate=null,misses=0,disposed=false,selectedItem=null,arrival=null,walkResolve=null,interactionTurn=0;
const audio=createCoachAudio(),rewardAudio=createCoachAudio();
function unlock(){audio.unlock();rewardAudio.unlock();}
async function api(path='',body){const r=await fetch('/api/world'+path+'?'+query,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),j=await r.json();if(!r.ok)throw Error(j.error||'The world could not connect.');return j;}
function act(b){const next=mutations.catch(()=>{}).then(async()=>{try{const j=await api('',{...b,revision:state.revision});const before=state;state=j.state;$('#save-status').textContent='';updatePack();updateGoal();rewardFlight(before);return j;}catch(e){$('#save-status').textContent=e.message+' Tap to retry.';$('#save-status').onclick=()=>{void act(b).then(()=>{if(b.action==='walk'&&b.room!==$('#scene').dataset.room)renderRoom();}).catch(()=>{});};throw e;}});mutations=next;return next;}
function updatePack(){const n=mapPieces(state),total=MAP_GATES.length;$('#backpack').innerHTML=`<span class="pack-map" aria-label="${n} of ${total} map pieces">${icon('map')}<small>${n} / ${total}</small></span>${Object.entries(ITEMS).filter(([id])=>!['acorn','ball'].includes(id)).map(([id,v])=>{const owned=state.items.includes(id);return `<button data-item="${id}" class="pack-item ${owned?'owned':'missing'} ${selectedItem===id?'selected':''}" aria-label="${owned?'Carry':'Find'} ${esc(v.name)}" title="${esc(v.name)}">${definition.early?`<span class="pack-picture">${({stone:'🪨',flower:'🌼',thought:'🐙',pizza:'🍕',ribbon:'🎗️',gift:'🎁'})[id]}</span>`:icon(v.icon)}<small>${owned?'✓':'?'}</small></button>`;}).join('')}`;
 for(const b of $('#backpack').querySelectorAll('[data-item]'))b.onclick=()=>{unlock();if(!state.items.includes(b.dataset.item))return void speak(nextHint(state));selectedItem=selectedItem===b.dataset.item?null:b.dataset.item;updatePack();if(selectedItem)void speak('selected');};
 $('#backpack').setAttribute('aria-label',`Backpack: ${state.items.map(id=>ITEMS[id]?.name||id).join(', ')}, ${n} of ${total} map pieces`);}
function updateGoal(){if(!state)return;const g=nextGoal(state),el=$('#goal');el.textContent=g.icon+' '+g.text;el.dataset.key=g.key;
 document.querySelectorAll('.next-target').forEach(e=>e.classList.remove('next-target'));let target=goalTarget(state);
 if(challengeGate&&GATES[challengeGate]?.instruction)target=GATES[challengeGate].answer;
 const selector=target==='friend'?'.actor:not(.hero):not(.surprise-friend)':target==='opening'?'.opening':target==='treasure'?'.world-door-tap':['left','right'].includes(target)?'.signpost.'+target:`[data-object="${target}"]`;
 document.querySelector(selector)?.classList.add('next-target');
 const tutorial=$('#tutorial');tutorial.hidden=state.tutorial.walk&&state.tutorial.talk;$('#world').classList.toggle('tutorial-active',!tutorial.hidden);
 tutorial.textContent=!state.tutorial.walk?'👆 Tap the ground to walk':'👆 Tap the guide to talk';
 if(!state.tutorial.walk)$('#scene').classList.add('learn-walk');else $('#scene').classList.remove('learn-walk');
 if(state.tutorial.walk&&!state.tutorial.talk&&state.room==='castle-gate'){document.querySelectorAll('.next-target').forEach(e=>e.classList.remove('next-target'));friend?.classList.add('next-target');}
}
function rewardFlight(before){if(!before)return;for(const id of state.items.filter(id=>!before.items.includes(id))){const slot=id.startsWith('map-')?$('.pack-map'):document.querySelector(`[data-item="${id}"]`);if(!slot)continue;const r=slot.getBoundingClientRect(),fly=document.createElement('div');fly.className='reward-fly';fly.innerHTML=id.startsWith('map-')?pieceSVG:icon(ITEMS[id]?.icon||'star');Object.assign(fly.style,{left:(position.x*geometry.W)+'px',top:(position.y*geometry.H-80)+'px'});document.body.append(fly);const animation=fly.animate([{transform:'translate(-50%,-50%) scale(1)'},{transform:`translate(${r.x+r.width/2-position.x*geometry.W}px,${r.y+r.height/2-position.y*geometry.H+80}px) scale(.5)`}],{duration:800,easing:'ease-in-out'});animation.finished.then(()=>{fly.remove();const current=id.startsWith('map-')?$('.pack-map'):document.querySelector(`[data-item="${id}"]`);current?.animate([{scale:1},{scale:1.3},{scale:1}],{duration:450});}).catch(()=>fly.remove());}
 if(state.items.some(id=>!before.items.includes(id))&&!muted){rewardAudio.play('/calm/harp-c5.m4a');}}

function caption(text){clearTimeout(captionTimer);$('#caption').hidden=false;$('#caption').textContent=text;captionTimer=setTimeout(()=>{$('#caption').hidden=true;},10000);}
async function speak(key){if(disposed||document.hidden||globalThis.familyAudio?.blocked)return;const l=lines[key];if(!l)return;lastLine=key;const turn=++voiceTurn;audio.stop();if($('#map').hidden&&(!challengeGate||GATES[challengeGate]?.instruction))caption(l.text.replace(/\[\[ɑ\]\]/g,'/o/'));$('#world').dataset.line=key;$('#world').dataset.clip=l.clip||'';if(muted)return;
 try{if(!l.clip)throw Error('Missing recorded line: '+key);if(turn!==voiceTurn||disposed||muted)return;const source='/book-voice/'+l.clip+'?r=L1';audio.play(source);}
 catch{if(turn===voiceTurn){$('#sound').title='Tap the caption to replay the recorded voice.';}}
}
function pose(id){const a=art.actors[id];if(id==='pip'&&(state.flags.includes('fox-chest')||state.flags.includes('ball-returned'))&&a?.poses?.happy)return a.poses.happy;return a?.poses?.idle||Object.values(a?.poses||{})[0];}
function actor(id,isHero=false){const p=pose(id);if(!p)return null;const el=document.createElement(isHero?'div':'button');el.className='actor'+(isHero?' hero':'');el.dataset.id=id;if(!isHero){el.type='button';el.setAttribute('aria-label','Talk to '+art.actors[id].name);el.onclick=()=>{unlock();feedback(el);void approach(geometry.friend,()=>talkFriend()).catch(showError);};}el.innerHTML=`<img src="${esc(p.url)}" alt="${esc(art.actors[id].name)}">${isHero?'':`<span class="talk-badge" aria-hidden="true">💬</span><span class="name">${esc(art.actors[id].name)}</span>`}`;$('#actors').append(el);return el;}
// Depth: whoever stands nearer the viewer than the map chest is drawn in front of it (never the chest over a body).
function place(el,p,size){if(!el)return;el.style.zIndex=geometry?.object&&p.y>geometry.object.y+.02?'6':'3';Object.assign(el.style,{left:(p.x-size.w/2)*geometry.W+'px',top:(p.y-size.h)*geometry.H+'px',width:size.w*geometry.W+'px',height:size.h*geometry.H+'px'});}
function heroSize(){return geometry.heroSize;}
function stopWalk(){if(walkResolve){walkResolve(false);walkResolve=null;}arrival=null;cancelAnimationFrame(frame);frame=0;path=[];walking=false;exitSide=null;hero?.classList.remove('walking');$('#destination').hidden=true;}
function trace(value){globalThis.__worldTrace?.push({...value,room:state?.room,turn:interactionTurn});}
function showError(e){trace({error:e.message});$('#save-status').textContent=e.message;}
function layout(){if(!art)return;stopWalk();const W=$('#world').clientWidth,H=$('#world').clientHeight;bg=selectBackground(art.backgrounds[ROOMS[state.room].bg||state.room],{width:W,height:H});const rect=backgroundRect(bg,{width:W,height:H});const im=$('#painting');im.src=bg.url;im.alt=ROOMS[state.room].name;Object.assign(im.style,{left:rect.x+'px',top:rect.y+'px',width:rect.w+'px',height:rect.h+'px'});
 const unit=W>=H?.40:.34 /* family drawn BIG (Book rule; 10-02 frames had the guide ~25%) */,h=unit*relHeight(player,art.actors[player]),w=h*H*pose(player).ar/W;
 geometry={W,H,heroSize:{w,h},rect,unit};
 blocks=zonesOnScreen(bg,{width:W,height:H,still:true});
 const floor=Math.max(.55,(rect.y+(bg.groundStart||.5)*rect.h)/H);geometry.floor=floor;
 const r=ROOMS[state.room],reserved=[];
 // Clamp the complete body, then find nearby clear ground if painted geometry
 // pushes the preferred spot out of the scene. Never change the family scale.
 const reveal=$('#map.gift-reveal');if(reveal&&!reveal.hidden){const r=reveal.getBoundingClientRect();blocks.push({x0:r.x/W-.006,x1:r.right/W+.006,y0:r.y/H-.006,y1:r.bottom/H+.006,ui:true,name:'gift reveal'});}
 const hud=$('.hud').getBoundingClientRect();blocks.push({x0:0,x1:1,y0:0,y1:hud.bottom/H+.01,ui:true,name:'hud'});
 for(const el of document.querySelectorAll('.signpost')){el.style.top=Math.max(.11*H,floor*H-el.offsetHeight-10)+'px';const r=el.getBoundingClientRect();blocks.push({x0:r.x/W-.006,x1:r.right/W+.006,y0:r.y/H-.006,y1:r.bottom/H+.006,ui:true,name:'exit sign'});}
 if(friend){const id=r.friend,fh=unit*relHeight(id,art.actors[id]),fw=fh*H*pose(id).ar/W,size={w:fw,h:fh};
  let fy=.706;const fx=.70;
  for(const z of blocks)if(z.x0<fx+fw/2&&z.x1>fx-fw/2)fy=Math.max(fy,z.y1+fh+.016);
  const p=worldSpot({x:fx,y:Math.min(.95,fy)},size,blocks,{floor});
  geometry.friend={...p,...size};place(friend,p,size);const box={...bodyAt(p,size),name:'friend'};blocks.push(box);reserved.push(box);
 }
 const guest=$('.surprise-friend');if(guest){const h=unit*relHeight('pip',art.actors['pip']),w=h*H*pose('pip').ar/W,size={w,h};
  const p=worldSpot({x:1-w/2-.024,y:.95},size,blocks,{floor});place(guest,p,size);const box={...bodyAt(p,size),name:'guest'};blocks.push(box);reserved.push(box);
 }
 // Reserve the hero's arrival before placing props; resumed positions and edge
 // arrivals use the same rule. Normal walking still uses the foot collision grid.
 position=worldSpot(position||state.position,heroSize(),blocks,{floor});place(hero,position,heroSize());reserved.push(bodyAt(position,heroSize()));
 const objects=[...document.querySelectorAll('[data-object]')],count=objects.length;
 for(const [i,el] of objects.entries()){
  const x=count===1?.27:.12+i*(.49/Math.max(1,count-1)),y=Math.min(.78,floor+.18),side=Math.max(44,Math.min(.105*H,.49*W/Math.max(1,count-1)*.82)),size={w:side/W,h:side/H};
  // Pad for the prop's glow/flutter as well as its visible box.
  const clearance={w:size.w+16/W,h:size.h+16/H};
  const p=worldSpot({x,y},clearance,reserved,{floor});
  el.style.translate='0 0';place(el,p,size);el.style.zIndex='4';el.dataset.x=p.x;el.dataset.y=p.y;reserved.push(bodyAt(p,clearance));
  blocks.push({x0:p.x-size.w*.42,x1:p.x+size.w*.42,y0:p.y-.04,y1:p.y+.003,name:'object'});
 }
 geometry.object=objects[0]?{x:Number(objects[0].dataset.x),y:Number(objects[0].dataset.y)}:null;place(hero,position,heroSize());

 drawDoor();
}
function object(id,label,visual,fn,extra=''){
 const b=document.createElement('button');b.className='world-object ground-chest '+extra;b.dataset.object=id;b.setAttribute('aria-label',label);b.innerHTML=visual+'<span class="tap-sparkle" aria-hidden="true">✦</span>';b.onclick=()=>{unlock();feedback(b);void approach({x:Number(b.dataset.x),y:Number(b.dataset.y),w:b.offsetWidth/geometry.W},()=>fn(b)).catch(showError);};$('#actors').append(b);return b;
}
function renderRoom(side=null){stopWalk();rewardAudio.stop();challengeGate=null;$('#challenge').hidden=true;$('#caption').hidden=true;voiceTurn++;audio.stop();$('#scene').dataset.room=state.room;$('#scene').className='scene'+(side?' arrive-'+side:'')+(state.room==='castle-moon-hill'&&state.flags.includes('night')?' path-lit':'');$('#room-name').textContent=ROOMS[state.room].name;$('#actors').replaceChildren();hero=actor(player,true);friend=actor(ROOMS[state.room].friend);$('#objects').replaceChildren();const room=ROOMS[state.room];
 if(room.gate&&(room.gate!=='pirate'||state.flags.includes('dig'))){const g=GATES[room.gate],C=art.props?.chest;object('gate-'+room.gate,'Open '+g.title,definition.early?`<span class="activity-token">${g.icon}</span>`:g.instruction?icon('map'):C?`<img src="${esc(C.url)}" alt="">`:icon('chest'),()=>openChallenge(room.gate),state.solved.includes(room.gate)?'solved':'');}
 if(state.room==='castle-forest'){
  for(let n=1;n<=3;n++){const id='acorn-'+n;object(id,'Rustling acorn bush '+n,icon('bush')+(!state.collected.includes(id)?`<span class="little-token">${icon('acorn')}</span>`:''),async b=>{if(state.collected.includes(id))return speak('found');await act({action:'collect',id});b.classList.add('solved');b.querySelector('.little-token')?.remove();await speak('acorn');});}
 }
 if(state.room==='soccer-pitch'&&!state.collected.includes('ball'))object('ball','Pull the ball from the branch',icon('branch'),async()=>{await act({action:'collect',id:'ball'});renderRoom();await speak('ball');});
 for(const [id,l] of Object.entries(LOCKS))if(l.room===state.room)object('lock-'+id,l.label,icon(l.icon),()=>useTool(id),(state.flags.includes(id)||state.flags.includes(id+'-tied')?'solved':'')+(id==='runaway'&&!state.flags.includes(id)?' fluttering-map':'')+(id==='night'&&state.flags.includes('night')?' glowing-lantern':''));
 if(state.room==='treehouse-town')object('fox-chest','Open the mysterious chest',art.props.chest?`<img src="${esc(art.props.chest.url)}" alt="">`:icon('chest'),async()=>{if(state.flags.includes('fox-chest'))return speak('secretDone');await act({action:'secret',id:'fox-chest'});renderRoom();await speak('fox');const secretTurn=voiceTurn;setTimeout(()=>{if(!disposed&&!document.hidden&&secretTurn===voiceTurn&&state.room==='treehouse-town')void speak('secret');},1800);});
 if(state.room==='treehouse-town'&&state.flags.includes('fox-chest')){const guest=actor('pip');guest.classList.add('surprise-friend');guest.onclick=()=>{unlock();const r=guest.getBoundingClientRect();void approach({x:(r.x+r.width/2)/geometry.W,w:r.width/geometry.W},()=>speak('fox')).catch(showError);};}
 if(room.gate&&GATES[room.gate].instruction){const ids=GATES[room.gate].options;for(const [i,id] of ids.entries())object(id,id.replaceAll('-',' '),room.gate==='reading'?`<span style="color:${i?'#507cb7':'#c75543'}">${icon('flag')}</span><span class="little-token">${icon('shell')}</span>`:icon('chest')+`<span class="little-token">${icon(i?'star':'shell')}</span>`,b=>followInstruction(room.gate,id,b));}
 $('#exits').innerHTML=Object.entries(room.exits).map(([side,id])=>`<button class="signpost ${side}" data-side="${side}"><span class="sign-icon" aria-hidden="true">${ROOMS[id].icon||''}</span><small>to the</small>${side==='left'?'← ':''}${esc(ROOMS[id].name)}${side==='right'?' →':''}</button>`).join('');for(const el of document.querySelectorAll('.signpost'))el.onclick=()=>{unlock();void walkToEdge(el.dataset.side).catch(showError);};
 position={...state.position};layout();updatePack();updateGoal();
}
async function useTool(id){const l=LOCKS[id];if(!selectedItem&&state.items.includes(l.item))selectedItem=l.item;if(!selectedItem)return speak('lock-'+id);if(selectedItem!==l.item||!state.items.includes(l.item))return speak('wrongTool');if(l.needs?.some(id=>!state.items.includes(id))||l.requires&&!state.solved.includes(l.requires)&&!state.items.includes(l.requires))return speak('lock-'+id);if(id==='dig'&&!state.solved.includes('bridge'))return speak('next-bridge');if(id==='dig'&&!state.items.includes('star-compass'))return speak('need-compass');await act({action:'use',target:id,item:selectedItem});selectedItem=null;renderRoom();await speak('used-'+id);}
async function followInstruction(gate,id,b){if(challengeGate!==gate){if(state.solved.includes(gate))return speak('found');return openChallenge(gate);}await answer(id,b);}

async function talkFriend(){const room=ROOMS[state.room];
 if(state.room===definition.startRoom){await act({action:'quest'});await speak(nextHint(state));return;}
 if(!state.questStarted)return speak('first');await act({action:'friend'});if(state.room==='soccer-pitch'&&!state.foxSpoken)await act({action:'fox'});
 if(room.friend==='grown-up')await speak(nextHint(state));else await speak('friend-'+state.room+'-'+Number(friendDone(state,state.room)));
}
// A tap owns its walk and action. A newer tap cancels the old action, including a tap during a save.
async function approach(target,fn){const turn=++interactionTurn;if(!$('#map').hidden)return;
 if(challengeGate&&!GATES[challengeGate]?.instruction)closeChallenge();
 const beside=target.w?target.x-target.w/2-heroSize().w/2-.022:target.x;
 trace({approach:target,owner:turn,challengeGate});const destination=clearHeroSpot({x:Math.max(heroSize().w/2+.01,Math.min(1-heroSize().w/2-.01,beside)),y:.98});const moved=await walk(destination);
 trace({arrived:moved,owner:turn,destination});if(moved&&turn===interactionTurn&&!disposed&&!document.hidden)await fn();
}
async function walkToEdge(side){globalThis.familyAudio?.stop();interactionTurn++;if(!$('#map').hidden)return;if(challengeGate)closeChallenge();
 const x=side==='left'?heroSize().w/2+.004:1-heroSize().w/2-.004;await walk({x,y:.993},side);
}
function walk(to,side=null,ground=false){if(!$('#map').hidden)return Promise.resolve(false);stopWalk();voiceTurn++;audio.stop();rewardAudio.stop();$('#caption').hidden=true;
 if(!side)void speak('on-way');
 if(!side&&Math.hypot(position.x-to.x,position.y-to.y)<.012)return act({action:'walk',room:state.room,x:position.x,y:position.y,ground}).then(()=>true);
 // Stand in front of friends: their feet must not wall off the entire room.
 const lanes=blocks.filter(b=>!['friend','guest'].includes(b.name));path=walkPath(position,to,heroSize(),lanes);
 trace({path:path.length,from:position,to,side,blocks});if(path.length<2){void speak('path');return Promise.resolve(false);}exitSide=side;arrival={ground};walking=true;hero.classList.add('walking');$('#destination').hidden=!!side;Object.assign($('#destination').style,{left:path.at(-1).x*geometry.W+'px',top:path.at(-1).y*geometry.H+'px'});lastTime=performance.now();frame=requestAnimationFrame(tick);return new Promise(resolve=>walkResolve=resolve);}
function tick(time){if(!walking)return;const dt=Math.min(50,time-lastTime)/1000;lastTime=time;const next=path[1],dx=(next.x-position.x)*geometry.W,dy=(next.y-position.y)*geometry.H,d=Math.hypot(dx,dy),travel=geometry.H*.5*dt;
 if(d<=travel){position={...next};path.shift();}else{position.x+=dx/d*travel/geometry.W;position.y+=dy/d*travel/geometry.H;}
 hero.querySelector('img').style.scale=dx<-.1?'-1 1':dx>.1?'1 1':hero.querySelector('img').style.scale;place(hero,position,heroSize());
 if(path.length>1){frame=requestAnimationFrame(tick);return;}
 const side=exitSide,resolve=walkResolve,ground=arrival?.ground;walkResolve=null;stopWalk();void finishWalk(side,ground).then(()=>resolve?.(true)).catch(e=>{resolve?.(false);showError(e);});
}
async function finishWalk(side,ground=false){if(side){const next=ROOMS[state.room].exits[side],x=side==='left'?1-heroSize().w/2-.012:heroSize().w/2+.012;await hero.animate([{translate:'0 0'},{translate:(side==='left'?-1:1)*heroSize().w*geometry.W+'px 0'}],{duration:180,fill:'forwards'}).finished;await act({action:'walk',room:next,x,y:.993});renderRoom(side);}else await act({action:'walk',room:state.room,x:position.x,y:position.y,ground});}
function openChallenge(key){if(!state.questStarted)return void speak('first');if(state.solved.includes(key)){if(key==='pirate'||definition.early&&key===definition.finishGate){showTreasure();void speak('treasure');}else void speak('found');return;}const g=GATES[key];if(g.requires&&!state.flags.includes(g.requires)){void speak(definition.early?'lock-'+g.requires:key==='bridge'?'lock-bridge':key==='night'?'lock-night':'lock-dig');return;}
 challengeGate=key;misses=0;$('#caption').hidden=true;drawChallenge();updateGoal();void speak(key);}
function drawChallenge(){if(definition.early)return drawPictureChallenge();const g=GATES[challengeGate],el=$('#challenge');if(!g.instruction&&geometry.W>=geometry.H){position={x:.88,y:.993};place(hero,position,heroSize());}if(friend&&geometry.friend&&!g.instruction)place(friend,{x:geometry.friend.x,y:.985},{w:geometry.friend.w,h:geometry.friend.h});if(!g.instruction){position=clearHeroSpot(position);place(hero,position,heroSize());}if(g.instruction){el.hidden=true;return;}
 el.hidden=false;el.innerHTML=`<button class="close" aria-label="Return to the world">×</button><h2>${esc(g.title)}</h2><p>${esc(g.prompt)}</p>${g.captures?`<div class="captures">${Object.entries(g.captures).map(([who,pieces])=>`<div class="capture-side"><strong>${who==='you'?'Your captures':'Bo’s captures'}</strong><div class="capture-row">${pieces.map(([id,value])=>`<div class="capture"><img src="${esc(art.props['chess-'+(who==='you'?'black':'white')+'-'+id]?.url)}" alt="${esc(id)}"><span>${id} · ${value}</span></div>`).join('')}</div></div>`).join('')}</div>`:`<div class="equation">${esc(g.equation)}</div>`}<div class="answers">${g.options.map(v=>`<button data-answer="${esc(v)}">${esc(v)}</button>`).join('')}</div><button class="help">A little hint</button><p class="hint-text" hidden></p>`;
 el.querySelector('.close').onclick=closeChallenge;el.querySelector('.help').onclick=()=>hint();for(const btn of el.querySelectorAll('[data-answer]'))btn.onclick=()=>{unlock();void answer(btn.dataset.answer,btn).catch(showError);};
}

function hint(){const g=GATES[challengeGate];if(!g)return;const el=$('.hint-text');if(el&&!$('#challenge').hidden){if(definition.early)$('#challenge p:not(.hint-text)').hidden=true;el.hidden=false;el.textContent=g.hint;}void speak('hint-'+challengeGate);}
function closeChallenge(event){if(event)globalThis.familyAudio?.stop();challengeGate=null;$('#challenge').hidden=true;voiceTurn++;audio.stop();rewardAudio.stop();layout();}
async function answer(value,button){const key=challengeGate;if(!key)return;document.querySelectorAll('[data-answer]').forEach(b=>b.disabled=true);let result;try{result=await act({action:'solve',gate:key,answer:value});}finally{document.querySelectorAll('[data-answer]').forEach(b=>b.disabled=false);}
 if(challengeGate!==key||disposed||document.hidden)return;
 if(!result.correct){misses++;button.classList.remove('try');void button.offsetWidth;button.classList.add('try');hint();if(misses>=2){const right=document.querySelector(`[data-answer="${GATES[key].answer}"],[data-object="${GATES[key].answer}"]`);right?.classList.add('hint');}return;}
 closeChallenge();renderRoom();if(key==='pirate'||definition.early&&key===definition.finishGate){showTreasure();await speak('treasure');}else await speak(mapPieces(state)===3&&MAP_GATES.includes(key)?'ready':'piece');
}
function showTreasure(){stopWalk();document.querySelectorAll('.reward-fly').forEach(el=>{el.getAnimations().forEach(a=>a.cancel());el.remove();});if(definition.early){$('#map').classList.add('gift-reveal');$('#map').hidden=false;$('#map').innerHTML=`<button class="close" aria-label="Return to the world">×</button><h2>A gift for the guide!</h2><div class="flower-gift">🎁 🌼 🎗️</div><p>A flower present for the guide, wrapped with your strong ribbon. You made this gift together.</p><button class="continue">👣</button>`;wireOverlayClose();layout();return;}$('#caption').hidden=true;$('#map').hidden=false;$('#map').innerHTML=`<button class="close" aria-label="Return to the world">×</button><h2>You found the island treasure!</h2><div class="treasure-scene">${icon('chest')}<span class="treasure-castle">🏰</span>${icon('star')}<span class="treasure-coins">● ● ● ● ●</span></div><p>A tiny island castle, golden coins and a star compass. You are the island’s explorer!</p><button class="continue">Back to the world</button>`;wireOverlayClose();}
function wireOverlayClose(){const close=()=>{globalThis.familyAudio?.stop();$('#map').classList.remove('gift-reveal');$('#map').hidden=true;$('#caption').hidden=true;voiceTurn++;audio.stop();rewardAudio.stop();};$('#map .close').onclick=close;$('#map .continue').onclick=close;}

function drawDoor(){const layer=$('#door-layer');layer.replaceChildren();drawOpening(layer);if(state.room!=='castle-gate'||!bg.door)return;const [x,y,w,h]=bg.door,R=geometry.rect,d={x:R.x+x*R.w,y:R.y+y*R.h,w:w*R.w,h:h*R.h};
 if(state.doorOpen){const g=document.createElement('div');g.className='bk-gate';Object.assign(g.style,{left:d.x+'px',top:d.y+'px',width:d.w+'px',height:d.h+'px'});const half=side=>`<div class="bk-door ${side}" style="background-image:url('${esc(bg.url)}');background-size:${R.w}px ${R.h}px;background-position:${-(d.x-R.x)-(side==='r'?d.w/2:0)}px ${-(d.y-R.y)}px"></div>`;g.innerHTML=`<div class="bk-gate-in">${art.props?.['treasure-chest']?`<img class="bk-gate-gift" src="${esc(art.props['treasure-chest'].url)}" alt="the guide's castle treasure">`:`<div class="world-gate-map">${pieceSVG}</div>`}</div>${half('l')}${half('r')}`;layer.append(g);if(matchMedia('(prefers-reduced-motion: reduce)').matches)g.classList.add('still');requestAnimationFrame(()=>requestAnimationFrame(()=>g.classList.add('open')));
  const b=document.createElement('button');b.className='world-door-tap';b.setAttribute('aria-label','Look at the guide’s castle treasure inside the open castle door');Object.assign(b.style,{position:'absolute',left:d.x+'px',top:d.y+'px',width:d.w+'px',height:d.h+'px',background:'transparent',border:'0',zIndex:'2'});b.onclick=()=>{unlock();void speak('tomorrow');};layer.append(b);
 }
}
function drawOpening(layer){const door=ROOMS[state.room].door;if(!door)return;
 const b=document.createElement('button');b.className=door.return?'opening return-opening':'opening painted-opening';b.dataset.to=door.to;b.setAttribute('aria-label','Enter '+ROOMS[door.to].name);
 if(door.return){b.textContent='↩ '+door.label;Object.assign(b.style,{left:'8px',top:Math.max(.11*geometry.H,geometry.floor*geometry.H-64-10)+'px',translate:'0 0'});}else{const [x,y,w,h]=geometry.W>=geometry.H?door.wide:door.tall,R=geometry.rect;Object.assign(b.style,{left:(R.x+x*R.w)+'px',top:(R.y+y*R.h)+'px',width:Math.max(64,w*R.w)+'px',height:Math.max(64,h*R.h)+'px'});b.innerHTML=`<span>${ROOMS[door.to].icon}</span>`;}
 b.onclick=()=>{trace({opening:door.to});unlock();globalThis.familyAudio?.stop();feedback(b);void approach({x:.5,y:.993},async()=>{await act({action:'enter',room:door.to});renderRoom();}).catch(showError);};layer.append(b);
}
function kingdomMap(){
 const spots=definition.early?Object.fromEntries(Object.keys(ROOMS).map((id,i)=>[id,[90+(i%3)*200,100+Math.floor(i/3)*150]])):{'castle-gate':[290,145],'chess-courtyard':[160,145],'soccer-pitch':[55,145],'treehouse-town':[55,235],bakery:[55,320],'castle-forest':[410,145],workshop:[410,55],'river-bridge':[520,145],'pirate-ship':[520,235],'castle-moon-hill':[390,235],'castle-night':[280,235]};
 const edges=new Set();let paths='';for(const [id,r] of Object.entries(ROOMS))for(const to of [...Object.values(r.exits),...(r.door?[r.door.to]:[])]){const key=[id,to].sort().join('|');if(edges.has(key))continue;edges.add(key);const [x,y]=spots[id],[xx,yy]=spots[to];paths+=`<path d="M${x} ${y}L${xx} ${yy}"/>`;}
 const goal=nextGoal(state);return `<svg viewBox="0 0 600 360" role="img" aria-label="Visited places, your location, the next goal and tools"><g stroke="#a88851" stroke-width="4" fill="none">${paths}</g>${Object.entries(spots).map(([id,[x,y]])=>{const visited=state.visited.includes(id),tool=Object.entries(LOCKS).filter(([,l])=>l.room===id).map(([k,l])=>state.flags.includes(k)||state.flags.includes(k+'-tied')?'✓':state.items.includes(l.item)?({rope:'🪢',lantern:'🏮',net:'🕸',shovel:'⛏'}[l.item]):'<tspan class="map-lock">🔒</tspan>').join(' · ');return `<g data-room="${id}" data-visited="${visited}"><circle cx="${x}" cy="${y}" r="23" fill="${visited?(state.room===id?'#ecc36b':'#e2cc9d'):'#ddd8cf'}" stroke="#a17c45"/><text x="${x}" y="${y+7}" font-size="24" text-anchor="middle">${visited?ROOMS[id].icon:'☁ ?'}</text><text x="${x}" y="${y+37}" font-size="12" text-anchor="middle" fill="#604c2a">${visited?esc(ROOMS[id].name):'?'}</text>${state.room===id?`<text x="${x}" y="${y-30}" font-size="14" text-anchor="middle">▼ You</text>`:''}${goal.room===id?`<text x="${x+24}" y="${y-18}" font-size="22">⭐</text>`:''}${visited&&tool?`<text x="${x}" y="${y+53}" font-size="10" text-anchor="middle">${tool}</text>`:''}</g>`;}).join('')}</svg>`;
}
function showMap(){globalThis.familyAudio?.stop();interactionTurn++;stopWalk();voiceTurn++;audio.stop();rewardAudio.stop();challengeGate=null;$('#challenge').hidden=true;$('#caption').hidden=true;$('#map').hidden=false;$('#map').innerHTML=`<button class="close" aria-label="Return to the world">×</button><h2>Your map · ${mapPieces(state)} / ${MAP_GATES.length}</h2>${kingdomMap()}<p>${esc(nextGoal(state).text)}</p><button class="continue">Back to the world</button>`;wireOverlayClose();}

$('#scene').onpointerdown=e=>{if(e.target.closest('button')||!$('#map').hidden||(challengeGate&&!GATES[challengeGate]?.instruction)||!geometry)return;unlock();const p={x:e.clientX/geometry.W,y:e.clientY/geometry.H};if(p.y<geometry.floor)return;const side=p.x<.035?'left':p.x>.965?'right':null;if(side&&ROOMS[state.room].exits[side])walkToEdge(side);else {interactionTurn++;void walk(p,null,true);}};
$('#home-button').onclick=()=>{globalThis.familyAudio?.stop();location.href='/?player='+encodeURIComponent(player);};
$('#map-button').onclick=()=>{unlock();showMap();};$('#goal').onclick=()=>{unlock();void speak(nextHint(state));};
$('#what-next').onclick=()=>{unlock();if(challengeGate)hint();else void speak(nextHint(state));};$('#caption').onclick=()=>{unlock();if(lastLine)void speak(lastLine);};$('#sound').onclick=()=>{unlock();muted=!muted;$('#sound').textContent=muted?'♫̸':'♪';$('#sound').setAttribute('aria-label',muted?'Turn voice on':'Mute voice');if(muted){voiceTurn++;audio.stop();rewardAudio.stop();}else if(lastLine)void speak(lastLine);};
addEventListener('family-audio-stop',()=>{interactionTurn++;voiceTurn++;stopWalk();clearTimeout(captionTimer);audio.stop();rewardAudio.stop();});
addEventListener('resize',()=>{layout();});addEventListener('pagehide',()=>{disposed=true;stopWalk();clearTimeout(captionTimer);audio.dispose();rewardAudio.dispose();});
async function openWorld(){data=await api();({state,art,lines,definition}=data);({ROOMS,GATES,mapPieces,ITEMS,LOCKS,friendDone,nextHint,nextGoal,goalTarget,MAP_GATES}=createWorldModel(definition));definition=createWorldModel(definition).definition;$('#world').classList.toggle('small-world',!!definition.early);$('.place small').textContent=definition.early?'The Castle Kingdom':'THE CASTLE KINGDOM';document.title='The Castle Kingdom';void warmVoices();$('#adult').hidden=true;$('#loading').hidden=true;$('#world').hidden=false;renderRoom();}
let gate;async function showGate(){gate=await fetch('/api/book/review/gate').then(r=>r.json());if(gate.unlocked)return openWorld();$('#loading').hidden=true;$('#adult').hidden=false;$('#question').textContent=gate.question;$('#code').textContent=gate.code;}
$('#gate-form').onsubmit=async e=>{e.preventDefault();try{const r=await fetch('/api/book/review/gate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:gate.id,answer:$('#answer').value})}),j=await r.json();if(!r.ok)throw Error(j.error);await openWorld();}catch(e){$('#gate-status').textContent=e.message;await openWorld();}};
void openWorld().catch(e=>{$('#loading').hidden=false;$('#loading').textContent=e.message;});

// Playback warms recorded bytes only. Rendering is a release step, never a child tap.
async function warmVoices(){await audio.warm(Object.values(lines||{}).filter(l=>l.clip).map(l=>'/book-voice/'+l.clip+'?r=L1'));}
function feedback(button){button.classList.add('tap-feedback');setTimeout(()=>button.classList.remove('tap-feedback'),180);}
let pictureProgress=0;
function drawPictureChallenge(){
 const g=GATES[challengeGate],el=$('#challenge');pictureProgress=0;el.hidden=false;
 const playable=['order','count','pattern'].includes(g.kind);
 el.innerHTML=`<button class="close" aria-label="Return to the world">×</button><h2>${esc(g.title)}</h2><p>${esc(g.prompt.replace(/\[\[ɑ\]\]/g,'/o/'))}</p><div class="picture-progress" aria-live="polite"></div><div class="picture-play ${esc(g.kind)}">${playable?Array.from({length:g.count},(_,i)=>`<button data-step="${i}" aria-label="${g.kind==='count'?'Pizza':g.kind==='pattern'?'Empty flower patch':'Step'} ${i+1}" class="${i===0&&g.kind!=='count'?'next-target':''}"><span aria-hidden="true">${g.kind==='count'?'🍕':g.kind==='pattern'?'🟫':challengeGate==='mats'?'🔵':'🪨'}</span></button>`).join(''):g.options.map(id=>`<button data-answer="${esc(id)}" aria-label="${esc(id)}"><span aria-hidden="true">${esc(g.pictures[id])}</span></button>`).join('')}</div>${g.kind==='count'?'<div class="pizza-box" aria-label="Pizza box">📦</div>':challengeGate==='mats'?'<div class="blue-bar" aria-label="Blue pull-up bar">━</div>':g.kind==='pattern'?'<div class="flower-pattern" aria-label="Flower, space, flower, space">🌼　 🌼　</div>':''}<button class="help" aria-label="Hear a hint">💬 ?</button><p class="hint-text" hidden></p>`;
 el.querySelector('.close').onclick=closeChallenge;el.querySelector('.help').onclick=()=>{unlock();hint();};
 if(friend&&geometry.friend){place(friend,{x:geometry.friend.x,y:.985},{w:geometry.friend.w,h:geometry.friend.h});}position=clearHeroSpot(position);place(hero,position,heroSize());
 for(const b of el.querySelectorAll('[data-answer]'))b.onclick=()=>{unlock();feedback(b);void answer(b.dataset.answer,b).catch(showError);};
 for(const b of el.querySelectorAll('[data-step]'))b.onclick=()=>{
  unlock();feedback(b);const index=Number(b.dataset.step);if(b.classList.contains('used'))return;
  if(g.kind!=='count'&&index!==pictureProgress){hint();return;}
  pictureProgress++;b.classList.add('used');b.disabled=true;b.classList.remove('next-target');
  if(g.kind==='count'){b.style.visibility='hidden';el.querySelector('.pizza-box').append(Object.assign(document.createElement('span'),{textContent:'🍕'}));}
  if(g.kind==='pattern')b.querySelector('span').textContent='🌼';
  el.querySelector('.picture-progress').textContent='● '.repeat(pictureProgress);el.querySelector(`[data-step="${pictureProgress}"]`)?.classList.add('next-target');
  void speak('count-'+pictureProgress);
  if(pictureProgress===g.count){if(challengeGate==='mats'){const img=hero?.querySelector('img');img?.animate([{translate:'0 0'},{translate:'0 -24px'},{translate:'0 0'}],{duration:700});}const key=challengeGate;const completion=audio.finished();void completion.then(()=>{if(challengeGate===key&&!document.hidden)void answer(g.answer,b).catch(showError);});}
 };
}

function clearHeroSpot(preferred){const reservations=[...document.querySelectorAll('.actor:not(.hero),[data-object],.signpost,.hud')].filter(e=>!e.hidden).map(e=>{const r=e.getBoundingClientRect();return {x0:r.x/geometry.W,x1:r.right/geometry.W,y0:r.y/geometry.H,y1:r.bottom/geometry.H};});return worldSpot(preferred,heroSize(),reservations,{floor:Math.max(geometry.floor,.93)});}
