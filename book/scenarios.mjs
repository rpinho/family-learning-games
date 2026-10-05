// Fictional scenario catalog and local selection engine.
import {rng} from './plan.mjs';
import {chessCaptureBeat,chessForkBeat,mazeBeat} from './board-beats.mjs';
import {divideBeat,timesBeat,shareBeat,divideNoBeat,chessPointsBeat,chessAheadBeat,chessCapturesBeat,routeBeat} from './quest-beats.mjs';
export const SCENARIOS=[
 {id:'lantern-meadow',place:'meadow',title:'The Lantern Trail',what:'Bo and Pip follow a lantern trail through a fictional meadow.',doing:'count stars and read a short sign',opening:'A lantern glows beside the path.'},
 {id:'forest-sign',place:'forest',title:'Pip’s Forest Sign',what:'Pip finds a friendly sign in an invented forest.',doing:'read a short word and choose the matching token',opening:'Pip spots a sign.'},
 {id:'castle-stars',place:'castle',title:'Bo’s Star Map',what:'Bo restores a star map at a make-believe castle.',doing:'count tokens and join the map pieces',opening:'Bo opens his star map.'},
 {id:'pitch-pass',place:'pitch',title:'A Pass for Pip',what:'Bo and Pip play a friendly soccer game.',doing:'kick a letter ball',opening:'Pip rolls the ball.'}
];
// Stable demo order; each installation can author its own private content.
const FIRST={beginner:['lantern-meadow','forest-sign'],explorer:['castle-stars','pitch-pass']};
// Background variants share a rotation group. A chapter using one variant
// excludes its siblings for three chapters and from secondary-place choices.
export const SAME_ROOM=[['gym-bars-home','home-gym'],['home-room','chess-table']];
export const roomOf=bg=>SAME_ROOM.find(r=>r.includes(bg))||[bg];
// The backgrounds today's chapter must not use: his last three chapters' places (and their twins), and the twin of
// today's own place.
export function avoidBgsFor(recent,place){const out=new Set(recent.slice(-3).flatMap(r=>r.bgs||[]).flatMap(roomOf));if(place)for(const b of roomOf(place))if(b!==place)out.add(b);out.delete(place);return [...out];}
// recent: [{scenario, bgs:[...]}] of his previous chapters, newest last.
export function chooseScenario(player,recent,library,{date=null}={}){
 // (a scenario written for one boy, only: never the other's; a queue-only scenario only for a child whose queue names it)
 const has=s=>(!date||!s.notBefore||date>=s.notBefore)&&(!s.only||s.only.includes(player))&&(!s.queueOnly||(FIRST[player]||[]).includes(s.id))&&(!library||library.backgrounds?.[s.place]);
 const lastBgs=new Set(recent.slice(-3).flatMap(r=>r.bgs||[]).flatMap(roomOf)),lastScen=new Set(recent.slice(-6).map(r=>r.scenario).filter(Boolean)),ever=new Set(recent.map(r=>r.scenario).filter(Boolean));
 const order=[...(FIRST[player]||[]),...SCENARIOS.map(s=>s.id)].filter((x,i,a)=>a.indexOf(x)===i).map(id=>SCENARIOS.find(s=>s.id===id));
 // (a scenario a grown-up asked to come first, priority: its place only needs to be new since the LAST chapter)
 const lastOne=new Set(recent.slice(-1).flatMap(r=>r.bgs||[]).flatMap(roomOf));
 const ok=s=>s&&has(s)&&!lastScen.has(s.id)&&!(s.priority&&!ever.has(s.id)?lastOne:lastBgs).has(s.place);
 return order.find(s=>ok(s)&&!ever.has(s.id))||order.find(ok)||null;
}
// The backgrounds of his last three chapters (never in today's) and the scenarios he had, from his chapter files.
export function recentOf(chapters){return chapters.map(c=>({scenario:c?.meta?.scenario||null,bgs:[...new Set((c?.pages||[]).map(p=>p.scene?.bg).filter(Boolean))]}));}
// A scenario's own doing inside the plan's learning beats (code, not the model): what he counts (a drawn library
// prop with explicit scale metadata) and, for a workout, the numbers 1 to 5 become reps he counts while the
// hero lifts his arms on each one, both at today's place (at). Only when the library has the drawing. A game that
// needs somewhere else (a kick-letter needs a soccer goal) is kept away from it (away). Returns notes for the log.
export function scenarioBeats(plan,library){
 const s=plan.scenario,notes=[];if(!s)return notes;
 if(s.id==='metro'&&library?.backgrounds?.[s.place]){
  plan.avoidBgs=[...new Set([...(plan.avoidBgs||[]),'train-valley'])];
  const i=plan.beats.findIndex(b=>['count','puzzle','share','score'].includes(b.kind)),old=plan.beats[i];
  if(old){
   plan.beats[i]={id:old.id,kind:'count',at:s.place,painted:'seats',n:6,thing:'seat',things:'black seats',answer:'6',options:['5','6','7'],
    what:'tap each of the six black seats actually painted in the parked metro once; no added seats',intro:'Black seats wait in the blue metro.',spoken:'Tap each black seat to count it.',ask:'How many seats?',done:'Six seats. Three pairs!'};
   const park={id:'metro-park',kind:'puzzle',variant:'observe',at:s.place,painted:'parking',display:null,answer:'bay',options:['bay','path'],
    what:'choose the gravel parking bay beside the path by tapping the painting, leaving the path open',intro:'The metro cannot reach the shop.',spoken:'Where should Dad park? Keep the path clear.',hint:'The gravel bay is beside the path. People need the path clear.',done:'Parked beside the path. Everyone can pass.'};
   const oi=plan.beats.findIndex(b=>b.kind==='order'),order=plan.beats[oi];
   const wheels={id:order?.id||'metro-wheels',kind:'order',at:s.place,painted:'wheels',numbers:[1,2,3],tiles:['1','2','3'],
    what:'choose a turn-taking order by tapping the actual skateboard, bike and kick scooter in that order; no race',intro:'Dad takes his board. Your brother bikes. You scoot.',spoken:'Tap the skateboard, bike, then kick scooter.',done:'Dad, bike, scooter. Off to the shop together!'};
   if(plan.level!=='early')wheels.intro='Dad takes his board. You bike. Your brother scoots.';
   if(oi>=0)plan.beats[oi]=wheels;else plan.beats.push(wheels);
   const fi=plan.style==='quest'?plan.beats.findIndex(b=>b.kind==='fork'):-1;
   if(fi>=0){park.id=plan.beats[fi].id;plan.beats[fi]=park;}else plan.beats.splice(plan.beats.findIndex(b=>b.id===old.id)+1,0,park);
   const changed=new Set([old.id,order?.id,fi>=0?park.id:null]);
   if(plan.level!=='early'){
    const mi=plan.beats.findIndex(b=>b.kind==='puzzle'&&!b.painted),mb=plan.beats[mi];
    const math={id:mb?.id||'metro-shopping',kind:'puzzle',variant:'observe',at:s.place,display:null,answer:'28',options:['32','28','18'],
     what:'at the painted shop, mentally find the cost of three packs at 24 coins each, then change from 100 coins; no pieces or board',intro:'The little shop is ahead.',spoken:'Three snack packs cost twenty-four coins each. Pay one hundred coins. How much change?',hint:'Three times twenty-four is seventy-two. What takes seventy-two up to one hundred?',done:'Twenty-eight coins change. Seventy-two plus twenty-eight is one hundred.'};
    if(mi>=0){plan.beats[mi]=math;changed.add(mb.id);}else plan.beats.push(math);
   }
   if(plan.learnerFocus)plan.learnerFocus=plan.learnerFocus.filter(f=>!changed.has(f.beat));
  }
  for(const b of plan.beats)if(!b.painted&&b.at!==s.place)b.away=s.place;
  notes.push('metro: painted seats, parking bay and wheels order; older-child shopping and change');
 }
 if(s.id==='flower-meadow'&&library?.backgrounds?.[s.place]){
  if(library.actors?.rook&&!plan.cast.some(c=>c.id==='rook'))plan.cast.push({id:'rook',name:'Rook',kind:'a friendly game companion watching from the footpath',quiet:true});
  const i=plan.beats.findIndex(b=>['count','puzzle','share','score'].includes(b.kind));
  if(i>=0){const old=plan.beats[i];
   plan.beats[i]={id:old.id,kind:'count',at:s.place,painted:'yellow-flowers',n:10,thing:'flower',things:'big yellow flowers',answer:'10',options:['9','10','11'],
    what:'tap and count the ten large yellow flowers with brown centres in two rows, once each; distinguish them from the smaller surrounding meadow flowers; no added flowers',intro:'Yellow flowers grow.',spoken:'Tap the big yellow flowers with brown centres.',ask:'How many big yellow flowers?',done:'Ten yellow flowers. All keep growing!'};
   if(plan.learnerFocus)plan.learnerFocus=plan.learnerFocus.filter(f=>f.beat!==old.id);
   plan.beats.splice(i,0,{id:'meadow-find',kind:'puzzle',variant:'observe',at:s.place,painted:'flower-choices',display:null,answer:'orange',options:['orange','bud'],
    what:'find the one orange flower by tapping its painted head',intro:'One flower is orange.',spoken:'Find your orange flower. Tap it.',hint:'Look for the open orange petals.',done:'Room to grow!'});
   const oi=plan.beats.findIndex(b=>b.kind==='order'),oldOrder=plan.beats[oi];const grow={id:oldOrder?.id||'meadow-grow',kind:'puzzle',variant:'observe',at:s.place,painted:'flower-choices',display:null,answer:'bud',options:['orange','bud'],
    what:'choose the closed painted bud to leave growing; every flower stays in the meadow',intro:'A bud waits.',spoken:'Which one needs time to open? Leave the closed bud growing.',hint:'The green bud is still closed. Leave it so it can bloom.',done:'Both stay. You can love a flower and let it grow.'};
   if(oi>=0){plan.beats[oi]=grow;if(plan.learnerFocus)plan.learnerFocus=plan.learnerFocus.filter(f=>f.beat!==oldOrder.id);}else plan.beats.push(grow);
  }
  for(const b of plan.beats)if(!b.painted)b.away=s.place;
  notes.push('meadow: painted flower find, count ten, and leave the bud growing');
 }
 if(s.id==='volcano'&&library?.backgrounds?.[s.place]){
  if(plan.level==='early'&&library.actors?.rook&&!plan.cast.some(c=>c.id==='rook'))plan.cast.push({id:'rook',name:'Rook',kind:'a friendly game companion watching from the terrace',quiet:true});
  const i=plan.beats.findIndex(b=>['count','puzzle','share','score'].includes(b.kind));
  if(i>=0){const old=plan.beats[i];plan.beats[i]={id:old.id,kind:'count',at:s.place,painted:'stones',n:12,thing:'stone',things:'stepping stones',answer:'12',options:['11','12','13'],
   what:'tap each of the twelve stones painted in the lava once; no added objects',spoken:'Tap each dark stepping stone to count it.',ask:'How many stepping stones?',done:'Twelve stepping stones!'};
   // Keep literacy and all other learning beats; replaced quantity focus no longer applies.
   if(plan.learnerFocus)plan.learnerFocus=plan.learnerFocus.filter(f=>f.beat!==old.id);
  }
  let ob=plan.beats.find(b=>b.kind==='order');if(!ob&&plan.style==='quest'){const oi=plan.beats.findIndex(b=>b.kind==='puzzle');if(oi>=0){ob={id:plan.beats[oi].id,kind:'order'};plan.beats[oi]=ob;if(plan.learnerFocus)plan.learnerFocus=plan.learnerFocus.filter(f=>f.beat!==ob.id);}}if(!ob){ob={id:'volcano-order',kind:'order'};plan.beats.push(ob);}
  Object.assign(ob,{at:s.place,painted:'stones',numbers:Array.from({length:12},(_,i)=>i+1),tiles:Array.from({length:12},(_,i)=>String(i+1)),what:'tap the actual stones from left to right in path order; pretend hops, no figures on the stones',spoken:'Tap the stones, left to right.',done:'Twelve hops. Everyone is across!'});
  const safe={id:'volcano-path',kind:'puzzle',variant:'observe',painted:'paths',at:s.place,display:null,answer:'bridge',options:['lava','bridge'],
   what:'choose the safe path by tapping the actual painted bridge, not the lava',spoken:'Tap the dry path. Bridge or lava?',hint:'The dry bridge goes above the lava.',done:'The dry bridge! Everyone crosses together.'};
  const fi=plan.style==='quest'?plan.beats.findIndex(b=>b.kind==='fork'):-1;if(fi>=0){safe.id=plan.beats[fi].id;plan.beats[fi]=safe;}else plan.beats.push(safe);
  for(const b of plan.beats)if(!b.painted)b.away=s.place;
  notes.push('volcano: painted count, order and safe path; other play elsewhere');
 }
 if(s.sceneQuestion&&library?.backgrounds?.[s.place]){
  const i=(plan.beats||[]).findIndex(b=>plan.level==='early'?b.kind==='count':['puzzle','share','score'].includes(b.kind));
  if(i>=0){const old=plan.beats[i],early=plan.level==='early';
   plan.beats[i]={id:old.id,kind:'puzzle',variant:'observe',at:s.place,display:null,
    answer:early?'4':'6',options:early?['3','4','5']:['8','6','4'],
    what:early?'look at the actual rings painted on the parked car and count them; choose how many, without extra pieces or a board':'Dad packs 24 grapes into 4 equal snack bags for the outing; mentally work out how many go in each, then choose, without extra pieces or a board',
    spoken:early?'Look at the rings on the front of the car. How many rings can you see?':'For our picnic, pack 24 grapes into four equal snack bags. How many grapes go in each bag?',
    hint:early?'Look closely at the grille. Count each ring once, from left to right.':'Think of four equal groups. Four times what makes 24?',
    done:early?'Four rings, linked together. That is the car of the circles!':'Six grapes in each bag. Four times six is 24. The picnic is packed!'};
   if(s.questions)Object.assign(plan.beats[i],s.questions[early?'early':'reader']);
   notes.push(`scene question: ${early?'painted rings':'equal picnic bags'} (${s.id})`);
   for(const beat of plan.beats)if(beat.variant!=='observe')beat.away=s.place;
  }
 }
 const cb=(plan.beats||[]).find(b=>b.kind==='count');
 if(s.count&&cb&&library?.props?.[s.count[0]]){const [thing,things,emoji]=s.count;Object.assign(cb,{at:s.place,thing,things,emoji,prop:thing,spoken:`Tap each one to count the ${things}.`,ask:`How many ${things}?`,what:`count the ${things} for today's workout`});notes.push(`count: ${things} (${s.id})`);}
 const ob=(plan.beats||[]).find(b=>b.kind==='order');
 if(s.reps&&ob){Object.assign(ob,{at:s.place,reps:true,what:`count five reps in order: ${plan.name} taps the numbers 1 to 5, one for each rep`,spoken:'Count the reps! Tap the numbers in order.',done:'One, two, three, four, five! Strong arms!'});notes.push(`order: five reps (${s.id})`);}
 // A quest book's own scenario puzzles (chess, labyrinths, mental maths) replace the day's puzzles and happen first, at
 // today's place; the reading (signs), the fork and the NO! stay. Order: today's puzzles, signs, the middle beat (the
 // spell, or the scenario's own), the fork, the NO!.
 if(s.quest&&plan.style==='quest'){const q=questScenarioBeats(plan,s);if(q){plan.beats=q.beats;notes.push(...q.notes);}}
 // a game that needs another place (the soccer goal of a kick-letter) is played away from the home gym
 for(const b of plan.beats||[])if((s.away||[]).includes(b.kind)){b.away=s.place;notes.push(`${b.kind}: away from ${s.place}`);}
 return notes;
}

