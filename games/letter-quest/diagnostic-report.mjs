export async function summarize(records,{player,session,excludedRevisions={}}={}){
 const skills=new Map(),sessions=new Set(),seen=new Set(),issues=[],stories=new Map(),mazes=new Map(),soccer=new Map(),reading=new Map();
 let attempts=0,clientEvents=0,technicalIssues=0,malformedLines=0;
 const include=(p,s)=>!(['demo','admin'].includes(p)&&player!==p)&&(!player||p===player)&&(!session||s===session);
 const issue=(row,kind,reason)=>{technicalIssues++;issues.push({at:row.at,kind,player:row.player||'',session:row.session||'',requestId:row.requestId||'',reason});if(issues.length>30)issues.shift();};
 for await(const row of records){
  if(row.type==='malformed_log'){malformedLines++;continue;}
  if(row.type==='attempt'&&include(row.player,row.session)){
   if(row.revision<=Number(excludedRevisions[row.player]||0))continue;
   attempts++;if(row.session)sessions.add(row.session);
   const key=`${row.player}/${row.key}/L${row.before.level}`;
   const s=skills.get(key)||{player:row.player,skill:row.key,level:row.before.level,attempts:0,wins:0,independent:0,assisted:0,fastRecognition:0,ms:0,reasons:{}};
   s.attempts++;s.wins+=Number(row.result.ok);s.independent+=Number(row.result.ok&&!row.input.helped);s.assisted+=Number(row.input.helped);s.ms+=row.input.durationMs;
   if(row.challenge.type==='find'&&row.result.ok&&!row.input.helped&&row.input.durationMs<5500)s.fastRecognition++;
   if(!row.result.ok){const reason=row.result.reason||'incorrect';s.reasons[reason]=(s.reasons[reason]||0)+1;}
   skills.set(key,s);
  }else if(row.type==='story_action'&&include(row.player,row.session)){
   if(row.session)sessions.add(row.session);
   const s=stories.get(row.player)||{player:row.player,actions:0,moves:0,blocked:0,wrongOrder:0,hints:0,rescues:0};
   s.actions++;s.moves+=Number(row.input.kind==='move'&&row.result.kind!=='blocked');
   s.blocked+=Number(row.result.kind==='blocked');s.wrongOrder+=Number(row.result.kind==='wrong');s.hints+=Number(row.result.kind==='hint');s.rescues+=Number(row.result.kind==='won');stories.set(row.player,s);
  }else if(row.type==='maze_action'&&include(row.player,row.session)){
   if(row.session)sessions.add(row.session);
   const m=mazes.get(row.player)||{player:row.player,moves:0,turns:0,gates:0,independent:0,assisted:0,incorrect:0,hints:0,escapes:0,setbacks:0,learningRetries:0};
   m.setbacks+=Number(!!row.result.steppedBack);m.learningRetries+=Number(row.result.kind==='retry');
   m.moves+=Number(['move','gate','won'].includes(row.result.kind));m.turns+=Number(row.result.kind==='turn');m.gates+=Number(row.result.kind==='correct');m.independent+=Number(row.result.kind==='correct'&&!row.result.helped);m.assisted+=Number(row.result.kind==='correct'&&row.result.helped);m.incorrect+=Number(row.result.kind==='incorrect');m.hints+=Number(row.result.kind==='hint');m.escapes+=Number(row.result.kind==='won');mazes.set(row.player,m);
  }else if(row.type==='soccer_action'&&include(row.player,row.session)){
   if(row.session)sessions.add(row.session);
   const s=soccer.get(row.player)||{player:row.player,shots:0,goals:0,saves:0,independent:0,assisted:0,hints:0,shootouts:0};
   s.shots+=Number(['goal','save','practice'].includes(row.result.kind));s.goals+=Number(row.result.kind==='goal');s.saves+=Number(row.result.kind==='save');s.independent+=Number(row.result.kind==='goal'&&!row.result.helped);s.assisted+=Number(row.result.kind==='practice'||row.result.kind==='goal'&&row.result.helped);s.hints+=Number(row.result.kind==='hint');s.shootouts+=Number(!!row.result.bonus);soccer.set(row.player,s);
  }else if(row.type==='reading_action'&&include(row.player,row.session)){
   if(row.session)sessions.add(row.session);const q=row.before.question;
   if(q){const key=`${row.player}/${q.type}/L${q.level}`,r=reading.get(key)||{player:row.player,activity:q.type,level:q.level,attempts:0,independent:0,assisted:0,incorrect:0,hints:0,writingSamples:0,skips:0};
    r.attempts+=Number(row.input.kind==='answer');r.independent+=Number(!!row.result.independent);r.assisted+=Number(!!row.result.ok&&!row.result.independent);r.incorrect+=Number(row.result.kind==='incorrect');r.hints+=Number(row.result.kind==='help');r.writingSamples+=Number(row.result.kind==='writing');r.skips+=Number(row.result.kind==='skip');reading.set(key,r);}
  }else if(row.type==='client_events'){
   for(const event of row.events){
    if(!include(event.player,event.session)||seen.has(event.eventId))continue;
    seen.add(event.eventId);clientEvents++;sessions.add(event.session);
    if(['runtime_error','resource_error','api_error','voice_error','logging_gap'].includes(event.kind)||event.kind==='trace_blocked'&&['busy','already_drawing','feedback'].includes(event.reason))issue({...event,at:row.at},event.kind,event.reason||event.message);
   }
  }else if(include(row.player,row.session)&&(row.type==='server_error'||row.type==='protocol_error'||row.type==='request_aborted'||row.type==='http'&&row.status>=400))issue(row,row.type,row.reason||row.message||String(row.status));
 }
 return {reading:[...reading.values()],soccer:[...soccer.values()],mazes:[...mazes.values()],stories:[...stories.values()],attempts,sessions:sessions.size,clientEvents,technicalIssues,malformedLines,skills:[...skills.values()].map(s=>({player:s.player,skill:s.skill,level:s.level,attempts:s.attempts,successPct:Math.round(100*s.wins/s.attempts),independent:s.independent,assisted:s.assisted,averageSeconds:Math.round(s.ms/s.attempts/1000),failures:s.reasons,signal:s.attempts<5?'More samples needed':s.wins/s.attempts<.5?'Review difficulty / scoring / input':s.fastRecognition/s.attempts>=.8?'Recognition may be too easy':s.independent/s.attempts>=.9?'Check readiness for less guidance':'Keep observing'})),recentIssues:issues};
}
