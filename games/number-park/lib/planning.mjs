export const PLAN_GOALS=[
 {id:'bridge',icon:'🌉',title:'Cross the river',prompt:'Help Rook cross the river.',steps:['build','cross'],extra:'collect',hint:'What could help Rook get across the water?'},
 {id:'garden',icon:'🌷',title:'Grow a flower',prompt:'Help Rook grow a flower.',steps:['plant','water'],extra:'dig',hint:'What needs to be in the soil before we water it?'},
 {id:'picnic',icon:'🧺',title:'Make a picnic',prompt:'Help Rook make a picnic.',steps:['blanket','basket'],extra:'invite',hint:'Where could we put the food so it stays clean?'}
];
export const PLAN_CARDS={
 collect:{icon:'🪵',name:'Get wood',line:'Get the wood.'},build:{icon:'🌉',name:'Build bridge',line:'Build the bridge.'},cross:{icon:'🚶',name:'Walk across',line:'Walk across.'},
 dig:{icon:'🥄',name:'Dig a hole',line:'Dig a little hole.'},plant:{icon:'🌱',name:'Plant seed',line:'Plant the seed.'},water:{icon:'💧',name:'Water seed',line:'Water the seed.'},
 blanket:{icon:'▦',name:'Lay blanket',line:'Lay the blanket.'},basket:{icon:'🧺',name:'Bring food',line:'Bring the food.'},invite:{icon:'🐰',name:'Invite friend',line:'Invite our friend.'},wave:{icon:'👋',name:'Wave hello',line:'Wave hello.'}
};
export const PLAN_LINES={choose:'What shall we make? You choose.',plan:'Choose what comes first. Then choose what comes next.',run:'Let’s try your plan.',edit:'We can change our plan. What comes first?',pause:'Your plan is saved.',success:'Your plan worked!',wave:'Hello, friend!',
 wood:'We have the wood.',needWood:'We need wood to build a bridge.',bridge:'The bridge is ready.',needBridge:'There is water here. We need a bridge first.',cross:'Rook is across!',
 hole:'The hole is ready.',needHole:'The seed needs a hole first.',seed:'The seed is in the soil.',needSeed:'The water needs a seed to help it grow.',flower:'Our flower grew!',
 blanket:'The blanket is ready.',needBlanket:'The food needs a blanket first.',food:'The food is ready.',needFood:'Our friend is waiting for the food.',picnic:'Our friend can join the picnic.',review:'Let’s change a step and try again.'};
