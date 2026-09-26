import {elapsedMs} from './timing.mjs';
import {exclusiveReadingAction} from './reading-client.mjs';
import {readingHintState} from './reading.mjs';
import {hintLabel,useHint,wasHinted} from './hints.mjs';
import {GuidedTrace} from './guided-trace.mjs';
import {KINGDOMS,freshProfile,nextChallenge,applyAttempt,leagueRows,questRating,taskPrompt,visibleTaskPrompt,startDuel,startAdventure,recommendedDuelLevel,claimQuest,questBoard,expectedAnswer,DUEL_LEVELS,useMatchHint} from './engine.mjs';
import {navItems,mazeHome,matchLobby,questsView,matchReview,routeTab} from './hub.mjs';
import {createDialoguePicker,feedbackCategory,FIXED_LINES} from './dialogue.mjs';
import {rookAvatar} from './rook.mjs';
import {storyView} from './story-ui.mjs';
import {storyAction,storyState,storyBoard,STORY_LINES} from './story.mjs';
import {createMazeView} from './maze-view.mjs';
import {createRescueView,rescueShouldSpeak} from './rescue-view.mjs';
import {rescueAction,rescueState,rescueLine,rescueInfo} from './rescue.mjs';
import {mazeTapLine} from './maze-learning.mjs';
import {soundLine} from './phonics.mjs';
import {mazeAction,mazeState,mazeGate,mazeQuestion,mazeClue,MAZE_LINES} from './maze.mjs';
import {claimLeague,advanceLeague,claimedLeague,leagueScreen} from './league.mjs';
import {foundationState} from './foundation.mjs';
import {CoachVoice,briefLine} from './voice.mjs';
import {lessonRecap,lessonBerries,feeds,FEEDER} from './recap.mjs';
import {tellsBoStory,beatIcon} from './bo-story.mjs';
import {resting,REST_LINE,REST_COACH} from './rest.mjs';
import {createTelemetry} from './telemetry.mjs';
import {soccerAction,soccerState,SOCCER_LINES} from './soccer.mjs';
import {soccerView} from './soccer-view.mjs';
import {createSoccerAudio} from './soccer-audio.mjs';
import {readingState,readingAction,READING_LINES} from './reading.mjs';
import {readingHome,readingView,mountReadingInk} from './reading-view.mjs';
import {wordBreak,literacyFrom,DEFAULT_TRACK,WORD_BREAK_FEEDBACK} from './word-break.mjs';
const app=document.querySelector('#app');
const demo=new URLSearchParams(location.search).has('demo');
const params=new URLSearchParams(location.search);
const requestedPlayer=params.has('admin')||params.get('player')==='admin'?'admin':params.get('player');
let savedPlayer;try{savedPlayer=localStorage.getItem('letter-quest-player');}catch{}
let profile,challenge,view='map',tab=routeTab(location.hash),id=demo?'demo':['explorer','beginner','admin'].includes(requestedPlayer)?requestedPlayer:['explorer','beginner','admin'].includes(savedPlayer)?savedPlayer:'explorer';
let selectedDifficulty,reviewId,lessonOrigin='practice',storyMessage='';
if(!demo)try{localStorage.setItem('letter-quest-player',id);}catch{}
let busy=false,feedback=null,strokes=[],current=[],drawing=false,pointer=null,started=0,helped=false,showModel=false,nameAnswer='',nameUsed=[],resizeObserver;
let mute=false,mazeClient=null,mazeMessage='',mazeStarted=performance.now(),mazeTaskId='',mazeEntryId='',leagueSelection;
let resetConfirmation=false;
let spotFound=[],spotMissed=[],shownBerries=-1;
let saveError='';
let soccerMessage='',soccerAnimating=false,soccerStarted=0,soccerQuestionId='';
let readingServerOffset=0;
let today=null,todayLoading=false;
// Wind-down state comes from the server's clock (see rest.mjs).
const isResting=()=>!demo&&!!profile&&resting(profile,Date.now()+readingServerOffset);
let letterPractice=false,readingMessage='',readingStarted=0,readingId='',disposeReadingInk,readingInkQueue=Promise.resolve(),readingInkError='',readingInkDraft=[];
const isAdmin=()=>id==='admin';
function ratingBadge(){const r=questRating(profile);return `<span class="quest-rating" title="Practice level based on your letter and writing activities." aria-label="Practice level ${r.level}"><b>📖 Level ${r.level}</b></span>`;}
function duelScoreboard(){const d=profile.duel;if(!challenge.duel||!d)return '';return `<div class="duel-scoreboard"><div><span class="duel-avatar">${escape(profile.name[0])}</span><strong>${escape(profile.name)}</strong><b>${d.you}</b></div><span>${d.finished?'FINAL SCORE':`ROUND ${Math.min(5,d.round+(feedback?0:1))} / 5`}<small>${DUEL_LEVELS[(d.difficulty||2)-1].name.toUpperCase()} MATCH</small><span class="round-pips" aria-hidden="true">${Array.from({length:5},(_,i)=>`<i class="${i<d.round?'played':''}"></i>`).join('')}</span></span><div><b>${d.rook}</b><strong>Rook</strong>${rookAvatar() }</div></div>`;}
function duelResult(){const d=profile.duel;view='duel-results';document.body.classList.remove('lesson-open');resizeObserver?.disconnect();app.innerHTML=`<div class="celebration">${modeBanner()}<div class="medal">${d.outcome==='win'?'🏆':d.outcome==='draw'?'🤝':'🔤'}</div><span class="eyebrow">FIVE ROUNDS. WELL PLAYED.</span><h1>${d.outcome==='win'?'You beat Rook!':d.outcome==='draw'?'A tie! Rematch?':'Rook takes this one.'}</h1><div class="win-badges"><span>${escape(profile.name)} ${d.you} — ${d.rook} Rook</span>${d.outcome==='win'?'<span>+20 bonus XP · +5 gems</span>':d.outcome==='draw'?'<span>+5 bonus XP</span>':''}</div>${coach(escape(feedback?.line||'Five rounds. One very dramatic mustache.'),true)}${btn('Rematch Rook →','duel-start','button primary')}${btn('Review my answers',`review:${d.seed}`,'text-button')}${btn('Word games · change difficulty','tab:matches','text-button')}${questBoard(profile).quests.some(q=>q.progress===q.target&&!q.claimed)?btn('Claim quest rewards ✧','tab:quests','button secondary'):''}</div>`;bind();window.scrollTo(0,0);}
const modeBanner=()=>isAdmin()?'<div class="admin-banner" role="status"><strong>ADMIN — TEST PRACTICE</strong><span>Separate save. Explorer and Beginner’s progress is never changed by these attempts.</span></div>':'';
function adminControls(){return isAdmin()?`<section class="panel"><h2>Your test playground</h2><p>Your test progress is saved separately on the Mini and excluded from the boys’ learning reports. “Admin” is a practice profile, not a privileged login. Name-building rotates through Explorer, Beginner, Admin and Helper.</p>${resetConfirmation?`<p role="alert"><strong>Reset only Admin practice?</strong> Your test XP, lessons and skills will start over. A backup is kept; the boys’ saves stay untouched.</p>${btn('Reset only Admin practice','admin-reset-confirm','button primary',busy?'disabled':'')}${btn('Keep my test progress','admin-reset-cancel','button secondary',busy?'disabled':'')}`:btn('Start Admin practice over','admin-reset-request','button secondary')}<p>To return to a child’s real game, use the Player selector.</p></section>`:`<section class="panel"><h2>Try it yourself</h2><p>Testing as ${escape(profile.name)} changes their real learning record. Use your separate Admin practice instead.</p><a class="button secondary" href="/?player=admin">Open Admin practice — Admin</a><p>Admin practice has its own reset button. Children’s progress cannot be reset from the website.</p></section>`;}
const pickDialogue=createDialoguePicker();
const telemetry=createTelemetry(()=>({player:id,demo,challengeId:challenge?.id,task:challenge?.type,char:challenge?.char,level:challenge?.level,busy,feedback:!!feedback,drawing,strokeCount:strokes.length,helped,showModel}));
const coachVoice=new CoachVoice(notice,(kind,detail)=>telemetry.record(kind,detail));
const soccerAudio=createSoccerAudio((kind,detail)=>telemetry.record(kind,detail));
const soccerEffect=kind=>{if(!mute&&profile?.settings.sound)void soccerAudio.play(kind);};
coachVoice.player.addEventListener('playing',()=>document.body.classList.add('rook-speaking'));
for(const event of ['pause','ended','emptied','error','waiting'])coachVoice.player.addEventListener(event,()=>document.body.classList.remove('rook-speaking'));
telemetry.record('session_start',{address:location.origin,agent:navigator.userAgent,platform:navigator.platform,width:innerWidth,height:innerHeight,dpr:devicePixelRatio,touchPoints:navigator.maxTouchPoints,online:navigator.onLine});
setInterval(()=>{if(document.visibilityState==='visible')telemetry.record('heartbeat',{elapsedMs:started?elapsedMs(started):0,pending:telemetry.status().pending});},30000);
const kingdom=()=>KINGDOMS[Math.min(6,Math.floor(profile.completed/20))];
const league=()=>KINGDOMS[profile.league%7];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(label,action,cls='button',extra='')=>`<button class="${cls}" data-action="${action}" ${extra}>${action==='hint'?hintLabel(profile):label}</button>`;
const coach=(text,large=false)=>`<div class="coach ${large?'large':''} ${feedback?.duel&&!feedback.duel.rookOk?'rook-goof':feedback?.ok?'rook-proud':''}">${rookAvatar(feedback?.ok?'happy':'idle')}<div class="bubble"><span class="eyebrow">COACH ROOK</span><p>${text}</p>${view==='lesson'?btn('<span aria-hidden="true">🔊</span>','repeat','repeat-instruction','aria-label="Hear instruction again" title="Hear instruction again"'):''}</div></div>`;
// Sound rule. CONTENT (the question itself, the letter/word to find, letter names on
// taps) always plays, even with sound off, and repeats once if the child is idle. INSTRUCTIONS (how to play)
// play once per session and obey the sound setting. Narration and praise obey the sound setting.
let lastContent=null,lastTouch=Date.now();const heardInstructions=new Set();
for(const type of ['pointerdown','keydown'])document.addEventListener(type,()=>{lastTouch=Date.now();},true);
function contentKey(){if(!profile)return '';if(view==='lesson')return feedback?'':'lesson:'+challenge?.id;if(tab==='maze'&&view==='map')return mazeGate(profile)?'maze:'+mazeQuestion(profile)?.id:'';if(tab==='soccer'){const q=soccerState(profile);return q.phase==='question'?'soccer:'+q.question?.id:'';}if(tab==='reading'){const r=readingState(profile);return r.phase==='question'?'reading:'+r.question?.id:'';}return '';}
function speak(text,queued=false){if(mute||!profile||!text)return;lastContent={text:briefLine(text),key:contentKey(),at:Date.now(),repeated:false};return queued?coachVoice.enqueue(briefLine(text)):coachVoice.instruction(briefLine(text));}
// Once per browser session (survives a Refresh), per line.
function firstTime(key){try{const k='lq-said-once:'+key;if(sessionStorage.getItem(k))return false;sessionStorage.setItem(k,'1');return true;}catch{if(heardInstructions.has(key))return false;heardInstructions.add(key);return true;}}
function instruct(text,queued=false){if(mute||!profile?.settings.sound||!text||!firstTime(text))return;return queued?coachVoice.enqueue(text):coachVoice.instruction(text);}
function narrate(text,queued=false){if(mute||!profile?.settings.sound||!text)return;return queued?coachVoice.enqueue(briefLine(text)):coachVoice.instruction(briefLine(text));}
// One gentle repeat of the content prompt after ~9 s with no taps, while the same question is still open.
setInterval(()=>{const c=lastContent,now=Date.now();if(!c||c.repeated||!c.key||busy||document.hidden||document.querySelector('dialog[open]'))return;if(c.key!==contentKey()){lastContent=null;return;}if(now-c.at<9000||now-lastTouch<9000||coachVoice.mode||coachVoice.promptTimer)return;c.repeated=true;coachVoice.instruction(c.text);},1000);
function praise(ok=true){if(!mute&&profile?.settings.sound)void coachVoice.feedback(ok);}
function readingPrompt(q,manual=false){if(!q)return;if(manual){coachVoice.stop();void coachVoice.enqueue(q.prompt);if(q.listenLine)void coachVoice.enqueue(q.listenLine);return;}if(mute)return;
 // Decode/act/story never speak the printed answer; their prompt is a how-to instruction.
 if(['decode','act','story'].includes(q.type))instruct(q.prompt);else speak(q.listenLine||q.prompt);}
