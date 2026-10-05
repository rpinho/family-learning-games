import {selectBackground,backgroundRect,paintedTapRect} from './book-painted-layout.mjs';

// The model is shared by the renderer and certification. A numerical answer is
// never selectable before the child has interacted with the actual painting.
export function sceneTargets(g,background,{width,height}={}){
 const b=selectBackground(background,{width,height,painted:true}),p=g.scenePuzzle;
 return p?.targets?.[width<height?'tall':'wide']||b?.targets?.[p?.painted]||[];
}
export function projectSceneTargets(g,background,viewport,rect=backgroundRect(selectBackground(background,{...viewport,painted:true}),viewport)){
 return sceneTargets(g,background,viewport).map(t=>{
  const [x,y,w,h]=t.r,paint={x:rect.x+x*rect.w,y:rect.y+y*rect.h,w:w*rect.w,h:h*rect.h};
  return {...t,paint,tap:paintedTapRect(paint,viewport)};
 });
}
export function scenePuzzleSession(g,targets){
 const p=g.scenePuzzle,ids=targets.map(t=>t.id),seen=new Set(),removed=new Set();let next=0;
 const phase=()=>p.mode==='subtract'?(removed.size<p.takeAway?'remove':seen.size<ids.length-removed.size?'count':'answer'):seen.size<ids.length?'count':'answer';
 return {
  get phase(){return phase();},get seen(){return [...seen];},get removed(){return [...removed];},
  get ready(){return phase()==='answer';},
  tap(id){if(!ids.includes(id))return {accepted:false};
   if(phase()==='remove'){removed.add(id);return {accepted:true,removed:true,ready:this.ready};}
   if(removed.has(id)||seen.has(id)||(p.mode==='order'||p.ordered)&&id!==ids[next])return {accepted:false};
   seen.add(id);next++;return {accepted:true,count:(p.startAt||0)+seen.size,ready:this.ready};
  },
  answer(value){return this.ready&&String(value)===g.answer;}
 };
}
export function scenePuzzleIssues(g,background){
 const p=g.scenePuzzle,issues=[];if(!p)return ['Missing scenePuzzle'];
 if(['count','order','subtract','compare','add','missing','difference'].includes(p.mode))for(const [width,height]of [[1366,768],[390,844]]){
  const ts=sceneTargets(g,background,{width,height}),ids=ts.map(t=>t.id);
  if(!ts.length)issues.push('No measured painted targets');
  if(new Set(ids).size!==ids.length)issues.push('Duplicate painted target');
  for(const t of ts)if(!t.r?.every(Number.isFinite)||t.r.length!==4||t.r.some(v=>v<0||v>1))issues.push('Invalid measured target');
  if(['count','add'].includes(p.mode)&&Number(g.answer)!==ts.length+(p.startAt||0))issues.push('Count answer disagrees with painting');
  if(p.mode==='missing'&&(Number(g.answer)!==ts.length||p.startAt+ts.length!==p.total))issues.push('Missing part disagrees with painting');
  if(p.mode==='subtract'&&(p.takeAway>=ts.length||p.takeAway<1||Number(g.answer)!==ts.length-p.takeAway))issues.push('Subtraction answer disagrees with painting');
  if(['compare','difference'].includes(p.mode)){
   const groups=p.groups||[],all=groups.flat();if(groups.length!==2||all.some(id=>!ids.includes(id))||new Set(all).size!==all.length||all.length!==ids.length)issues.push('Comparison groups do not partition the painting');
   const expected=p.mode==='difference'?String(Math.abs(groups[0]?.length-groups[1]?.length)):groups[0]?.length===groups[1]?.length?'same':(groups[0]?.length>groups[1]?.length)!==(p.compare==='fewer')?'left':'right';if(g.answer!==expected)issues.push('Comparison answer disagrees with painting');
  }
 }
 // No printed total or equation can bypass looking at the scene.
 if(['count','subtract','compare'].includes(p.mode)&&g.equation)issues.push('Scene puzzle exposes its total as an equation');
 if(['count','subtract','compare'].includes(p.mode)){const words=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'],visible=[g.title,g.goal,g.prompt].join(' '),totals=p.mode==='compare'?g.counts:[Number(g.answer)];for(const n of totals||[])if(new RegExp('\\b('+n+'|'+words[n]+')\\b','i').test(visible))issues.push('Scene puzzle reveals its answer in the instruction');}
 return [...new Set(issues)];
}

let mounted;
const stylesheet=`
.small-world .gift-reveal .flower-gift{font-size:48px;padding:4px}

.scene.scene-puzzle-active .signpost,.scene.scene-puzzle-active .opening,.scene.scene-puzzle-active .world-object{visibility:hidden}
.world-painted-layer{position:absolute;inset:0;z-index:9;pointer-events:none}
.world-painted-target{position:absolute;pointer-events:auto;border:0!important;background:transparent!important;padding:0!important;min-width:0!important;min-height:0!important;box-shadow:none!important}
.world-painted-ring{position:absolute;border:2px solid #fff2b7;border-radius:50%;box-shadow:0 0 0 1px #674c37aa;pointer-events:none}
.world-painted-target.used .world-painted-ring{border:3px solid #4e8b57;background:#82c49644}
.world-painted-target.removed .world-painted-ring{border:3px solid #865c4b;background:#3c2b2599;display:grid;place-items:center;color:white;font-size:22px}
.world-painted-target.current .world-painted-ring{border:4px solid #ffcb4c;box-shadow:0 0 8px #ffd24c}
.world-painted-group{position:absolute;border:2px dashed #ad7641;border-radius:15px;pointer-events:none}
.world-painted-group span{position:absolute;top:-25px;left:50%;translate:-50% 0;border-radius:8px;background:#fff7e3;padding:1px 8px;color:#4f3628;font-size:18px}
#challenge.world-scene-challenge{width:var(--scene-panel-width,320px)!important;max-width:92vw;max-height:40vh;overflow:auto;padding:8px 12px!important;translate:0 0!important;z-index:11}
.world-scene-challenge h2{font-size:17px;margin:0 30px 4px 0}.world-scene-challenge p{font-size:15px;line-height:1.25;margin:4px 0}
.world-scene-challenge .close{width:32px;height:32px;min-width:32px;min-height:32px;font-size:24px;top:4px;right:4px}
.world-scene-challenge .scene-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.world-scene-challenge button:not(.close){min-height:44px;min-width:44px;border:1px solid #957847;border-radius:10px;background:#fff8e5;color:#47341e;font-size:20px;padding:4px 10px}
.world-scene-challenge .scene-answers{display:flex;gap:8px;margin:6px 0;justify-content:center;flex-wrap:wrap}
.world-scene-challenge .scene-answers button{min-height:52px;min-width:62px;font-size:24px}
.world-scene-challenge .scene-answers button:disabled{opacity:.35}
.world-scene-challenge .scene-progress{font-size:22px;font-weight:600;margin:0 8px}
.world-scene-challenge .scene-pattern{display:flex;gap:4px;flex-wrap:wrap;justify-content:center;font-size:26px;padding:6px}
@media(orientation:portrait),(max-width:1100px){.world-scene-challenge p:not(.hint-text){display:none}}
.world-scene-challenge .scene-gap{border:2px dashed #8a6338;border-radius:8px;min-width:30px;text-align:center}
`;

// UI adapter owns its observers and transparent tap layer. Hidden overlays,
// travel, Home and a new challenge dispose it; no delayed solve can survive exit.
export function mountScenePuzzle({gate,key,element,scene,background,unlock=()=>{},speak=()=>{},finished=()=>Promise.resolve(),hint=()=>{},close=()=>{},answer=()=>{},onError=()=>{},onLayout=()=>{}}){
 mounted?.();
 const doc=element.ownerDocument;installScenePuzzleStyles(doc);
 const room=scene.dataset.room,layer=doc.createElement('div');layer.className='world-painted-layer';layer.dataset.gate=key;scene.append(layer);scene.classList.add('scene-puzzle-active');
 const originalStyle=element.getAttribute('style'),painting=doc.querySelector('#painting'),originalTransform=painting?.style.transform||'';
 let disposed=false,busy=false,targets=[],buttons=[],session;
 const dispose=()=>{if(disposed)return;disposed=true;resize.disconnect();observer.disconnect();layer.remove();scene.classList.remove('scene-puzzle-active');element.classList.remove('world-scene-challenge');if(originalStyle===null)element.removeAttribute('style');else element.setAttribute('style',originalStyle);if(painting)painting.style.transform=originalTransform;globalThis.removeEventListener('family-audio-stop',stop);globalThis.removeEventListener('pagehide',dispose);if(mounted===dispose)mounted=null;};
 // Silence can occur on a room transition while its challenge is still visible.
 const stop=()=>{dispose();close();};
 const resize=new ResizeObserver(()=>position());
 const observer=new MutationObserver(()=>{if(element.hidden||!element.isConnected||scene.dataset.room!==room)dispose();});
 mounted=dispose;observer.observe(element,{attributes:true,attributeFilter:['hidden']});observer.observe(scene,{attributes:true,attributeFilter:['data-room']});resize.observe(scene);
 globalThis.addEventListener('family-audio-stop',stop);globalThis.addEventListener('pagehide',dispose);
 element.hidden=false;element.classList.add('world-scene-challenge');element.replaceChildren();
 const el=(tag,text,parent=element)=>{const e=doc.createElement(tag);if(text)e.textContent=text;parent.append(e);return e;};
 const x=el('button','×');x.className='close';x.setAttribute('aria-label','Return to the world');x.onclick=event=>{dispose();close(event);};
 el('h2',gate.title);el('p',gate.scenePuzzle.mode==='sound'?'Hear the sound. Choose its letter.':gate.prompt);
 const actions=el('div');actions.className='scene-actions';const hear=el('button','🔊',actions);hear.setAttribute('aria-label','Hear the puzzle again');hear.onclick=()=>{unlock();void speak(gate.scenePuzzle.mode==='sound'?'sound-'+key+'-'+gate.letter:key);};
 const help=el('button','💬 ?',actions);help.setAttribute('aria-label','Hear a hint');help.onclick=()=>{unlock();hint();};
 const progress=el('output','',actions);progress.className='scene-progress';progress.setAttribute('aria-live','polite');
 const hintText=el('p');hintText.className='hint-text';hintText.hidden=true;
 const p=gate.scenePuzzle;if(p.mode==='missing'){const equation=el('div',`${p.startAt} + ? = ${p.total}`);equation.className='scene-pattern';}if(p.startAt)progress.textContent=String(p.startAt);
 if(p.mode==='pattern'){const row=el('div');row.className='scene-pattern';for(const id of p.sequence){const c=el('span',id?gate.pictures[id]:'?',row);if(!id)c.className='scene-gap';}}
 const choices=el('div');choices.className='scene-answers';
 for(const value of p.mode==='order'?[]:gate.options){const b=el('button',gate.pictures?.[value]||value,choices);b.dataset.answer=value;b.setAttribute('aria-label',value);b.disabled=['count','subtract','compare','add','missing','difference'].includes(p.mode);b.onclick=async()=>{if(disposed||busy||b.disabled)return;unlock();busy=true;try{await answer(value,b);}catch(e){onError(e);}finally{busy=false;}};}
 const selectTargets=()=>{const size={width:scene.clientWidth,height:scene.clientHeight};return sceneTargets(gate,background,size);};
 targets=selectTargets();session=scenePuzzleSession(gate,targets);
 if(['count','order','subtract','compare','add','missing','difference'].includes(p.mode)&&!targets.length){progress.textContent='This painting needs measured targets.';onError(Error('Missing measured scene targets: '+key));return dispose;}
 const activate=async id=>{
  if(disposed||busy)return;unlock();const result=session.tap(id);if(!result.accepted){hint();return;}
  const b=buttons.find(e=>e.dataset.paintedId===id);b.classList.add(result.removed?'removed':'used');if(result.removed)b.querySelector('span').textContent='×';
  if(result.count){const group=['compare','difference'].includes(p.mode)?p.groups.findIndex(ids=>ids.includes(id)):-1,count=group<0?result.count:session.seen.filter(id=>p.groups[group].includes(id)).length;progress.textContent=(group<0?'':group?'→ ':'← ')+String(count);busy=true;await speak('count-'+count);await finished();busy=false;}
  if(disposed)return;
  for(const x of buttons)x.classList.toggle('current',(p.mode==='order'||p.ordered)&&!session.seen.includes(x.dataset.paintedId)&&x.dataset.paintedId===targets[session.seen.length]?.id);
  if(session.ready){if(p.mode==='order'){busy=true;try{await answer(gate.answer,b);}catch(e){onError(e);}finally{busy=false;}}else for(const x of choices.querySelectorAll('button'))x.disabled=false;}
 };
 for(const [i,t]of targets.entries()){const b=el('button','',layer);b.type='button';b.className='world-painted-target';b.dataset.paintedId=t.id;b.setAttribute('aria-label',t.label);b.classList.toggle('current',(p.mode==='order'||p.ordered)&&i===0);const ring=el('span','',b);ring.className='world-painted-ring';b.onclick=()=>void activate(t.id).catch(onError);buttons.push(b);}
 let projected=[];
 // Finger-sized areas may overlap. Real pointer taps resolve against the
 // nearest painted centre, while keyboard activation keeps the focused target.
 layer.addEventListener('click',e=>{if(e.detail===0||!e.target.closest('.world-painted-target'))return;const r=scene.getBoundingClientRect(),x=e.clientX-r.x,y=e.clientY-r.y;const nearest=projected.map(t=>({id:t.id,d:Math.hypot(x-t.paint.x-t.paint.w/2,y-t.paint.y-t.paint.h/2)})).sort((a,b)=>a.d-b.d)[0];e.stopImmediatePropagation();if(nearest)void activate(nearest.id).catch(onError);},true);
 function position(){if(disposed)return;const size={width:scene.clientWidth,height:scene.clientHeight},base=scene.getBoundingClientRect();
  if(painting)painting.style.transform=originalTransform;
  const image=painting?.getBoundingClientRect(),rect=image?{x:image.x-base.x,y:image.y-base.y,w:image.width,h:image.height}:undefined;
  projected=projectSceneTargets(gate,background,size,rect);
  const controlsBottom=Math.max(...['.hud','#goal','#tutorial'].map(s=>{const e=doc.querySelector(s);return e&&!e.hidden?e.getBoundingClientRect().bottom-base.y:0;}));
  // The portrait art holds answers near its top. Shift the painting and its
  // measured targets together just enough to keep them below the header.
  if(projected.length){const top=Math.min(...projected.map(t=>t.tap.y)),shift=Math.max(0,controlsBottom+10-top);if(shift&&painting){painting.style.transform=`translateY(${shift}px)`;for(const t of projected){t.paint.y+=shift;t.tap.y+=shift;}}}
  for(const [i,t]of projected.entries()){const b=buttons[i],r=t.tap,q=t.paint;if(!b)continue;Object.assign(b.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});Object.assign(b.querySelector('span').style,{left:q.x-r.x+'px',top:q.y-r.y+'px',width:q.w+'px',height:q.h+'px'});}
  layer.querySelectorAll('.world-painted-group').forEach(e=>e.remove());
  if(['compare','difference'].includes(p.mode))for(const [i,ids]of p.groups.entries()){const ts=projected.filter(t=>ids.includes(t.id)),x=Math.min(...ts.map(t=>t.paint.x))-5,y=Math.min(...ts.map(t=>t.paint.y))-5,right=Math.max(...ts.map(t=>t.paint.x+t.paint.w))+5,bottom=Math.max(...ts.map(t=>t.paint.y+t.paint.h))+5;const g=el('div','',layer);g.className='world-painted-group';Object.assign(g.style,{left:x+'px',top:y+'px',width:right-x+'px',height:bottom-y+'px'});el('span',i?'→':'←',g);}
  const bounds=projected.length?{left:Math.min(...projected.map(t=>t.tap.x)),right:Math.max(...projected.map(t=>t.tap.x+t.tap.w)),bottom:Math.max(...projected.map(t=>t.tap.y+t.tap.h))}:null;
  let panelW=Math.min(320,size.width-16);if(bounds&&size.width>=size.height){const sideSpace=Math.max(bounds.left,size.width-bounds.right);if(sideSpace>=190)panelW=Math.min(panelW,sideSpace-24);}let left=8,top=controlsBottom+10;
  if(bounds&&bounds.left<panelW+20){if(size.width-bounds.right>panelW+20)left=bounds.right+12;else top=bounds.bottom+12;}
  element.style.setProperty('--scene-panel-width',panelW+'px');Object.assign(element.style,{left:left+'px',top:top+'px',maxHeight:Math.max(100,size.height-top-12)+'px'});
 }
 position();onLayout();return dispose;
}

export function installScenePuzzleStyles(doc){if(doc.querySelector('#world-scene-puzzle-style'))return;const style=doc.createElement('style');style.id='world-scene-puzzle-style';style.textContent=stylesheet;doc.head.append(style);}
if(typeof document!=='undefined')installScenePuzzleStyles(document);