export const planningVoiceLines=()=>[...new Set([...Object.values(PLAN_LINES),...PLAN_GOALS.flatMap(g=>[g.prompt,g.hint]),...Object.values(PLAN_CARDS).map(c=>c.line)])];
export const planSteps=s=>{const g=PLAN_GOALS.find(g=>g.id===s.goal);return s.level===2?(g.id==='picnic'?[...g.steps,g.extra]:[g.extra,...g.steps]):g.steps;};
export const planChoices=s=>{const a=[...planSteps(s),'wave'];const offset=s.serial%a.length;return [...a.slice(offset),...a.slice(0,offset)].reverse();};
export const initialPlanWorld=s=>({wood:s.level===1,hole:s.level===1,bridge:false,crossed:false,seed:false,flower:false,blanket:false,food:false,guest:false,actor:'start',wave:false});
export const planWon=s=>s.goal==='bridge'?s.world.crossed:s.goal==='garden'?s.world.flower:s.level===2?s.world.guest:s.world.food;
export function planningAction(p,input,now=Date.now()){
 const fail=m=>{throw Object.assign(Error(m),{status:400});};
 const old=p.planning||{serial:0,badges:0,history:[],session:null},a=structuredClone(old);
 let s=a.session;
 if(input.kind==='plan_start'){
  if(!PLAN_GOALS.some(g=>g.id===input.goal))fail('Choose a goal.');
  if(s&&s.phase!=='success')fail('Your plan is saved. Choose another goal from the menu first.');
  const level=a.history.filter(h=>h.firstTry&&!h.helped).length>=3?2:1;
  a.serial++;s={id:`plan:${a.serial}:${p.revision}`,serial:a.serial,goal:input.goal,level,plan:[],phase:'plan',cursor:0,tries:0,helped:false,paused:false,events:[],line:PLAN_GOALS.find(g=>g.id===input.goal).prompt};
  s.world=initialPlanWorld(s);a.session=s;
 }else{
  if(!s||input.planId!==s.id)fail('This plan changed. Reconnect to continue.');
  if(input.kind==='plan_pause'){s.paused=true;}
  else if(input.kind==='plan_resume'){s.paused=false;}
  else if(input.kind==='plan_leave'){a.session=null;}
  else if(s.paused)fail('Resume your plan first.');
  else if(input.kind==='plan_help'){s.helped=true;s.line=PLAN_GOALS.find(g=>g.id===s.goal).hint;}
  else if(input.kind==='plan_cards'){
   if(!['plan','review'].includes(s.phase))fail('Watch this plan first.');
   if(!Array.isArray(input.cards)||input.cards.length>planSteps(s).length||!input.cards.every(c=>planChoices(s).includes(c))||new Set(input.cards).size!==input.cards.length)fail('Choose the picture cards for this plan.');
   s.plan=[...input.cards];s.phase='plan';s.cursor=0;s.events=[];s.world=initialPlanWorld(s);s.line=PLAN_LINES.plan;
  }else if(input.kind==='plan_run'){
   if(!['plan','review'].includes(s.phase)||s.plan.length!==planSteps(s).length)fail('Choose a picture for every step.');
   s.tries++;s.cursor=0;s.world=initialPlanWorld(s);s.phase='running';s.line=PLAN_LINES.run;s.events=[];
  }else if(input.kind==='plan_step'){
   if(s.phase!=='running'||input.step!==s.cursor)fail('This step already changed.');
   const card=s.plan[s.cursor],w=s.world;let ok=true,line='';
   if(card==='wave'){w.wave=!w.wave;line=PLAN_LINES.wave;}
   if(card==='collect'){w.wood=true;w.actor='wood';line=PLAN_LINES.wood;}
   if(card==='build'){ok=w.wood;line=ok?PLAN_LINES.bridge:PLAN_LINES.needWood;if(ok){w.bridge=true;w.actor='river';}}
   if(card==='cross'){ok=w.bridge;line=ok?PLAN_LINES.cross:PLAN_LINES.needBridge;w.actor=ok?'finish':'river';if(ok)w.crossed=true;}
   if(card==='dig'){w.hole=true;w.actor='soil';line=PLAN_LINES.hole;}
   if(card==='plant'){ok=w.hole;line=ok?PLAN_LINES.seed:PLAN_LINES.needHole;if(ok)w.seed=true;w.actor='soil';}
   if(card==='water'){ok=w.seed;line=ok?PLAN_LINES.flower:PLAN_LINES.needSeed;if(ok)w.flower=true;w.actor='soil';}
   if(card==='blanket'){w.blanket=true;line=PLAN_LINES.blanket;w.actor='picnic';}
   if(card==='basket'){ok=w.blanket;line=ok?PLAN_LINES.food:PLAN_LINES.needBlanket;if(ok)w.food=true;w.actor='picnic';}
   if(card==='invite'){ok=w.food;line=ok?PLAN_LINES.picnic:PLAN_LINES.needFood;if(ok)w.guest=true;w.actor='friend';}
   s.events.push({step:s.cursor,card,ok,line,world:structuredClone(w)});s.cursor++;s.line=line;
   if(s.cursor===s.plan.length){
    s.phase=planWon(s)?'success':'review';
    if(s.phase==='review')s.line=s.events.find(e=>!e.ok)?.line||PLAN_LINES.review;
    if(s.phase==='success'){a.badges++;a.history.push({at:new Date(now).toISOString(),goal:s.goal,level:s.level,serial:s.serial,plan:[...s.plan],tries:s.tries,firstTry:s.tries===1,helped:s.helped});a.history=a.history.slice(-200);}
   }
  }else fail('Unknown planning action.');
 }
 p.planning=a;
}