document.addEventListener('visibilitychange',()=>{if(document.hidden)coachVoice.stop();});
let audio;
function chime(){if(mute||!profile.settings.sound)return;try{audio??=new AudioContext();audio.resume();[523,659,784].forEach((f,i)=>{const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=f;g.gain.setValueAtTime(.055,audio.currentTime+i*.09);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+i*.09+.3);o.start(audio.currentTime+i*.09);o.stop(audio.currentTime+i*.09+.3);});}catch{}}
async function request(action='state',payload){
 if(demo){if(action==='state'){profile??=freshProfile('demo');}if(action==='attempt'){const result=applyAttempt(profile,challenge,payload);return {profile,challenge:nextChallenge(profile),result};}if(action==='settings')Object.assign(profile.settings,payload);if(action==='chest'&&profile.chests){profile.chests--;profile.gems+=25;}if(action==='promote'){const result=claimLeague(profile);if(!result)throw Error('Crown already collected');return {profile,challenge:nextChallenge(profile),result};}if(action==='advance'){const result=advanceLeague(profile);if(!result)throw Error('Claim your crown first');return {profile,challenge:nextChallenge(profile),result};}return {profile,challenge:nextChallenge(profile),result:{gems:25}};}
 let res;
 try{res=await fetch(`/api/${id}/${action}`,{method:payload?'POST':'GET',headers:{'Content-Type':'application/json','X-Letter-Quest-Session':telemetry.session},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(15000)});const data=await res.json();if(!res.ok)throw Object.assign(Error(data.error||'Connection interrupted'),{status:res.status});return data;}
 catch(e){telemetry.record('api_error',{action,status:res?.status||0,requestId:res?.headers.get('x-request-id')||'',message:e.message,online:navigator.onLine});throw e;}
}
function accept(data){profile=data.profile;challenge=data.challenge;if(Number.isFinite(data.serverNow))readingServerOffset=data.serverNow-Date.now();}
async function readingRequest(payload){
 try{return await request('reading',payload);}catch(error){
  if(error.status===409){
   // Never replay an answer automatically: another tab may already have scored it.
   const fresh=await request();
   const same=payload.questionId===fresh.profile.reading?.question?.id;
   if(same){
    accept(fresh);
    if(fresh.profile.reading?.question?.type==='write')readingInkError='Writing kept here. Tap Save to try again.';
    error.message='Progress refreshed. Your writing is kept here. Try again.';
   }else error.message='This activity changed on another screen. Keep this page open to preserve your unsaved writing.';
  }
  throw error;
 }
}

function frame(content){return `<div class="shell"><aside class="sidebar"><a class="brand" href="/${demo?'?demo':'?player='+id}"><span class="brand-icon"><img src="/icons/app-192-v2.png" alt="" width="42" height="42" style="border-radius:12px;vertical-align:middle"></span><span>letter<span class="brand-light">quest</span><small>WORDS OPEN WORLDS</small></span></a><nav aria-label="Main navigation">${navItems(tab,profile,{grouped:params.get('family')==='1'})}</nav><div class="sidebar-bottom"><img src="/rook.svg" alt=""><p>Your next rival<br>has a mustache.</p>${btn('⚙ Grown-ups','tab:parents','text-button parent-nav')}</div></aside><div class="workspace"><header class="topbar"><div class="player"><span class="avatar">${escape(profile.name[0])}</span><label class="sr-only" for="player">Player</label><select id="player" ${demo||busy?'disabled':''}><option value="explorer" ${id==='explorer'?'selected':''}>Explorer</option><option value="beginner" ${id==='beginner'?'selected':''}>Beginner</option><option value="admin" ${isAdmin()?'selected':''}>Admin · Admin</option>${demo?'<option selected>Explorer · demo</option>':''}</select></div><div class="stats">${ratingBadge()}<span title="Experience points">⚡ <b>${profile.xp}</b><small>XP</small></span><span title="Gems">◆ <b>${profile.gems}</b></span><span title="Crowns">👑 <b>${profile.crowns}</b></span>${btn(profile.settings.sound?'♪':'♩','sound','sound-button',`aria-label="${profile.settings.sound?'Mute sound':'Enable sound'}"`)}${btn('⚙','tab:parents','text-button parent-top','aria-label="Grown-ups"')}</div></header><main>${modeBanner()}${demo?'<div class="demo-banner">Practice preview · nothing is saved to the boys’ profiles</div>':''}${content}</main><footer>One word. A whole new world.</footer></div></div>`;}
function render(){
 if(tab!=='rescue'&&rescueClient){rescueClient.dispose();rescueClient=null;}
 disposeReadingInk?.();disposeReadingInk=null;
 if(tab==='rescue'&&view==='map'){
  if(mazeClient){mazeClient.dispose();mazeClient=null;}
  resizeObserver?.disconnect();document.body.classList.remove('lesson-open');document.body.classList.add('maze-open');
  document.title='Letter Quest — Rook’s Rescue Team';
  if(!rescueClient)rescueClient=createRescueView(app,rescueAct,message=>telemetry.record('runtime_error',{source:'rescue-renderer',message}));
  rescueClient.update(profile,rescueMessage,busy);mountRefresh();return;
 }
 if(tab==='reading'&&view==='map'){
  if(mazeClient){mazeClient.dispose();mazeClient=null;}resizeObserver?.disconnect();document.body.classList.remove('maze-open','lesson-open');
  document.title='Letter Quest — '+profile.name+'’s Reading Missions';
  const s=readingState(profile);if(s.question&&readingId!==profile.id+s.question.id){readingId=profile.id+s.question.id;readingStarted=performance.now();readingInkDraft=s.ink;readingInkError='';}
  const visibleProfile=readingInkError&&s.question?.type==='write'?{...profile,reading:{...s,ink:readingInkDraft}}:profile;
  app.innerHTML=readingView(visibleProfile,{busy,message:readingMessage,now:Date.now()+readingServerOffset});bind();
  const canvas=app.querySelector('#reading-ink');if(canvas){disposeReadingInk=mountReadingInk(canvas,readingInkError?readingInkDraft:s.ink,ink=>{
   if(busy||s.phase!=='question')return;readingInkDraft=ink;app.querySelector('[data-action="reading-check"]').disabled=false;app.querySelector('[data-action="reading-ink-undo"]').disabled=false;
   const questionId=s.question.id;readingInkQueue=readingInkQueue.then(async()=>{try{const payload={kind:'ink',questionId,ink,revision:profile.revision};accept(demo?{profile,result:readingAction(profile,payload),challenge:nextChallenge(profile)}:await readingRequest(payload));readingInkError='';}catch(e){readingInkError=e.message;notice('Writing not saved yet. Keep this page open and try Save again.');}});
  },(kind,detail)=>telemetry.record(kind,detail));if(busy||s.phase!=='question'){canvas.onpointerdown=canvas.onpointermove=canvas.onpointerup=null;}}
  return;
 }
 if(tab==='soccer'&&view==='map'){
  if(mazeClient){mazeClient.dispose();mazeClient=null;}resizeObserver?.disconnect();document.body.classList.remove('maze-open','lesson-open');
  document.title='Letter Quest — '+profile.name+' FC';
  const q=soccerState(profile).question;if(q&&soccerQuestionId!==profile.id+q.id){soccerQuestionId=profile.id+q.id;soccerStarted=performance.now();}
  app.innerHTML=soccerView(profile,{busy,animate:soccerAnimating,message:soccerMessage});bind();return;
 }
 if(tab==='maze'&&view==='map'){
  document.body.classList.add('maze-open');document.title='Letter Quest — '+profile.name+'’s labyrinth';
  if(!mazeClient)mazeClient=createMazeView(app,mazeAct,message=>telemetry.record('runtime_error',{source:'maze-renderer',message}));
  if(mazeGate(profile)){const q=mazeQuestion(profile);if(profile.id+q.id!==mazeTaskId){mazeTaskId=profile.id+q.id;mazeStarted=performance.now();}}
  mazeClient.update(profile,mazeMessage,busy);
  mountRefresh();
  if(!profile.maze&&!busy&&mazeEntryId!==profile.id){mazeEntryId=profile.id;void mazeAct({kind:'enter'});}
  return;
 }
 if(mazeClient){mazeClient.dispose();mazeClient=null;}document.body.classList.remove('maze-open');
 document.title=demo?'Letter Quest — Demo':isAdmin()?'Letter Quest — Admin · Admin':'Letter Quest — '+profile.name;resizeObserver?.disconnect();document.body.classList.toggle('lesson-open',view==='lesson');if(view==='lesson'){renderLesson();return;}const content=view==='review'?matchReview(profile,reviewId):tab==='adventure'?storyView(profile,storyMessage,busy):tab==='practice'?mapView():tab==='matches'?matchLobby(profile,selectedDifficulty):tab==='quests'?questsView(profile):tab==='league'?leagueScreen(profile,leagueSelection):tab==='treasure'?treasureView():parentView();app.innerHTML=frame(content);bind();if(tab==='practice')requestAnimationFrame(()=>{const world=app.querySelector('.path-world'),current=app.querySelector('.level.current');if(world&&current)world.scrollTop=Math.max(0,current.parentElement.offsetTop-world.clientHeight/2+current.clientHeight/2);});}
