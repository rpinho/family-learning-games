import {LIVE_RULES,LIVE_LEVELS,INTRO,GOAL_VOICE,createMatch,advance,replay,encodeInput,decodeInput,metrics} from './dribble-live.mjs';
import {createLivePitch} from './live-pitch.mjs';
import {createSaveQueue,fetchJSON} from './save-request.mjs';
import {letterName} from './reading-reward.mjs';
export function mountDribble(root,{player,event}){
 let p=null,s=null,roundId=null,inputs='',alive=true,paused=true,changing=false,epoch=0,raf=0,last=0,acc=0,target=null,pointer=null,drag=null,finished=false,saveError=false,nextTimer=0,lastCheckpoint=0,voiceAt=-Infinity,spoken=false,sound=true,audioContext;
 const saves=createSaveQueue(),keys=new Set(),narration=new Audio();let clips={},voiceToken=0,rewardBusy=false,rewardShown=null,rewardTimer=0,explicitPause=false;
 fetch('/voice/manifest.json').then(r=>r.ok?r.json():null).then(d=>{clips=d?.clips||{};}).catch(()=>{});
 root.innerHTML='<section class="soccer live-soccer"><div class="soccer-title"><h1>⚽ Dribble Duel <small>LIVE</small></h1><span class="score" id="goals">0 dribbles past</span><div class="difficulty"><button id="easier" aria-label="Easier defender">−</button><select id="level" aria-label="Defender difficulty">'+LIVE_LEVELS.map((n,i)=>'<option value="'+(i+1)+'">'+(i+1)+' · '+n+'</option>').join('')+'</select><button id="harder" aria-label="Harder defender">+</button></div></div><div class="match"><div><div class="pitch-wrap"><canvas tabindex="0" aria-label="Live soccer. Drag anywhere on the pitch to steer your blue player and ball. Lift to pause. Arrow keys also work."></canvas></div><p class="status" role="status" aria-live="polite">Getting the pitch ready…</p></div><aside class="coach-panel"><h2>Take the ball past.</h2><p>Drag to move. Pull the defender one way, then cut the other way.</p><p class="small">Lift to pause. Keep the ball at your feet—no shooting.</p><div class="coach-buttons"><button id="hear">🔊 Hear again</button><button id="sound">♪ Sound on</button></div><div class="live-actions"><button id="pause">▶ Resume</button><button id="restart">New try</button><button id="retry-save" hidden>Retry save</button></div><details><summary>Keyboard controls</summary><p>Hold the arrow keys to dribble. Space pauses. The blue player is you.</p></details></aside></div><details class="soccer-foot"><summary>For grown-ups</summary><p>The orange defender reacts to your player’s past position, not your finger. A yellow line shows a coming lunge; the ring shows recovery. Try a change of direction then. Difficulty changes start a new try immediately. Three wins move up; three tackles lower the next level. Old puzzle scores are kept separately.</p><p>This practices timing and spotting space on a screen, not real footwork. Try slow changes of direction together with a soft ball in a clear space.</p></details></section>';
 const $=q=>root.querySelector(q),canvas=$('canvas'),pitch=createLivePitch(canvas);
 const reward=document.createElement('section');reward.className='reading-reward';reward.hidden=true;reward.setAttribute('aria-label','Letter reward');$('.pitch-wrap').append(reward);
 canvas.setAttribute('aria-label','Drag to dribble. Lift to stop with the ball. Touch again to keep going.');
 $('.coach-panel .small').textContent='Lift to stop with the ball. Touch again to keep going.';
 $('.coach-panel h2').textContent='Dribble into the goal.';
 $('.coach-panel>p').textContent='Draw a lunge, change direction, then bring the ball between the posts.';
 $('.soccer-foot p').textContent='A yellow line shows a committed lunge; the ring shows recovery. Four consecutive goals move up one level. Two tackles ease the next level, by two steps at level 6 or above. You can always choose any of the twelve levels yourself; changes start a new try immediately. All earlier scores are preserved.';
 const previousScores=document.createElement('p');previousScores.className='previous-scores';$('.soccer-foot').append(previousScores);
 const pendingReward=()=>p?.live?.reading?.pending;
 function showReward(){
  const q=pendingReward();if(!q||q.done){reward.hidden=true;return false;}
  clearTimeout(nextTimer);release();finished=true;reward.hidden=false;
  reward.innerHTML='<h2>⭐ Letter reward</h2><p class="reward-prompt"></p><div class="reward-model"></div><div class="reward-options"></div><p class="reward-feedback" role="status"></p><div class="reward-tools"><button data-hear>🔊 Hear again</button><button data-help>Show me</button><button data-skip>Keep dribbling →</button></div>';
  reward.querySelector('.reward-prompt').textContent=q.prompt;
  reward.querySelector('.reward-model').textContent=q.display;
  for(const option of q.options){const b=document.createElement('button');b.textContent=option;b.className='reward-option';b.disabled=rewardBusy;b.onclick=()=>void readingAction('answer',option);if(q.helped&&option===q.answer)b.classList.add('revealed');reward.querySelector('.reward-options').append(b);}
  reward.querySelector('.reward-feedback').textContent=q.helped?'Tap the glowing answer. Your dribble still counts.':q.errors?'Try another. Your dribble still counts.':'Listen, then choose.';
  reward.querySelector('[data-hear]').onclick=()=>{speak(q.cue,true);event('dribble_reading_replay',q.id);};
  reward.querySelector('[data-help]').onclick=()=>void readingAction('help');
  reward.querySelector('[data-skip]').onclick=()=>void readingAction('skip');
  reward.querySelectorAll('button').forEach(b=>b.disabled=rewardBusy);
  if(rewardShown!==q.id){rewardShown=q.id;speak(q.cue,true);reward.querySelector('[data-hear]').focus({preventScroll:true});event('dribble_reading_open',q.id);}
  status('A quick letter challenge. Your win is saved.');show();return true;
 }
 async function readingAction(type,answer){
  const q=pendingReward();if(rewardBusy||!q||q.done)return;const my=epoch;rewardBusy=true;
  if(answer)speak(answer.length===1?letterName(answer):answer,true);
  showReward();
  try{
   const d=await job({type:'live-reading-'+type,questionId:q.id,actionId:crypto.randomUUID?.()||Date.now()+'-'+Math.random(),...(answer?{answer}:{})});
   if(!alive||my!==epoch)return;rewardBusy=false;saveError=false;
   if(pendingReward()?.done){
    const skipped=pendingReward().skipped;reward.querySelectorAll('button').forEach(b=>b.disabled=true);
    reward.querySelector('.reward-feedback').textContent=skipped?'Your dribble still counts.':'⭐ Reading star!';
    if(!skipped)effect(true);
    rewardTimer=setTimeout(()=>{if(!alive||my!==epoch)return;reward.hidden=true;void change('live-start');},skipped?0:1400);
   }else{showReward();if(d.result.kind==='reading-help'||d.result.helped)speak(pendingReward().model,true);}
  }catch(e){if(alive&&my===epoch){rewardBusy=false;failed(e);reward.querySelectorAll('button').forEach(b=>b.disabled=true);}}
 }
 function stopVoice(){voiceToken++;narration.pause();speechSynthesis.cancel();}
 function speak(line,manual=false){
  if(!alive||!sound||!manual&&performance.now()-voiceAt<7000)return;
  stopVoice();voiceAt=performance.now();const token=voiceToken;
  const fallback=()=>{if(!alive||!sound||token!==voiceToken)return;const u=new SpeechSynthesisUtterance(line),v=speechSynthesis.getVoices().filter(x=>/^en[-_]US$/i.test(x.lang));u.voice=v.find(x=>/samantha|ava|jenny|aria|joanna|female|google us/i.test(x.name))||v[0]||null;u.lang='en-US';u.rate=.94;speechSynthesis.speak(u);};
  if(clips[line]){narration.src=clips[line];narration.play().catch(fallback);}else fallback();
 }
 function intro(){let heard=spoken;try{heard||=sessionStorage.getItem('live-dribble-intro:'+player)==='1';}catch{}if(heard||!sound)return;spoken=true;try{sessionStorage.setItem('live-dribble-intro:'+player,'1');}catch{}speak(INTRO);}
 function effect(win){if(!sound)return;try{audioContext??=new AudioContext();void audioContext.resume();const t=audioContext.currentTime;for(const[i,f]of(win?[660,880,1100]:[210]).entries()){const o=audioContext.createOscillator(),g=audioContext.createGain();o.frequency.value=f;g.gain.setValueAtTime(.0001,t+i*.1);g.gain.exponentialRampToValueAtTime(.09,t+i*.1+.015);g.gain.exponentialRampToValueAtTime(.0001,t+i*.1+.18);o.connect(g);g.connect(audioContext.destination);o.start(t+i*.1);o.stop(t+i*.1+.2);}}catch{}}
 function status(text){if(alive)$('.status').textContent=text;}
 function show(){
  if(!p||!alive)return;const g=p.live;
  $('#goals').textContent=(g?.goals||0)+(g?.goals===1?' goal':' goals');$('#level').value=g?.level||1;
  previousScores.textContent='Previous end-zone dribbles: '+Math.max(0,(g?.wins||0)-(g?.goals||0))+'. Original puzzle dribbles: '+(p.dribbles||0)+'. All kept.';
  $('#easier').disabled=changing||!g||g.level===1;$('#harder').disabled=changing||!g||g.level===LIVE_LEVELS.length;$('#level').disabled=changing;
  $('#restart').disabled=changing;$('#pause').disabled=changing||!s||!!s.outcome||saveError;
  $('#pause').textContent=paused?'▶ Resume':'Ⅱ Pause';$('#retry-save').hidden=!saveError;$('#retry-save').disabled=false;
  if(pendingReward()&&!pendingReward().done)$('#pause').disabled=true;
 }
 function release(){pointer=null;drag=null;keys.clear();paused=true;acc=0;show();}
 function begin(){if(!s||s.outcome||changing||saveError||!reward.hidden)return;explicitPause=false;paused=false;intro();show();}
 async function request(a){return fetchJSON('/api/dribble?player='+player,a?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...a,liveRules:LIVE_RULES,revision:p.revision})}:{});}
 async function job(a){
  return saves.run(async()=>{if(!alive)return null;try{const d=await request(a);if(alive)p=d.profile;return d;}catch(e){try{const d=await request();if(alive)p=d.profile;}catch{}throw e;}});
 }
 function failed(e){
  if(!alive)return;release();saveError=true;clearTimeout(nextTimer);status('Could not save yet. Tap Retry save, or Games to leave.');$('#retry-save').hidden=false;$('#retry-save').disabled=false;show();event('dribble_live_error',e.message);
  if(p?.live?.round&&roundId&&p.live.round.id!==roundId){install();status('The duel changed in another window. Your current game is here.');}
  if(e.code==='CLIENT_UPDATE'){const u=new URL(location.href);u.searchParams.set('v',Date.now());location.replace(u);}
 }
 function install(){
  const r=p.live.round;roundId=r.id;s=replay(r.level,r.seed,r.inputs,r.rules||1);inputs=r.inputs;lastCheckpoint=inputs.length;finished=false;saveError=false;target={x:s.player.x,y:s.player.y};pitch.reset();release();status(inputs?'Your saved dribble is here. Drag to continue.':'Dribble past the defender and into the goal.');show();
  if(showReward())return;
  if(s.outcome)void finish();
 }
 async function change(type,level){
  if(changing)return;const my=++epoch;release();changing=true;clearTimeout(nextTimer);clearTimeout(rewardTimer);rewardBusy=false;reward.hidden=true;stopVoice();show();status('Starting your new try…');
  try{const d=await job({type,...(level?{level}:{})});if(!alive||my!==epoch||!d)return;changing=false;install();event('dribble_live_setting',type+':'+p.live.level);}
  catch(e){if(alive&&my===epoch){changing=false;failed(e);}}
 }
 async function checkpoint(){
  if(!p||!s||finished||changing||saves.busy()||inputs.length===lastCheckpoint)return;
  const my=epoch,copy=inputs,id=roundId;lastCheckpoint=copy.length;
  try{await job({type:'live-checkpoint',roundId:id,inputs:copy});if(alive&&my===epoch)show();}
  catch(e){if(alive&&my===epoch){lastCheckpoint=0;failed(e);}}
 }
 async function finish(){
  if(finished||!s?.outcome||changing)return;finished=true;release();const my=epoch,outcome=s.outcome,copy=inputs,id=roundId;
  const won=['goal','escaped'].includes(outcome);effect(won);status(outcome==='goal'?'GOAL! You dribbled it into the net!':outcome==='escaped'?'You kept the ball and got past!':outcome==='tackled'?'Ball taken. Try drawing a lunge, then change direction.':'Good practice. Try a fresh duel.');
  if(outcome==='goal')speak(GOAL_VOICE,true);
  event('dribble_live_end',JSON.stringify(metrics(s)));
  try{
   const d=await job({type:'live-finish',roundId:id,inputs:copy,reading:true});if(!alive||my!==epoch||!d)return;
   saveError=false;show();const r=d.result;
   if(pendingReward()&&!pendingReward().done){nextTimer=setTimeout(()=>{if(alive&&my===epoch)showReward();},outcome==='goal'?1500:500);return;}
   if(r.levelUp)status('Four goals! A quicker defender is next.');else if(r.easierNext)status('A gentler defender is next: level '+(r.nextLevel||p.live.level)+'. Try a new move.');
   // No repeated spoken tutorial or result chatter. A short sound marks the result.
   nextTimer=setTimeout(()=>{if(alive&&my===epoch)void change('live-start');},won?1800:2200);
  }catch(e){if(alive&&my===epoch){finished=false;failed(e);}}
 }
 function frame(t){
  if(!alive)return;raf=requestAnimationFrame(frame);const elapsed=Math.min(.1,(t-(last||t))/1000);last=t;
  if(s&&!paused&&!changing&&!saveError&&!s.outcome){
   acc+=elapsed;
   while(acc>=.1&&!s.outcome){
    acc-=.1;
    if(keys.size)target={x:s.player.x+((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))*100,y:s.player.y+((keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0))*100};
    const token=encodeInput(target.x,target.y);inputs+=token;advance(s,decodeInput(token));
   }
   if(s.outcome)void finish();else if(inputs.length-lastCheckpoint>=200)void checkpoint();
  }
  if(s)pitch.draw(s,{paused:paused&&explicitPause,target,ready:s.ticks===0});
 }
 function position(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*800/r.width,y:(e.clientY-r.top)*620/r.height};}
 canvas.onpointerdown=e=>{if(pointer!==null||e.button>0||!s||s.outcome||changing||saveError)return;e.preventDefault();canvas.focus({preventScroll:true});pointer=e.pointerId;const at=position(e);drag={x:at.x,y:at.y,px:s.player.x,py:s.player.y};target={x:s.player.x,y:s.player.y};canvas.setPointerCapture(e.pointerId);begin();};
 canvas.onpointermove=e=>{if(e.pointerId!==pointer||!drag)return;e.preventDefault();const at=position(e);target={x:Math.max(s.cfg.left+23,Math.min(s.cfg.right-23,drag.px+at.x-drag.x)),y:Math.max(105,Math.min(570,drag.py+at.y-drag.y))};};
 const lift=e=>{if(e.pointerId!==pointer)return;release();void checkpoint();};
 canvas.onpointerup=lift;canvas.onpointercancel=lift;canvas.onlostpointercapture=lift;
 $('#pause').onclick=()=>{if(paused){target={x:s.player.x,y:s.player.y};begin();}else{explicitPause=true;release();void checkpoint();}};
 $('#level').onchange=e=>void change('live-level',Number(e.target.value));
 $('#easier').onclick=()=>void change('live-level',p.live.level-1);$('#harder').onclick=()=>void change('live-level',p.live.level+1);
 $('#restart').onclick=()=>{event('dribble_live_abandoned',s?JSON.stringify(metrics(s)):'');void change('live-restart');};
 $('#retry-save').onclick=async()=>{if(changing||saves.busy())return;saveError=false;show();if(!reward.hidden){try{const d=await request();if(!alive)return;p=d.profile;if(!showReward())await change('live-start');}catch(e){failed(e);}return;}if(s?.outcome){finished=false;await finish();}else if(p?.live?.round){if(!s||p.live.round.done||!inputs.startsWith(p.live.round.inputs)){install();}else{lastCheckpoint=0;await checkpoint();if(!saveError)status('Saved. Drag to continue.');}}else{try{const d=await request();if(!alive)return;p=d.profile;await change('live-start');$('#hear').disabled=false;$('#sound').disabled=false;}catch(e){failed(e);}}};
 $('#hear').onclick=()=>speak(!reward.hidden&&pendingReward()?pendingReward().cue:INTRO,true);$('#sound').onclick=()=>{sound=!sound;$('#sound').textContent=sound?'♪ Sound on':'♪ Sound off';if(!sound)stopVoice();else if(!reward.hidden&&pendingReward())speak(pendingReward().cue,true);};
 const keydown=e=>{if(e.target.matches('select,input,button')||e.altKey||e.metaKey||e.ctrlKey)return;if(e.key===' '){e.preventDefault();$('#pause').click();return;}if(e.key.startsWith('Arrow')){e.preventDefault();keys.add(e.key);begin();}};
 const keyup=e=>{keys.delete(e.key);if(!keys.size&&pointer===null){release();void checkpoint();}};
 const hidden=()=>{if(document.hidden){release();stopVoice();void checkpoint();}};
 const blur=()=>{release();void checkpoint();};
 window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);
 root.querySelectorAll('button,select').forEach(b=>b.disabled=true);
 request().then(async d=>{if(!alive)return;p=d.profile;await change('live-start');if(alive){$('#hear').disabled=false;$('#sound').disabled=false;event('open_game','dribble-duel-live');}}).catch(e=>{if(alive){failed(e);$('#retry-save').disabled=false;}});
 raf=requestAnimationFrame(frame);
 const dispose=()=>{event('dribble_live_leave',s?JSON.stringify({...metrics(s),savedInputs:lastCheckpoint,inputs:inputs.length}):'');alive=false;epoch++;cancelAnimationFrame(raf);clearTimeout(nextTimer);clearTimeout(rewardTimer);stopVoice();void audioContext?.close();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);};
 dispose.busy=()=>saves.busy()||!!s&&!s.outcome&&inputs.length>lastCheckpoint;
 dispose.prepareLeave=async()=>{release();clearTimeout(nextTimer);clearTimeout(rewardTimer);await saves.run(async()=>{});clearTimeout(nextTimer);clearTimeout(rewardTimer);if(saveError)throw Error('Could not save this dribble. Retry save or use Games to leave.');await checkpoint();if(saveError)throw Error('Could not save this dribble. Retry save or use Games to leave.');};
 return dispose;
}
