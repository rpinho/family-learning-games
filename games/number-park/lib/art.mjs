import {validInk} from './copy-practice.mjs';
import {DOODLES,inkStats} from './doodle.mjs';
import {GUESS_MODES,validArtLabel,symbolVoiceLines} from './symbol-recognition.mjs';
import {checkPart,cleanMissionInk} from './shape-check.mjs';
import {DRAWING_IDEAS} from './drawing-ideas.mjs';
export {checkPart} from './shape-check.mjs';
const circle=Array.from({length:41},(_,i)=>[50+35*Math.cos(i*Math.PI/20),50+35*Math.sin(i*Math.PI/20)]);
export const PARTS={
 circle:{name:'circle',prompt:'Draw a circle. Go around and connect the ends.',path:circle},
 rectangle:{name:'rectangle',prompt:'Draw a rectangle. Four sides. Connect the ends.',path:[[20,15],[80,15],[80,85],[20,85],[20,15]]},
 triangle:{name:'triangle',prompt:'Draw a triangle. Three sides. Connect the ends.',path:[[50,15],[85,85],[15,85],[50,15]]},
 line:{name:'stem',prompt:'Draw a line from top to bottom.',path:[[50,15],[50,85]]},
};
// Each part is checked separately, then positioned in the completed picture.
// This is scaffolded shape practice, not a semantic or handwriting assessment.
export const MISSIONS=[
 {id:'tree',name:'Tree',icon:'🌳',parts:[['circle',[15,5,70,58]],['rectangle',[41,58,18,36]]]},
 {id:'triangle',name:'Triangle',icon:'🔺',parts:[['triangle',[10,10,80,80]]]},
 {id:'house',name:'House',icon:'🏠',parts:[['rectangle',[20,40,60,52]],['triangle',[10,5,80,38]],['rectangle',[43,64,16,28]]]},
 {id:'rectangle',name:'Rectangle',icon:'▭',parts:[['rectangle',[15,10,70,80]]]},
 {id:'flower',name:'Flower',icon:'🌼',parts:[['circle',[35,30,30,30]],['circle',[35,5,30,30]],['circle',[60,30,30,30]],['circle',[10,30,30,30]],['line',[47,60,6,35]]]},
 {id:'sun',name:'Sun',icon:'☀️',parts:[['circle',[20,20,60,60]],['line',[47,2,6,15]],['line',[47,83,6,15]]]},
];
export function fitInk(ink,box=[15,15,70,70]){
 const b=inkStats(ink);if(!b)return [];
 return ink.map(s=>s.map(([x,y])=>[box[0]+(b.w?(x-b.x)/b.w:.5)*box[2],box[1]+(b.h?(y-b.y)/b.h:.5)*box[3]]));
}
export const artVoiceLines=()=>[...new Set([...DRAWING_IDEAS,...Object.values(PARTS).map(p=>p.prompt),...DOODLES.map(x=>'Is it a '+x+'?'),...symbolVoiceLines(),'What did you draw?','I am not sure yet. What did you draw?','Thanks for telling me!','Drawing complete!','Your shape is connected!','There is your stem!','Bring the ends together. Small gaps are okay.','Add a little more drawing first.','Try a clear outline. Wobbles are okay.','Try a line from top to bottom. Wobbles are okay.','Try three sides. Wobbles are okay.','Try three sides, with a point at the top.','Try four sides, with a corner at each turn.','Try going around in a round loop.'])];
export function artAction(p,input,now,services={}){
 const fail=m=>{throw Object.assign(Error(m),{status:400});};
 const valid=ink=>validInk(ink)&&ink.reduce((n,s)=>n+s.length,0)<=5000;
 const a=p.art??={history:[],mission:null,lastGuess:null,completed:0};
 const record=row=>{a.history=[...a.history,{at:new Date(now).toISOString(),...row}].slice(-100);};
 if(input.kind==='art_guess'){
  if(!valid(input.strokes))fail('Drawing is too large. Save it, then try a smaller drawing.');
  const mode=input.mode??'auto';if(!GUESS_MODES.includes(mode))fail('Choose a guessing mode.');
  if(!services.recognize)throw Object.assign(Error('Drawing guesses are unavailable. Your drawing is safe.'),{status:503});
  const result=services.recognize(input.strokes,mode);
  a.lastGuess={id:`${p.revision}:${now}`,strokes:input.strokes,...result,mode,childLabel:null};record({kind:'guess',...result,mode});
 }else if(input.kind==='art_label'){
  const g=a.lastGuess;if(!g||g.id!==input.guessId||g.childLabel)fail('Make a new guess first.');
  if(!validArtLabel(input.label))fail('Choose a letter, number from 0 to 100, or drawing label.');
  g.childLabel=input.label;record({kind:'child_label',guessId:g.id,guess:g.label,label:input.label});
 }else if(input.kind==='art_start'){
  if(a.mission&&!a.mission.complete)fail('Finish this drawing first.');
  const index=a.completed%MISSIONS.length;
  a.mission={id:`${p.revision}:${now}`,index,part:0,strokes:[],complete:false,feedback:null};
  record({kind:'mission_start',mission:MISSIONS[index].id});
 }else if(input.kind==='art_part'){
  const m=a.mission;if(!m||m.complete||m.id!==input.missionId||m.part!==input.part)fail('This drawing part has changed.');
  if(!valid(input.strokes))fail('Drawing is too large or invalid.');
  const [kind]=MISSIONS[m.index].parts[m.part],result=checkPart(kind,input.strokes);
  if(input.keep===true){
   const b=inkStats(input.strokes);
   if((m.attempts||0)<2||!b||b.length<12||Math.max(b.w,b.h)<8)fail('Try this part first, then you can keep your version.');
   result.kept=true;result.message='Thanks for telling me!';
  }
  if(!result.ok&&!result.kept)m.attempts=(m.attempts||0)+1;
  m.feedback=result;record({kind:'mission_part',mission:MISSIONS[m.index].id,part:m.part,example:input.example===true,result});
  if(result.ok||result.kept){if(result.kept)m.assistedParts=[...(m.assistedParts||[]),m.part];m.strokes.push(cleanMissionInk(input.strokes));m.part++;m.attempts=0;m.complete=m.part===MISSIONS[m.index].parts.length;if(m.complete){a.completed++;record({kind:'mission_complete',mission:MISSIONS[m.index].id,strokes:m.strokes,assistedParts:m.assistedParts||[]});}}
 }else fail('Unknown drawing action.');
}