function goTab(value,push=true){today=null;if(feedback?.next)challenge=feedback.next;tab=routeTab('#'+value);view='map';feedback=null;coachVoice.stop();soccerAudio.stop();soccerAnimating=false;if(push&&location.hash!=='#'+tab)history.pushState(null,'','#'+tab);render();window.scrollTo(0,0);}
window.addEventListener('popstate',()=>{if(profile)goTab(routeTab(location.hash),false);});
function mapView(){
 return (params.get('family')==='1'?'':mazeHome(profile))+learningPathView();
}
function learningPathView(){
 if(!letterPractice&&profile.id!=='beginner')return (profile.id==='explorer'?`<section class="panel"><div class="eyebrow">START HERE · BIG LETTERS</div><h2>Small words. Big discoveries.</h2><p>CAT · HAT · MAT. Three-letter words, one word family at a time.</p>${btn('Play with three-letter words →','start','button primary')}<p class="quiet">Word family ${foundationState(profile).stage} of 4. Six answers without help unlock the next family. More activities stay below.</p></section>`:'')+readingHome(profile);
 const k=kingdom(),position=profile.completed%20,worldNumber=Math.min(7,Math.floor(profile.completed/20)+1);
 return `<div class="page-heading"><div><div class="eyebrow">LEARN · KINGDOM ${worldNumber}</div><h1>Your learning path</h1>${btn('Try Reading Missions →','reading-home','button secondary')}<p>Short lessons to practice. Word games to play. Story to explore.</p></div><span class="tiny-tag">${profile.completed} lessons completed</span></div>
 <div class="adventure-grid"><section class="path-card"><div class="kingdom-banner"><span class="kingdom-icon">${k.icon}</span><div><span class="eyebrow">KINGDOM ${worldNumber} OF 7 · ${position}/20</span><h2>${k.name}</h2><p>${k.intro}</p></div></div><div class="path-world"><div class="scenery scenery-a">✦<br><span>🧩</span></div><div class="scenery scenery-b">♧<br>✧</div><div class="trail"></div>${Array.from({length:20},(_,i)=>{const done=i<position,current=i===position;return `<div class="path-stop" style="--offset:${[0,55,78,55,0,-55,-78,-55][i%8]}px"><button class="level ${done?'done':current?'current':'locked'}" data-action="${current?'start':'locked'}" ${!current?'disabled':''} aria-label="${done?'Completed':current?'Start':'Locked'} lesson ${i+1}">${done?'✓':current?'★':i%3===2?'▣':'📖'}</button>${current?'<span class="start-label">PLAY</span>':''}<span class="level-number">${i+1}</span></div>`;}).join('')}<div class="kingdom-finish">${btn('👑 Challenge Rook','tab:matches','button secondary')}<p>${profile.completed>=140?'Reading adventures continue':'Next kingdom after 20 lessons'}</p></div></div></section>
 <aside class="right-rail"><section class="adventure-match-link"><span>🔤</span><div><strong>Rook is ready.</strong><p>Five rounds. You versus the mustache.</p>${btn('To Word games →','tab:matches','text-button')}</div></section><section class="mini-card today"><div class="eyebrow">YOUR NEXT LESSON</div><h3>Five little challenges.</h3><p>Letters, words, and writing.<br>Your progress, your pace.</p><div class="quest-dots">${Array.from({length:5},(_,i)=>`<span class="${i<profile.inLesson?'filled':''}">${i<profile.inLesson?'✓':'·'}</span>`).join('')}</div>${btn('Continue lesson <span>→</span>','start','button primary wide')}<small>No timer. Hints whenever you need them.</small></section>${coach('I tried to alphabetize my snacks.<br>Then I ate the evidence.',true)}<section class="mini-card league-preview"><span class="gem-large" style="color:${league().color}">◆</span><div><span class="eyebrow">${league().gem.toUpperCase()} LEADERBOARD</span><h3>Your next crown.</h3><p>${leagueRows(profile)[0].you?'First place! Claim your crown.':Math.max(0,leagueRows(profile)[0].xp-(profile.xp-profile.leagueBase)+1)+' XP to take the lead'}</p></div>${btn('View leaderboard →','tab:league','text-button')}</section></aside></div>`;
}