// The scenario's own beats for a quest book, from its spec ({first, middle, no}); null when the plan is not a quest.
export const QUEST_MAKERS={
 'chess-points':(id,r)=>chessPointsBeat(id,r),
 'chess-captures':(id,r)=>chessCapturesBeat(id,r),
 'chess-captures-big':(id,r)=>chessCapturesBeat(id,r,{many:true}),
 'chess-ahead':(id,r)=>chessAheadBeat(id,r),
 'maze-route':(id,r)=>routeBeat(id,r,{flavor:'labyrinth'}),
 'maze-route-long':(id,r)=>routeBeat(id,r,{flavor:'labyrinth',long:true}),
 'chess-capture':(id,r)=>chessCaptureBeat(id,r),
 'chess-fork':(id,r)=>chessForkBeat(id,r),
 maze:(id,r)=>mazeBeat(id,r,{w:6,h:6}),
 'maze-big':(id,r)=>mazeBeat(id,r,{w:8,h:8,big:true}),
 divide:(id,r,m,used)=>divideBeat(id,r,{facts:m.factsStuck,avoid:used}),
 times:(id,r,m,used)=>timesBeat(id,r,{facts:m.factsStuck,avoid:used}),
 share:(id,r,m)=>shareBeat(id,r,{thing:['cookies','cookie'],shares:m.hardShares}),
};
export function questScenarioBeats(plan,s){
 const beats=plan.beats||[],signs=beats.find(b=>b.kind==='signs'),spell=beats.find(b=>b.kind==='spell'),fork=beats.find(b=>b.kind==='fork'),no=beats.find(b=>b.kind==='no');
 if(!signs||!fork||!no)return null;
 const r=rng(`scenario:${plan.player}:${plan.date}:${s.id}`),m=plan.math||{},notes=[];
 // (each number fact once a chapter: the products already used are passed on)
 const used=[],use=b=>{const n=String(b.display||'').match(/^(\d+) [÷×] (\d+)$/);if(n)used.push(b.variant==='divide'?Number(n[1]):n[1]*n[2]);return b;};
 // number board; the drawn chessboard and labyrinth boards are only for a profile that opts in: boardPuzzles true.)
 const first=((plan.boardPuzzles&&s.quest.boards)||s.quest.first||[]).map((k,i)=>use({...QUEST_MAKERS[k](`s${i+1}`,r,m,used),at:s.place}));
 const middle=s.quest.middle?use(QUEST_MAKERS[s.quest.middle]('sm',r,m,used)):spell;
 const noBeat=s.quest.no==='divide'?divideNoBeat('sn',r,{facts:m.factsStuck,who:no.who,whoName:no.whoName,avoid:used}):no;
 const out=[...first,signs,middle,fork,noBeat].filter(Boolean).map((b,i)=>({...b,id:`b${i+1}`,_was:b.id}));
 // the learner model's focus follows its beat to its new place; a focus on a beat the scenario replaced is dropped
 // (2026-10-01: "learner focus vowel:u: beat b1 no longer practises it" sent good chapters to the template)
 const kept=new Map(out.filter(b=>[signs,middle===spell?spell:null,fork,noBeat===no?no:null].some(x=>x&&x.id===b._was&&x.kind===b.kind)).map(b=>[b._was,b.id]));
 if(Array.isArray(plan.learnerFocus)){const before=plan.learnerFocus.length;plan.learnerFocus=plan.learnerFocus.filter(f=>kept.has(f.beat)).map(f=>({...f,beat:kept.get(f.beat)}));
  if(plan.learnerFocus.length<before)notes.push(`learner focus: ${before-plan.learnerFocus.length} item(s) on replaced puzzles dropped`);}
 for(const b of out)delete b._was;
 notes.push(`quest: ${out.map(b=>b.variant||b.kind).join(', ')} (${s.id}; ${first.length} at ${s.place})`);
 return {beats:out,notes};
}