function treasureView(){return `<div class="page-heading"><div><div class="eyebrow">THE GOOD STUFF YOU EARNED</div><h1>Your treasure room.</h1><p>Every chest is a little “look what I did.”</p></div></div><section class="treasure-panel"><div class="big-chest">▣<span>✧</span></div><h2>${profile.chests?'A treasure is waiting!':'Your next chest is on its way.'}</h2><p>${profile.chests?`${profile.chests} earned chest${profile.chests>1?'s':''} to open · 25 gems inside each one`:`${3-profile.completed%3} more lesson${3-profile.completed%3>1?'s':''} to your next chest`}</p>${btn(profile.chests?'Open my chest ✧':'Go on a quest →',profile.chests?'chest':'start','button primary')}<div class="treasure-stats"><div><b>◆ ${profile.gems}</b><span>Gems collected</span></div><div><b>👑 ${profile.crowns}</b><span>Leaderboard crowns</span></div><div><b>★ ${profile.completed}</b><span>Lessons explored</span></div></div></section><div class="collection"><h3>Your kingdom collection</h3><div class="kingdom-collection">${KINGDOMS.map((k,i)=>`<div class="collectible ${profile.completed>=(i+1)*20?'earned':''}"><span>${k.icon}</span><small>${k.name}</small><span>${profile.completed>=(i+1)*20?'✓':'20 lessons'}</span></div>`).join('')}</div></div>`;}
// Today at a glance for the grown-ups (read-only summary from the server).
function todayPanel(){
 if(demo)return '';
 const rest=isResting()?`<p class="today-rest">Resting after a long stretch of play (about 20 minutes). New lessons and labyrinth levels come back within the hour. ${btn('Let them keep playing','rest-clear','button secondary')}</p>`:'';
 if(!today||today.player!==profile.id){
  if(!todayLoading){todayLoading=true;fetch(`/api/${id}/summary`,{headers:{'X-Letter-Quest-Session':telemetry.session}}).then(r=>r.ok?r.json():Promise.reject()).then(d=>{today=d;}).catch(()=>{today={player:profile.id,error:true};}).finally(()=>{todayLoading=false;if(tab==='parents'&&view==='map')render();});}
  return `<section class="panel today"><h2>Today</h2><p>Loading…</p>${rest}</section>`;
 }
 const s=today;if(s.error)return `<section class="panel today"><h2>Today</h2><p>Today’s summary is not available right now.</p>${rest}</section>`;
 if(!s.played)return `<section class="panel today"><h2>Today</h2><p>No play yet today.</p>${rest}</section>`;
 const l=s.lessons,m=s.labyrinth,o=s.other;
 const parts=[l.attempts&&`Lessons: ${l.finished} finished, ${l.correct}/${l.attempts} answers right, ${l.independent} on their own`,m.gatesAnswered&&`Labyrinth: ${m.levelsFinished} levels, ${m.gatesCorrect} of ${m.gatesAnswered} gate answers right (now level ${m.level})`,o.rescueMissions&&`${o.rescueMissions} rescue missions`,o.storyChapters&&`${o.storyChapters} story chapters`,o.readingActions&&'Reading Missions',o.soccerActions&&'Word soccer'].filter(Boolean);
 return `<section class="panel today"><h2>Today</h2><p><strong>About ${s.minutes} min</strong> (${s.stretches.map(x=>`${x.start}–${x.end}`).join(', ')})</p><ul>${parts.map(x=>`<li>${escape(x)}</li>`).join('')}</ul>${s.stuck.length?`<p><strong>Worth a look</strong></p><ul>${s.stuck.map(x=>`<li>${escape(x)}</li>`).join('')}</ul>`:''}${s.story.length?`<p><strong>Story so far today</strong></p><ul>${s.story.map(x=>`<li>${escape(x)}</li>`).join('')}</ul>`:''}${rest}</section>`;
}
function parentView(){const skills=Object.entries(profile.skills).sort(([a],[b])=>a.localeCompare(b));const recent=profile.history.slice(-20),accuracy=recent.length?Math.round(recent.filter(h=>h.ok).length/recent.length*100):null;return `<div class="page-heading"><div><div class="eyebrow">A WINDOW INTO THE LITTLE WINS</div><h1>Grown-ups’ corner.</h1><p>Celebrate progress. Notice what needs another gentle go.</p></div></div><div class="parent-metrics"><div><b>${profile.completed}</b><span>Finished lessons</span></div><div><b>${accuracy===null?'—':accuracy+'%'}</b><span>Last 20 attempts · includes help</span></div><div><b>${skills.filter(([,s])=>s.level>=3).length}</b><span>Skills practicing from memory</span></div></div>${todayPanel()}${demo?'':adminControls()}<section class="panel"><h2>Practice settings</h2>${btn("Hear Rook’s new voice ♪","preview-voice","button secondary")}<label class="setting"><span><strong>Left-handed layout</strong><small>Places controls on the right. Writing direction stays left to right.</small></span><input id="left-handed" type="checkbox" ${profile.settings.leftHanded?'checked':''}></label><label class="setting"><span><strong>Music, sound effects and celebration lines</strong><small>Browser narration. Spoken instructions for each exercise always play. Tap the speaker to repeat a prompt.</small></span><input id="sound-setting" type="checkbox" ${profile.settings.sound?'checked':''}></label><p>Five correct answers finish a lesson. Guidance fades after independent successes and returns after difficulty. Quick, accurate recognition can advance immediately; handwriting has no speed target. Recognition and tracing adapt separately for each character.</p><p>Start with matching and letter names, then trace, copy, and recall. This version does not yet teach a full phonics/reading curriculum or evaluate free-form handwriting. A tracing score measures similarity to the displayed path.</p><p>Try 5–10 minutes together, then one letter on paper. Ask a teacher to review stroke models and pencil practice. There are no lost hearts or streak penalties.</p>${btn('Download practice record ↓','export','button secondary')}</section><section class="panel"><h2>Skill notebook</h2><div class="table-wrap"><table><thead><tr><th>Skill</th><th>Guidance</th><th>Successful / tried</th></tr></thead><tbody>${skills.map(([key,s])=>`<tr><td>${escape(key.replace('find:','Recognize ').replace('trace:','Write '))}</td><td>${['Full model','Guided practice','Copy the model','Memory practice'][s.level]}</td><td>${s.hits} / ${s.seen}</td></tr>`).join('')||'<tr><td colspan="3">The notebook starts with the first quest.</td></tr>'}</tbody></table></div><p class="quiet">This is a practice record, not a school grade or diagnostic assessment. Assisted successes count here; the downloaded record identifies help separately.</p></section><section class="panel"><h2>At home, together</h2><p><strong>Local practice diagnostics are on.</strong> Attempts, drawing paths, hints, retries, difficulty changes and technical errors are saved on the server so we can review problems. No microphone, camera, passwords or activity outside this game is recorded. Logs are not available through this website.</p><p>Each preset has its own start link: <a href="/?player=explorer">Explorer’s game</a> · <a href="/?player=beginner">Beginner’s game</a>. Progress and difficulty are independent.</p><p>Progress is stored on your server and shared by the selected player across devices. Everyone on your home network who can open this address can select a player and see this notebook. This page is not password protected. No accounts, ads, chat, or public leaderboard.</p><p>Coach Rook is an original character. Narration uses your browser’s speech service. Availability, accent and offline support depend on the device. No third-party character recordings are included.</p></section>`;}
function prompt(){return taskPrompt(challenge,showModel);}
function start(){if(feedback?.next)challenge=feedback.next;view='lesson';feedback=null;newExercise();}
let rail;
function newExercise(){rail=challenge.guided?new GuidedTrace(challenge.paths):null;strokes=[];current=[];drawing=false;pointer=null;helped=!!challenge.guided||wasHinted(profile,`lesson:${challenge.id}`)||!!challenge.retry||!!challenge.duel&&profile.duel?.hintedRound===profile.duel?.round;showModel=helped;nameAnswer='';nameUsed=[];spotFound=[];spotMissed=[];saveError='';started=performance.now();render();window.scrollTo(0,0);telemetry.record('challenge_shown',{retry:!!challenge.retry,guided:!!challenge.guided});speak(prompt());}
function resetTrace(withHint=false){
 if(feedback?.ok)return;
 telemetry.record('trace_reset',{reason:withHint?'hint':'try_again'});
 const retry=!!feedback;
 if(retry){challenge=feedback.next;feedback=null;}
 rail=challenge.guided?new GuidedTrace(challenge.paths):null;
 strokes=[];current=[];drawing=false;pointer=null;started=performance.now();
 helped=helped||withHint||!!challenge.retry;
 showModel=showModel||withHint||!!challenge.retry;
 coachVoice.stop();render();if(retry)telemetry.record('challenge_shown',{retry:true});if(retry||withHint)speak(prompt());
}
function lessonBoard(){
 if(challenge.guided)return `<div class="writing ${profile.settings.leftHanded?'left-handed':''}"><div class="writing-surface"><div class="writing-caption"><span>✦ DRAG THE GOLD BUTTON</span><span>${strokes.length} / ${challenge.paths.length} strokes</span></div><canvas id="writing-canvas" tabindex="0" role="slider" aria-label="Guided letter ${challenge.char}. Drag the gold button along the track. Arrow keys also move it." aria-valuemin="0" aria-valuemax="${challenge.paths.length}" aria-valuenow="${strokes.length}"></canvas><div class="direction-strip">Follow the track. The line stays inside.</div></div><div class="writing-tools">${btn('↻<span>Start over</span>','clear','tool-button',busy||feedback?'disabled':'')}${btn('✓<span>Finish</span>','check','tool-button check-tool',busy||feedback||!rail?.done?'disabled':'')}<div class="stroke-legend">${rail?.done?'Letter complete!':'Drag the gold button.<br>Lift your finger anytime.'}</div></div></div>`;
 if(challenge.type==='gap'||challenge.type==='sequence'){
  const letters=challenge.type==='gap'?[...challenge.word]:challenge.letters;
  return `<div class="recognition">${challenge.foundation?`<p>BIG LETTERS · Three-letter words · Family ${challenge.stage} / 4</p>`:''}${challenge.picture?`<div class="word-picture" aria-hidden="true">${challenge.picture}</div>`:''}<div class="letter-sequence">${letters.map((c,i)=>`<span>${i===challenge.blank&&!showModel?'?':c}</span>`).join('')}</div><div class="letter-options">${challenge.options.map(c=>btn(c,`answer:${c}`,'letter-option',`aria-label="Letter ${c}" ${busy||feedback?'disabled':''}`)).join('')}</div>${!showModel?btn('Show me','hint','text-button',feedback?'disabled':''):''}</div>`;
 }
 if(challenge.type==='find'&&challenge.spot)return `<div class="recognition spot-game">${challenge.level===0||showModel?`<div class="letter-model">${escape(challenge.char)}</div>`:'<div class="ear-icon">♪</div>'}<p class="spot-count" aria-live="polite">Found ${spotFound.length} of ${challenge.grid.filter(c=>c===challenge.char).length}</p><div class="spot-grid">${challenge.grid.map((c,i)=>btn(escape(c),`spot:${i}`,'letter-option spot-tile'+(spotFound.includes(i)?' spot-found':'')+(spotMissed.includes(i)?' spot-miss':''),`aria-label="Letter tile ${i+1}: ${escape(c)}" ${busy||feedback||spotFound.includes(i)?'disabled':''}`)).join('')}</div>${challenge.level>0&&!showModel?btn('Show me','hint','text-button',feedback?'disabled':''):''}</div>`;
 if(challenge.type==='find')return `<div class="recognition" style="font-family:${challenge.font||'inherit'}">${challenge.level===0||showModel?`<div class="letter-model">${challenge.char}</div><p>Find its match.</p>`:challenge.upperCue?`<div class="letter-model">${challenge.upperCue}</div><p>Find its little partner.</p>`:'<div class="ear-icon">♪</div><p>Listen. Which letter is it?</p>'}<div class="letter-options">${challenge.options.map(c=>btn(c,`answer:${c}`,'letter-option',`aria-label="Letter ${c}" ${busy||feedback?'disabled':''}`)).join('')}</div>${challenge.level>0&&!showModel?btn('Show me','hint','text-button',feedback?'disabled':''):''}</div>`;
 if(challenge.type==='name'||challenge.type==='spell')return `<div class="name-game">${challenge.picture?`<div class="word-picture" aria-hidden="true">${challenge.picture}</div>`:''}${!challenge.memory||showModel?`<p class="name-model">${challenge.word}</p>`:'<p class="name-model listening-label">🔊 Listen and build</p>'}<div class="name-slots" aria-label="Your letters so far">${[...challenge.word].map((_,i)=>`<span class="${i===nameAnswer.length?'next':''}">${escape(nameAnswer[i]||'')}</span>`).join('')}</div><div class="direction-strip"><span>START HERE</span> → → →</div><div class="name-tiles ${challenge.reusable?'alphabet-keyboard':''}">${challenge.options.map((c,i)=>btn(c,`name:${i}`,'letter-option',`${busy||!challenge.reusable&&nameUsed.includes(i)||!!feedback||nameAnswer.length>=challenge.word.length?'disabled':''} aria-label="Name tile ${i+1}: ${c}"`)).join('')}</div><div class="name-tools">${btn('⌫ Undo a letter','name-undo','text-button',!nameAnswer||busy||feedback?'disabled':'')}${challenge.memory&&!showModel?btn('Show me','hint','text-button',busy||feedback?'disabled':''):''}${btn('Check my word ✓','name-check','button primary',nameAnswer.length!==challenge.word.length||busy||feedback?'disabled':'')}</div></div>`;
 return `<div class="writing ${profile.settings.leftHanded?'left-handed':''}"><div class="writing-surface"><div class="writing-caption"><span>✦ START AT THE DOT</span><span>${strokes.length} / ${challenge.paths.length} strokes</span></div><canvas id="writing-canvas" aria-label="Writing pad for ${challenge.char}. Touch or drag to draw each stroke." role="img"></canvas><div class="direction-strip"><span>LEFT</span> → → → <span>RIGHT</span></div></div><div class="writing-tools">${btn('↻<span>Try again</span>','clear','tool-button',`${busy||feedback?.ok?'disabled':''}`)}${btn('✧<span>Show me</span>','hint','tool-button',`${busy||feedback?.ok?'disabled':''}`)}${btn('✓<span>Check it</span>','check','tool-button check-tool',`${busy||!!feedback?'disabled':''}`)}<div class="stroke-legend">${challenge.level>=3&&!showModel?'Your turn.<br>From memory.':challenge.level>=2&&!showModel?'Look up.<br>Copy below.':'Gold dot.<br>Follow the arrow.'}</div></div></div>`;
}
// Bo the bear: one berry per correct answer (three for a letter grid). The
// count only grows during a lesson; nothing is ever taken away.
function feederBadge(){
 if(!feeds(profile.id)||challenge.duel)return '';
 const n=feedback?.lesson?lessonRecap(profile).treats:lessonBerries(profile,feedback?0:spotFound.length),grew=shownBerries>=0&&n>shownBerries;shownBerries=n;
 return `<span class="feeder ${grew?'feeder-munch':''}" aria-label="${FEEDER.name} the bear has ${n} ${n===1?'berry':'berries'}"><span aria-hidden="true">${FEEDER.icon}</span><b>${FEEDER.treat} ${n}</b></span>`;
}
function renderLesson(){
 const answer=expectedAnswer(challenge),duel=feedback?.duel;
 const title={spell:'Hear it. Build it.',gap:'Find the missing letter.',sequence:'Complete the alphabet trail.',find:'Listen. Make your move.',name:'Build a family name.',trace:challenge.level>=3&&!showModel?'Write it from memory.':challenge.level>=2&&!showModel?'Copy the letter.':'Follow the letter trail.'}[challenge.type];
 const detail=feedback?`<div><strong>${feedback.ok?'You got it!':duel?'A tricky move. Here’s the answer.':'Let’s try together.'}</strong><p>${feedback.ok?`+${feedback.xp} XP${feedback.lesson?' · Lesson complete!':''}`:challenge.type==='trace'?'Start at the dot. Follow the guide.':`Answer: ${escape(answer)}${challenge.word&&challenge.type==='gap'?' in '+escape(challenge.word):''}`}</p>${duel?`<div class="duel-round-result"><span>You <b>${duel.pointReason==='independent'?'+1':'0'}</b></span><span>Rook <b>${duel.rookOk?duel.alreadyAwarded?'point already counted':'+1':'0'}</b> · ${duel.pointReason==='hint'?'help requested':duel.pointReason==='incorrect'?'answer needed help':'you solved it'}</span></div>`:''}</div>`:challenge.duel?`<p>${helped?'Rook’s point is already counted. Let’s finish together.':'One point per round: correct without help → you. Show me or a wrong answer → Rook.'}</p>`:'<p>Take your time. Hints are here if you need them.</p>';
 app.innerHTML=`<div class="lesson-shell ${challenge.duel?'match-lesson':''}">${modeBanner()}<header class="lesson-header">${ratingBadge()}${btn('×','exit','close-button',`aria-label="${challenge.duel?'Pause match':'Leave lesson'}"`)}<div class="lesson-progress" aria-label="${profile.inLesson} of 5 activities complete"><span style="width:${profile.inLesson*20}%"></span></div><span class="lesson-counter">📖 ${profile.inLesson}/5</span>${feederBadge()}${btn('♪','repeat','sound-button','aria-label="Repeat instruction"')}</header>${duelScoreboard()}<div class="lesson-title"><h1>${title}</h1></div>${coach(escape(feedback?.line||visibleTaskPrompt(challenge,showModel)))}<section class="exercise ${feedback?'answered':''}">${lessonBoard()}</section><div class="feedback ${feedback?feedback.ok?'success':'retry':''}" aria-live="polite">${detail}${feedback?btn(duel?(duel.finished?'See result →':'Next round →'):!feedback.ok?'Try again →':feedback.lesson?'Collect my win →':'Next activity →','next','button primary'):''}</div>${!challenge.duel&&!feedback?.ok?btn('Try a different challenge →','skip','text-button',busy?'disabled':''):''}<p id="save-error" class="error" role="alert">${escape(saveError)}</p></div>`;
 bind();if(challenge.type==='trace')setupCanvas();
 if(feedback)app.querySelectorAll('.letter-options [data-action]').forEach(el=>{const chosen=el.dataset.action.slice(7);el.classList.toggle('correct-choice',chosen===answer);el.classList.toggle('wrong-choice',chosen===feedback.submittedAnswer&&!feedback.ok);});
}
function setupCanvas(){resizeObserver?.disconnect();const canvas=document.querySelector('#writing-canvas');const ctx=canvas.getContext('2d');const renderCanvas=()=>{const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;ctx.scale(dpr,dpr);paint(canvas,ctx);};resizeObserver=new ResizeObserver(renderCanvas);resizeObserver.observe(canvas);
 const point=e=>{const rect=canvas.getBoundingClientRect(),geo=geometry(rect.width,rect.height);return [(e.clientX-rect.left-geo.x)/geo.size*100,(e.clientY-rect.top-geo.y)/geo.size*100];};
 if(challenge.guided){
  rail??=new GuidedTrace(challenge.paths);
  const sync=()=>{strokes=rail.completed;current=rail.ink;paint(canvas,ctx);};
  const finish=()=>{rail.release();drawing=false;pointer=null;sync();renderLesson();if(rail.done&&!busy&&!feedback)void submit();};
  canvas.onpointerdown=e=>{if(busy||feedback||rail.done)return;e.preventDefault();if(!rail.begin(point(e)))return;pointer=e.pointerId;drawing=true;canvas.setPointerCapture(pointer);telemetry.record('guided_trace_start',{stroke:rail.stroke,pointerType:e.pointerType});sync();};
  canvas.onpointermove=e=>{if(!drawing||e.pointerId!==pointer)return;e.preventDefault();rail.move(point(e));sync();};
  canvas.onpointerup=e=>{if(e.pointerId!==pointer)return;rail.move(point(e));telemetry.record('guided_trace_progress',{completed:rail.stroke,cursor:rail.cursor,done:rail.done});finish();};
  canvas.onpointercancel=e=>{if(e.pointerId!==pointer)return;telemetry.record('guided_trace_pause',{completed:rail.stroke,cursor:rail.cursor});rail.release();drawing=false;pointer=null;sync();};
  canvas.onkeydown=e=>{if(busy||feedback||rail.done||!['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(e.key))return;e.preventDefault();rail.advance();sync();if(rail.done)finish();else{canvas.setAttribute('aria-valuenow',String(rail.stroke));}};
  sync();return;
 }
 canvas.onpointerdown=e=>{const reason=busy?'busy':feedback?'feedback':drawing?'already_drawing':strokes.length>=challenge.paths.length?'all_strokes_drawn':e.pointerType==='touch'&&e.width>40?'palm_rejected':null;if(reason){telemetry.record('trace_blocked',{reason,pointerType:e.pointerType});return;}e.preventDefault();const p=point(e);if(p.some(v=>v<0||v>100)){telemetry.record('trace_blocked',{reason:'outside_writing_box',pointerType:e.pointerType});return;}pointer=e.pointerId;drawing=true;current=[p];telemetry.record('trace_start',{pointerType:e.pointerType,width:canvas.clientWidth,height:canvas.clientHeight});canvas.setPointerCapture(e.pointerId);};
 canvas.onpointermove=e=>{if(!drawing||e.pointerId!==pointer)return;e.preventDefault();const p=point(e).map(v=>Math.max(0,Math.min(100,v)));if(current.length<700&&Math.hypot(p[0]-current.at(-1)[0],p[1]-current.at(-1)[1])>.5)current.push(p);paint(canvas,ctx);};
 canvas.onpointerup=e=>{if(!drawing||e.pointerId!==pointer)return;drawing=false;pointer=null;const p=point(e).map(v=>Math.max(0,Math.min(100,v)));current.push(p);telemetry.record('trace_stroke',{stroke:current.map(p=>p.map(n=>Math.round(n*100)/100)),points:current.length,pointerType:e.pointerType});strokes.push(current);current=[];renderLesson();};
 canvas.onpointercancel=()=>{telemetry.record('trace_cancel',{stroke:current.map(p=>p.map(n=>Math.round(n*100)/100)),points:current.length});drawing=false;pointer=null;current=[];paint(canvas,ctx);};
}
function geometry(w,h){const size=Math.min(w-28,h-30);return {size,x:(w-size)/2,y:(h-size)/2};}
function paint(canvas,ctx){const w=canvas.clientWidth,h=canvas.clientHeight,{size,x,y}=geometry(w,h);ctx.clearRect(0,0,w,h);ctx.save();ctx.translate(x,y);ctx.scale(size/100,size/100);ctx.lineCap='round';ctx.lineJoin='round';
 [15,50,85].forEach((yy,i)=>{ctx.beginPath();ctx.setLineDash(i===1?[2,2]:[]);ctx.strokeStyle='#dfdfcf';ctx.lineWidth=.45;ctx.moveTo(0,yy);ctx.lineTo(100,yy);ctx.stroke();});ctx.setLineDash([]);
 const draw=(p,color,width)=>{ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.moveTo(...p[0]);p.slice(1).forEach(q=>ctx.lineTo(...q));ctx.stroke();};
 const guided=challenge.level<2||showModel;
 if(guided){challenge.paths.forEach((p,i)=>draw(p,i===strokes.length?'#dbe6dc':'#e9ece3',7));const p=challenge.paths[strokes.length];if(p){const a=p[0],b=p[1];ctx.fillStyle='#e6a642';ctx.beginPath();ctx.arc(...a,3.1,0,Math.PI*2);ctx.fill();ctx.font='bold 3px sans-serif';ctx.textAlign='center';ctx.fillStyle='#624518';ctx.fillText(String(strokes.length+1),a[0],a[1]+1);const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len>5){const dx=(b[0]-a[0])/len,dy=(b[1]-a[1])/len;draw([[a[0]+dx*5,a[1]+dy*5],[a[0]+dx*13,a[1]+dy*13]],'#b89b50',.8);draw([[a[0]+dx*10-dy*2,a[1]+dy*10+dx*2],[a[0]+dx*13,a[1]+dy*13],[a[0]+dx*10+dy*2,a[1]+dy*10-dx*2]],'#b89b50',.8);}}}
 strokes.forEach(p=>draw(p,'#247563',3.5));if(current.length)draw(current,'#247563',3.5);
 if(challenge.guided&&rail?.handle&&!feedback){const a=rail.handle;ctx.beginPath();ctx.arc(...a,6.5,0,Math.PI*2);ctx.fillStyle='#ffc54d';ctx.fill();ctx.lineWidth=1;ctx.strokeStyle='#967020';ctx.stroke();ctx.fillStyle='#584116';ctx.font='bold 5px sans-serif';ctx.textAlign='center';ctx.fillText('↗',a[0],a[1]+1.7);}
 ctx.restore();if(challenge.level===2&&!showModel){ctx.save();ctx.translate(w-62,8);ctx.scale(.5,.5);challenge.paths.forEach(p=>{ctx.beginPath();ctx.strokeStyle='#447264';ctx.lineWidth=4;ctx.moveTo(...p[0]);p.slice(1).forEach(q=>ctx.lineTo(...q));ctx.stroke();});ctx.restore();}}
async function submit(answer){
 if(challenge.guided&&!rail?.done)return;
 if(busy||feedback)return;busy=true;saveError='';
 const payload={challengeId:challenge.id,answer,strokes,helped,durationMs:elapsedMs(started)};
 telemetry.record('attempt_submit',{answer,durationMs:payload.durationMs});render();
 try{const data=await request('attempt',payload);profile=data.profile;feedback=data.result;feedback.submittedAnswer=answer;feedback.next=data.challenge;feedback.line=pickDialogue(feedbackCategory(challenge,feedback,helped));telemetry.record('feedback',{ok:feedback.ok,reason:feedback.reason||'',message:feedback.line});if(feedback.ok)chime();if(coachVoice.mode!=='letter')coachVoice.stop();praise(feedback.ok);}
 catch(e){saveError=e.message;}
 finally{busy=false;render();}
}
function recapView(r){
 const items=[...r.letters.map(c=>btn(escape(c),`recap-letter:${c}`,'recap-tile',`aria-label="Letter ${escape(c)}"`)),...r.words.map(w=>`<span class="recap-word">${escape(w)}</span>`)].join('');
 return `<p class="recap-line">${escape(r.lines[0])}</p>${items?`<div class="recap-items">${items}</div>`:''}${r.treats?`<div class="feeder-done" aria-label="${escape(r.lines[1]||'')}"><span class="feeder-bear" aria-hidden="true">${FEEDER.icon}</span><span class="feeder-berries" aria-hidden="true">${Array.from({length:r.treats},(_,i)=>`<i style="animation-delay:${i*70}ms">${FEEDER.treat}</i>`).join('')}</span><strong>${escape(r.lines[1])}</strong></div>`:''}`;
}
// Bo's running story: the last three beats, the newest one bold.
function storyCard(){
 const beats=profile.boStory?.beats||[];if(!tellsBoStory(profile.id)||!beats.length)return '';
 const recent=beats.slice(-3);
 return `<div class="story-card"><span class="eyebrow">📖 BO’S STORY</span>${recent.map((b,i)=>`<p class="${i===recent.length-1?'story-new':'story-old'}"><span aria-hidden="true">${beatIcon(b)}</span> ${escape(b.lines.join(' '))}</p>`).join('')}</div>`;
}
function celebrate(){view='celebrate';shownBerries=-1;const recap=lessonRecap(profile),rest=isResting(),beat=profile.boStory?.beats?.at(-1);coachVoice.stop();for(const line of recap.lines)narrate(line,true);if(tellsBoStory(profile.id)&&beat?.lesson===profile.completed)for(const line of beat.lines)narrate(line,true);if(rest)instruct(REST_LINE,true);app.innerHTML=`<div class="celebration ${rest?'rest-view':''}">${modeBanner()}<div class="confetti">✦　✧　✦　✧</div><div class="medal">${rest?'🌙':'★'}</div><span class="eyebrow">LOOK WHAT YOU DID</span><h1>${rest?'All done for today!':'Lesson complete!'}</h1>${recapView(recap)}${storyCard()}<div class="win-badges"><span>⚡ ${profile.xp} total XP</span><span>★ ${profile.completed} lessons</span></div>${coach(rest?REST_COACH:profile.chests?'And there’s treasure waiting for you.':'That’s a good place to pause. Or make one more move.',true)}${profile.chests?btn('Open my treasure ✧','treasure-next','button primary'):btn('Back to Learn →','exit','button primary')}${rest?'':btn('Another little quest','start','text-button')}<p class="paper-prompt">✎ Bonus adventure: write one letter on paper with Mom or Dad.</p></div>`;bind();}
// Starting a lesson during the wind-down shows the calm screen instead (no choice to make).
function restView(){view='celebrate';coachVoice.stop();instruct(REST_LINE);app.innerHTML=`<div class="celebration rest-view">${modeBanner()}<div class="medal">🌙</div><h1>All done for today!</h1>${storyCard()}${coach(REST_COACH,true)}${btn('Back to Learn →','exit','button primary')}</div>`;bind();}
function bind(){mountRefresh();app.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>act(el.dataset.action)));const player=app.querySelector('#player');if(player)player.onchange=async()=>{id=player.value;resetConfirmation=false;selectedDifficulty=undefined;leagueSelection=undefined;letterPractice=false;feedback=null;coachVoice.stop();try{localStorage.setItem('letter-quest-player',id);}catch{}const url=new URL(location.href);url.searchParams.set('player',id);history.replaceState(null,'',url);telemetry.record('action',{action:'switch_player'});await load();};const left=app.querySelector('#left-handed');if(left)left.onchange=()=>settings({leftHanded:left.checked});const sound=app.querySelector('#sound-setting');if(sound)sound.onchange=()=>settings({sound:sound.checked});}
function mountRefresh(){
 let identity=document.querySelector('.active-player-banner');
 if(!identity){identity=document.createElement('div');identity.className='active-player-banner';identity.setAttribute('aria-label','Active player');document.body.prepend(identity);const css=document.createElement('link');css.rel='stylesheet';css.href='/player-banner.css';document.head.append(css);}
 identity.dataset.player=id;identity.textContent=demo?'Explorer · demo':id==='admin'?'Admin · Admin':profile.name;
 if(app.querySelector('.app-refresh'))return;
 const button=document.createElement('button');button.type='button';button.className='app-refresh';button.textContent='↻ Refresh';button.setAttribute('aria-label','Refresh game');
 button.onclick=async()=>{
  if(busy){notice('Finishing your save. Try Refresh again in a moment.');return;}
  if((drawing||strokes.length||nameAnswer||readingInkError)&&!window.confirm('Refresh the game? Saved progress stays. Your unfinished answer or drawing may restart.'))return;
  button.disabled=true;button.textContent='Refreshing…';coachVoice.stop();soccerAudio.stop();
  await readingInkQueue;
  if(readingInkError){button.disabled=false;button.textContent='↻ Refresh';notice('Writing has not saved yet. Keep this screen open and try Save again.');return;}
  telemetry.record('action',{action:'refresh_game'});location.reload();
 };
 const header=app.querySelector('.topbar .stats,header');
 if(header)header.append(button);else{const tools=document.createElement('div');tools.className='app-refresh-tools';tools.append(button);app.prepend(tools);}
}
document.addEventListener('keydown',e=>{
 if(tab==='reading'&&view==='map'&&!busy&&readingState(profile).phase==='question'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.target?.matches('input,select,textarea')){
  const q=readingState(profile).question;if(['dictation','change'].includes(q.type)){
   if(/^[a-z]$/i.test(e.key)){const i=q.tiles.indexOf(e.key.toLowerCase());if(i>=0){e.preventDefault();void act('reading-tile:'+i);}return;}
   if(e.key==='Backspace'){e.preventDefault();void act('reading-undo');return;}
   if(e.key==='Enter'&&!e.target?.matches('button')){e.preventDefault();void act('reading-check');return;}
  }
 }
 if(view==='map'&&tab==='adventure'&&!busy&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.target?.matches('input,select,textarea')){const dirs={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};if(dirs[e.key]){e.preventDefault();void act('story-step:'+dirs[e.key]);return;}}
 if(view!=='lesson'||busy||feedback||!['name','spell'].includes(challenge?.type)||e.ctrlKey||e.metaKey||e.altKey||e.target?.matches('input,select,textarea'))return;
 if(/^[a-z]$/i.test(e.key)){const index=challenge.options.findIndex((c,i)=>c.toLowerCase()===e.key.toLowerCase()&&(challenge.reusable||!nameUsed.includes(i)));if(index>=0){e.preventDefault();void act('name:'+index);}}
 else if(e.key==='Backspace'){e.preventDefault();void act('name-undo');}
 else if(e.key==='Enter'&&!e.target?.matches('button')){e.preventDefault();void act('name-check');}
});
async function settings(values){try{accept(await request('settings',values));if(!profile.settings.sound)coachVoice.stop();render();}catch(e){notice(e.message);}}
function notice(text){let el=document.querySelector('.toast');if(!el){el=document.createElement('div');el.className='toast';el.setAttribute('role','status');document.body.append(el);}el.textContent=text;setTimeout(()=>el.remove(),5000);}
function rewardModal(title,gems,crown=false){
 const dialog=document.createElement('dialog');dialog.className='reward-modal';dialog.setAttribute('aria-labelledby','reward-title');
 dialog.innerHTML=`<div class="reward-sparkle" aria-hidden="true">${crown?'👑':'◆'}</div><div class="eyebrow">EARNED BY YOU</div><h2 id="reward-title">${escape(title)}</h2><p class="reward-amount">+${gems} gems${crown?' · +1 crown':''}</p><p>Your collection now has <strong>${profile.gems} gems.</strong></p><form method="dialog"><button class="button primary" autofocus>Awesome! →</button></form>`;
 dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
}
const runReading=exclusiveReadingAction(async(...args)=>{await readingInkQueue;return readingAct(...args);},value=>{busy=value;if(!value)render();});
async function readingAct(kind,value){
 if(kind==='letters'){letterPractice=true;goTab('practice');return;}
 if(kind==='home'){await readingInkQueue;if(readingInkError){notice('Writing not saved yet. Keep this page open and try Save again.');return;}letterPractice=false;if(profile.id==='beginner'){goTab('reading');app.innerHTML=frame(readingHome(profile));bind();}else goTab('practice');return;}
 if(kind==='resume'){readingMessage='';goTab('reading');return;}
 if(kind==='repeat'){readingPrompt(readingState(profile).question,true);return;}
 await readingInkQueue;if(!['tile','actor','position'].includes(kind))coachVoice.stop();
 const s=readingState(profile),q=s.question;let input;
 if(kind==='start'||kind==='choose'){const [focus,level]=value.split('|');input={kind:'start',focus,...(level?{level:Number(level)}:{}),replace:kind==='choose'};}
 else if(['read','show'].includes(kind))input={kind:'help',help:kind};
 else if(kind==='next'||kind==='skip')input={kind};
 else if(kind==='position')input={kind:'position',position:Number(value)};
 else if(kind==='ink-undo'){readingInkDraft=s.ink.slice(0,-1);input={kind:'ink',ink:readingInkDraft};}
 else if(['tile','actor','undo','clear'].includes(kind)){
  const draft=[...s.draft];if(kind==='undo'&&q.type==='change'){draft.splice(0,draft.length,...[...q.from].map(c=>q.tiles.indexOf(c)));}else if(kind==='undo')draft.pop();else if(kind==='clear')draft.length=0;else if(q.type==='change')draft[s.cursor||0]=Number(value);else if(draft.length<(q.type==='act'?q.count:q.type==='sentence'?(q.slots||q.tiles.length):q.word.length))draft.push(Number(value));
  input={kind:'draft',draft};
 }else if(kind==='answer'||kind==='check')input={kind:'answer',answer:value,durationMs:elapsedMs(readingStarted)};
 else {busy=false;return;}
 readingMessage='';render();
 try{
  if(readingInkError&&q?.type==='write'){const retry={kind:'ink',questionId:q.id,ink:readingInkDraft,revision:profile.revision};accept(demo?{profile,result:readingAction(profile,retry),challenge:nextChallenge(profile)}:await readingRequest(retry));readingInkError='';}
  const payload={...input,questionId:q?.id,revision:profile.revision};
  const data=demo?{profile,result:readingAction(profile,payload),challenge:nextChallenge(profile)}:await readingRequest(payload);accept(data);readingMessage=data.result.line||'';
  if(kind==='start'||kind==='choose')goTab('reading');
  if(['start','choose','next'].includes(kind)&&readingState(profile).phase==='question')readingPrompt(readingState(profile).question);
  else if(['read','show'].includes(kind)&&data.result.line)void coachVoice.speak(data.result.line);
  else if(kind==='tile'&&q?.tiles?.[Number(value)]&&['dictation','change'].includes(q.type)&&!mute)void coachVoice.letter(`Letter ${q.tiles[Number(value)].toUpperCase()}.`);
  else if(data.result.line)praise(data.result.kind!=='wrong');
  if(data.result.kind==='correct')chime();
 }catch(e){readingMessage=e.message;notice(e.message);}finally{busy=false;render();}
}
async function soccerAct(kind,value){
 if(kind==='exit'){goTab('practice');return;}
 if(kind==='repeat'){coachVoice.speak(soccerState(profile).question?.prompt||SOCCER_LINES.intro);return;}
 if(kind==='sound'){soccerAudio.stop();await settings({sound:!profile.settings.sound});return;}
 busy=true;coachVoice.stop();soccerMessage='';render();
 const payload={kind,revision:profile.revision,...(kind==='start'?{level:Number(value)}:{}),...(kind==='aim'?{aim:value}:{}),...(['hint','answer'].includes(kind)?{questionId:soccerState(profile).question?.id}:{}),...(kind==='answer'?{answer:value,durationMs:elapsedMs(soccerStarted)}:{})};
 try{
  const data=demo?{profile,result:soccerAction(profile,payload),challenge:nextChallenge(profile)}:await request('soccer',payload);
  accept(data);soccerMessage=data.result.line||'';
  if(tab!=='soccer')return;
  if(kind==='ready'){
   soccerEffect('whistle');await new Promise(resolve=>setTimeout(resolve,470));
   if(tab==='soccer')speak(soccerState(profile).question.prompt);
  }else if(kind==='answer'){
   soccerAnimating=true;render();soccerEffect('kick');
   await new Promise(resolve=>setTimeout(resolve,matchMedia('(prefers-reduced-motion: reduce)').matches?150:1150));
   soccerAnimating=false;
   if(tab==='soccer'){soccerEffect(data.result.kind);if(!data.result.goal){const a=data.result.shot.question.answer;speak(a.length===1?`Letter ${a.toUpperCase()}.`:`Choose the word ${a}.`);}else praise();}
  }else if(kind==='hint')speak(soccerMessage);else if(soccerState(profile).phase==='complete')narrate(soccerMessage);else instruct(soccerMessage);
 }catch(e){soccerMessage=e.message;notice(e.message);}finally{busy=false;soccerAnimating=false;render();}
 // Half time (after the third shot) and full time.
 const ss=soccerState(profile);
 if(kind==='next'&&tab==='soccer'&&ss.shots?.length===3&&ss.phase==='ready')void wordBreakNow('soccer-half-time','soccer-half:'+ss.number);
 if(kind==='next'&&tab==='soccer'&&ss.phase==='complete')void wordBreakNow('soccer-full-time','soccer-full:'+ss.number);
}
async function mazeAct(input){
 if(input.kind==='next'&&isResting()){mazeMessage=REST_LINE;instruct(REST_LINE);notice(REST_LINE);mazeClient?.update(profile,mazeMessage,false);return;}
 if(input.kind==='rescue'){goTab('rescue');return;}
 if(input.kind==='exit'){goTab('practice');return;}
 if(input.kind==='repeat'){coachVoice.speak(mazeState(profile).review?.learning.line||(mazeGate(profile)?mazeQuestion(profile).prompt:mazeClue(profile)?.line||MAZE_LINES.won));return;}
 if(input.kind==='listen'){if(!mute)void coachVoice.speak(mazeTapLine(input.answer));telemetry.record('action',{action:'maze:listen',answer:input.answer});return;}
 if(busy)return;busy=true;mazeClient?.update(profile,mazeMessage,true);
 const audible=!mute;
 const tapLine=input.kind==='answer'?mazeTapLine(input.answer,mazeQuestion(profile)):input.kind==='sound'?soundLine(mazeQuestion(profile).word[input.index]):'';
 const manualSound=input.kind==='sound'||input.kind==='answer'&&mazeQuestion(profile).type==='blend';
 if(tapLine&&(manualSound||audible))void (input.kind==='sound'?coachVoice.phoneme(tapLine):coachVoice.letter(tapLine));
 else if(['forward','next','retry'].includes(input.kind))coachVoice.stop();
 const payload={...input,revision:profile.revision,...(['answer','hint','retry','sound'].includes(input.kind)?{questionId:mazeQuestion(profile).id}:{}),...(input.kind==='answer'?{durationMs:elapsedMs(mazeStarted)}:{})};
 telemetry.record('action',{action:'maze:'+input.kind,...(input.answer?{answer:input.answer}:{})});
 try{
  const data=demo?{profile,result:mazeAction(profile,payload),challenge:nextChallenge(profile)}:await request('maze',payload);
  accept(data);mazeMessage=data.result.line||'';
  if(['correct','won'].includes(data.result.kind))chime();
  if(data.result.kind==='enter'&&!navigator.userActivation?.hasBeenActive){/* A direct link needs a first tap before speech. */}
  else if(['enter','next','gate','retry'].includes(data.result.kind)){if(mazeGate(profile))speak(mazeQuestion(profile).prompt);else if(data.result.line)instruct(data.result.line);}
  else if(['correct','incorrect'].includes(data.result.kind)){if(audible&&data.result.learning?.line&&data.result.learning.line!==tapLine)void coachVoice.enqueue(data.result.learning.line);}
  else if(input.kind==='hint')speak(data.result.line);
  else if(data.result.line)praise(data.result.kind!=='incorrect');
  if(data.result.windDown){mazeMessage=REST_LINE;instruct(REST_LINE,true);}

 }catch(e){mazeMessage=e.message;notice(e.message);}finally{busy=false;if(tab==='maze')render();}
}
// Word breaks: one short letter/word checkpoint at natural pauses (rescue, story, shootout).
// Level comes from this save (read only). Always passable; no menu. Never during the wind-down.
const brokeAt=new Set();
const voiceIdle=(max=6000)=>new Promise(resolve=>{const t0=Date.now(),check=()=>{if(!coachVoice.mode&&!coachVoice.promptTimer||Date.now()-t0>max)resolve();else setTimeout(check,150);};setTimeout(check,300);});
async function wordBreakNow(reason,key){
 if(busy||!profile||isResting()||key&&brokeAt.has(key))return false;
 if(key)brokeAt.add(key);
 busy=true;
 try{
  await voiceIdle();
  const who=demo?'admin':id,level=literacyFrom(profile,DEFAULT_TRACK[who]||'mixed');
  await wordBreak({player:who,level,reason,speak:(line,manual)=>{if(manual||!WORD_BREAK_FEEDBACK.includes(line)||!mute&&profile.settings.sound)void coachVoice.speak(line);},log:r=>telemetry.record('word_break',{reason,source:r.kind,action:'word-break:'+r.track,answer:Array.isArray(r.answer)?r.answer.join(' '):String(r.answer),durationMs:r.ms,misses:r.misses})});
 }catch(e){telemetry.record('runtime_error',{source:'word-break',message:e.message});}
 finally{busy=false;render();}
 return true;
}
let rescueClient=null,rescueMessage='';
async function rescueAct(input){
 if(busy)return;
 // Between puzzles: if the finish break was missed (for example after a reload), take it before the next rescue.
 if(input.kind==='next'&&rescueState(profile).phase==='done')await wordBreakNow('rescue-between','rescue-done:'+rescueState(profile).mission);
 if(busy)return;
 const rescuedBefore=rescueState(profile).rescued?.length||0;let breakAfter=null;
 if(input.kind==='repeat'){if(!mute)void coachVoice.speak(rescueLine(profile));return;}
 if(input.kind==='leave'){rescueMessage='';goTab('maze');return;}
 busy=true;rescueClient?.update(profile,rescueMessage,true);
 try{
  const payload={...input,rescueVersion:2,mission:rescueState(profile).mission,revision:profile.revision};
  const data=demo?{profile,result:rescueAction(profile,payload),challenge:nextChallenge(profile)}:await request('rescue',payload);
  accept(data);rescueMessage=data.result.line||'';
  if(data.result.kind==='complete')chime();
  const after=rescueState(profile);
  if(data.result.kind==='complete')breakAfter=['rescue-finish','rescue-done:'+after.mission];
  else if(after.engine===2&&rescuedBefore===0&&after.rescued?.length===1&&after.phase!=='done'&&(rescueInfo(profile).animals?.length||0)>1)breakAfter=['rescue-mid','rescue-mid:'+after.mission];
  if(input.kind==='pause')coachVoice.stop();
  // Rescue has no letter content: its lines are how-to instructions (once per session) or narration.
  if(rescueShouldSpeak(input)&&rescueMessage&&!mute){
   if(input.kind==='help')void coachVoice.speak(rescueMessage);
   else if(data.result.kind==='complete')narrate(rescueMessage);
   else instruct(rescueMessage);
  }
 }catch(e){rescueMessage=e.message;notice(e.message);}
 finally{busy=false;if(tab==='rescue')render();}
 if(breakAfter&&tab==='rescue')void wordBreakNow(...breakAfter);
}
async function act(action){telemetry.record('action',{action});if(busy)return;const [kind,value]=action.split(':');
 if(kind==='rest-clear'){busy=true;try{accept(await request('rest',{}));today=null;notice('New lessons are open again.');}catch(e){notice(e.message);}finally{busy=false;render();}return;}
 if(kind==='start'&&isResting()){restView();return;}
 if(kind.startsWith('reading-')){await runReading(kind.slice(8),value);return;}
 if(kind.startsWith('soccer-')){await soccerAct(kind.slice(7),value);return;}
 if(kind==='league-select'){const n=Number(value);if(Number.isInteger(n)&&n>=0&&n<=profile.league){leagueSelection=n;render();}return;}
 if(kind==='league-current'){leagueSelection=profile.league;render();return;}
 if(kind==='league-advance-request'){
  if(!claimedLeague(profile))return;
  const dialog=document.createElement('dialog');dialog.className='reward-modal';
  dialog.innerHTML='<h2>Ready for the next gem?</h2><p>Your first-place leaderboard will stay in your collection. There is no hurry.</p><form method="dialog"><button class="button primary" value="stay" autofocus>Stay at number one</button><button class="button secondary" value="advance">Enter the next gem</button></form>';
  dialog.addEventListener('close',async()=>{const advance=dialog.returnValue==='advance';dialog.remove();if(advance){busy=true;try{accept(await request('advance',{revision:profile.revision}));leagueSelection=profile.league;chime();}catch(e){notice(e.message);}finally{busy=false;render();}}});document.body.append(dialog);dialog.showModal();return;
 }
 if(kind.startsWith('story-')){
  if(kind==='story-repeat'){coachVoice.speak(storyMessage||storyBoard(profile).episode.intro);coachVoice.enqueue(STORY_LINES.move);return;}
  const s=storyState(profile),from=s.position;
  let input;
  if(kind==='story-guide')input={kind:'guide',guided:!s.guided};
  else if(kind==='story-hint')input={kind:'hint'};
  else if(kind==='story-next')input={kind:'next'};
  else if(kind==='story-move')input={kind:'move',position:Number(value)};
  else if(kind==='story-step'){
   const offsets={up:-5,down:5,left:-1,right:1};
   if(!(value in offsets)||value==='left'&&s.position%5===0||value==='right'&&s.position%5===4)return;
   const position=s.position+offsets[value];if(position<0||position>=20)return;input={kind:'move',position};
  }
  if(!input)return;busy=true;
  try{
   const data=demo?{profile,result:storyAction(profile,input),challenge:nextChallenge(profile)}:await request('story',{...input,revision:profile.revision});
   accept(data);storyMessage=data.result.line||'';
   if(input.kind==='next')storyMessage=storyBoard(profile).finished?STORY_LINES.finished:storyBoard(profile).episode.intro;
   if(input.kind==='hint'){if(storyMessage)speak(storyMessage);}else if(input.kind==='next'){if(storyMessage)narrate(storyMessage);}else if(data.result.line)praise(!['wrong','wall','locked'].includes(data.result.kind));
   if(data.result.kind==='won'||data.result.kind==='collected')chime();
   if(data.result.kind==='won')setTimeout(()=>void wordBreakNow('story-finish','story:'+storyState(profile).chapter),0);
  }catch(e){notice(e.message);}finally{busy=false;render();const to=storyState(profile).position,hero=app.querySelector('.story-hero');if(hero&&from!==to&&!matchMedia('(prefers-reduced-motion: reduce)').matches)hero.animate([{left:`${from%5*20+10}%`,top:`${Math.floor(from/5)*25+7}%`},{left:`${to%5*20+10}%`,top:`${Math.floor(to/5)*25+7}%`}],{duration:230,easing:'ease-out'});}return;
 }
 if(kind==='duel-start'){
  busy=true;coachVoice.stop();try{const difficulty=selectedDifficulty||recommendedDuelLevel(profile);if(demo){startDuel(profile,difficulty);challenge=nextChallenge(profile);}else accept(await request('duel',{revision:profile.revision,difficulty}));lessonOrigin='matches';feedback=null;view='lesson';busy=false;newExercise();}catch(e){notice(e.message);}finally{busy=false;}return;
 }
 if(kind==='difficulty'){selectedDifficulty=Number(value);render();return;}
 if(kind==='review'){reviewId=value;tab='matches';view='review';coachVoice.stop();render();window.scrollTo(0,0);return;}
 if(kind==='quest'){
  busy=true;let earned=false;try{const questId=action.slice(6);if(demo){if(!claimQuest(profile,questId))throw Error('This reward is not ready.');challenge=nextChallenge(profile);}else accept(await request('quest',{revision:profile.revision,questId}));chime();earned=true;}catch(e){notice(e.message);}finally{busy=false;render();if(earned)rewardModal('Quest reward unlocked!',10);}return;
 }
 if(kind.startsWith('admin-reset-')){
  if(!isAdmin())return;
  if(kind==='admin-reset-request'||kind==='admin-reset-cancel'){resetConfirmation=kind==='admin-reset-request';render();return;}
  if(kind==='admin-reset-confirm'&&resetConfirmation){busy=true;render();try{accept(await request('reset',{confirmation:'RESET ADMIN',revision:profile.revision}));resetConfirmation=false;feedback=null;strokes=[];current=[];drawing=false;pointer=null;coachVoice.stop();notice('Admin practice reset. The boys’ progress is unchanged.');}catch(e){notice(e.message);}finally{busy=false;render();}return;}
 }
 if(kind==='tab'){storyMessage='';goTab(value);if(value==='adventure'){instruct(STORY_LINES.move);}return;}
 if(kind==='start'){busy=true;try{if(demo){startAdventure(profile);challenge=nextChallenge(profile);}else accept(await request('adventure',{revision:profile.revision}));lessonOrigin='practice';feedback=null;busy=false;start();}catch(e){notice(e.message);}finally{busy=false;}return;}
 if(kind==='exit'){goTab(lessonOrigin);return;}
 if(kind==='sound'){await settings({sound:!profile.settings.sound});return;}if(kind==='repeat'){coachVoice.speak(prompt());return;}
 if(kind==='preview-voice'){coachVoice.speak(FIXED_LINES[1]);return;}
 if(kind==='rook-joke'){coachVoice.speak(FIXED_LINES[2]);return;}
 if(kind==='spot'){
  const i=Number(value);if(!challenge?.spot||busy||feedback||spotFound.includes(i)||!(i>=0&&i<challenge.grid.length))return;
  if(challenge.grid[i]===challenge.char){spotFound=[...spotFound,i];spotMissed=spotMissed.filter(j=>j!==i);telemetry.record('action',{action:'spot:hit',tile:i});
   if(spotFound.length===challenge.grid.filter(c=>c===challenge.char).length){await submit(challenge.char);return;}
   chime();render();return;}
  // A look-alike: gentle wiggle, no penalty screen. The round still finishes,
  // but it is recorded as supported rather than independent.
  helped=true;spotMissed=[...spotMissed.filter(j=>j!==i),i];telemetry.record('action',{action:'spot:miss',tile:i,letter:challenge.grid[i]});render();speak(prompt());return;
 }
 if(kind==='recap-letter'){if(/^[A-Za-z]$/.test(value)&&!mute)void coachVoice.letter(`Letter ${value.toUpperCase()}.`);return;}
 if(kind==='answer'){await submit(value);return;}
 if(kind==='skip'){
  if(feedback?.ok)return;busy=true;coachVoice.stop();
  try{
   if(demo){profile.seq++;profile.revision++;delete profile.retryTrace;challenge=nextChallenge(profile);}
   else accept(await request('skip',{challengeId:(feedback?.next||challenge).id}));
   feedback=null;busy=false;newExercise();
  }catch(e){notice(e.message);}finally{busy=false;}return;
 }
 if(kind==='name'){const i=Number(value);if(!challenge.reusable&&nameUsed.includes(i)||feedback||nameAnswer.length>=challenge.word.length)return;const letter=challenge.options[i];if(!letter)return;nameUsed.push(i);nameAnswer+=letter;if(!mute)void coachVoice.letter(`Letter ${letter.toUpperCase()}.`);render();return;}
 if(kind==='name-undo'){if(feedback)return;coachVoice.stop();nameAnswer=nameAnswer.slice(0,-1);nameUsed.pop();render();return;}
 if(kind==='name-check'){if(nameAnswer.length===challenge.word.length)await submit(nameAnswer);return;}
 if(kind==='name-clear'){if(feedback)return;coachVoice.stop();nameAnswer='';nameUsed=[];render();return;}
 if(kind==='hint'){
  if(feedback)return;
  busy=true;try{if(demo){if(challenge.duel)useMatchHint(profile);else useHint(profile,`lesson:${challenge.id}`);}else accept(await request('hint',{challengeId:challenge.id}));helped=true;showModel=true;if(challenge.type==='trace')resetTrace(true);else speak(prompt());}catch(e){notice(e.message);}finally{busy=false;render();}return;
 }
 if(kind==='clear'){resetTrace();return;}
 if(kind==='check'){if(strokes.length===0){instruct('Try drawing a line first.');notice('Start at the gold dot and draw a line.');return;}await submit();return;}
 if(kind==='next'){const wasLesson=feedback.lesson,duel=feedback.duel;challenge=feedback.next;if(duel?.finished){duelResult();return;}feedback=null;if(duel){newExercise();return;}if(wasLesson){celebrate();return;}newExercise();return;}
 if(kind==='treasure-next'){view='map';tab='treasure';render();return;}
 if(kind==='chest'||kind==='promote'){busy=true;let earned=false;try{accept(await request(kind,kind==='promote'?{revision:profile.revision}:{}));chime();earned=true;narrate(kind==='chest'?pickDialogue('chest'):'First place! Your crown is yours. Stay and enjoy your victory.');}catch(e){notice(e.message);}finally{busy=false;render();if(earned)rewardModal(kind==='chest'?'Treasure unlocked!':'Number one! Enjoy your crown.',kind==='chest'?25:40,kind==='promote');}return;}
 if(kind==='export'){const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),profile},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`letter-quest-${profile.id}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
}
async function load(){try{accept(await request());view='map';render();}catch(e){app.innerHTML=`<div class="connection-error"><span>🔤</span><h1>Rook is waiting at home.</h1><p>${escape(e.message)}</p><p>Check that the server is on and you’re connected to home Wi-Fi.</p><button id="retry-load" class="button primary">Try again</button></div>`;document.querySelector('#retry-load').onclick=load;mountRefresh();}}
// Update only hint labels: rebuilding the page here would erase live ink/drafts.
setInterval(()=>{
 if(!profile)return;
 const button=app.querySelector('[data-action="reading-show"]');
 if(button){const hint=readingHintState(profile,Date.now()+readingServerOffset);button.textContent=hint.label;button.disabled=busy||hint.waitSeconds>0;}
},250);
load();
