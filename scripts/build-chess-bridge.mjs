// Deterministic bridge from sparse Small steps to validated full-board tactics.
// It copies public CC0 puzzle data under stable lesson IDs and never touches saves.
import {readFile,writeFile} from 'node:fs/promises';
import {BRIDGE_UNITS} from '../hub/public/chess/bridge-curriculum.mjs';

const guided=JSON.parse(await readFile(new URL('../hub/chess-guided.json',import.meta.url),'utf8'));
const stretch=JSON.parse(await readFile(new URL('../hub/chess-puzzles.json',import.meta.url),'utf8'));
const plan=[
 ['steps-real-fork','fork',0],['steps-pull-guard','deflection',0],['steps-remove-guard','capturingDefender',0],
 ['steps-in-between','intermezzo',0],['steps-clear-line','clearance',0],['steps-hidden-attack','discoveredAttack',0],
 ['steps-mate-three','mateIn3',0],['steps-quiet-plan','quietMove',0],['steps-find-defense','defensiveMove',0],
 ['steps-passed-pawn','advancedPawn',0],['steps-rook-ending','rookEndgame',0],['steps-sacrifice','sacrifice',0],
 ['steps-deflection-plus','deflection',15],['steps-guard-plus','capturingDefender',15],['steps-between-plus','intermezzo',15],
 ['steps-mate-plus','mateIn3',15],['steps-defense-plus','defensiveMove',15],['steps-sacrifice-plus','sacrifice',15],
];
const byId=new Map(BRIDGE_UNITS.map(u=>[u.id,u]));
const output={version:1,source:'Lichess puzzle database CC0; validated guided/stretch extracts',units:{}};
const ids=new Set(),fens=new Set();
const copy=(p,id,theme,goal)=>({...p,id,sourceId:p.id,theme,goal,original:false});
for(const [id,sourceTheme,offset] of plan){
 const unit=byId.get(id);if(!unit)throw Error(`Missing curriculum unit ${id}`);
 const practice=guided[sourceTheme].slice(offset,offset+15).map((p,i)=>copy(p,`bridge-${id}-${i+1}`,unit.theme,unit.task));
 const exampleOffset=offset?3:0;
 const examples=stretch[sourceTheme].slice(exampleOffset,exampleOffset+3).map((p,i)=>copy(p,`bridge-example-${id}-${i+1}`,unit.theme,unit.task));
 if(practice.length!==15||examples.length!==3)throw Error(`Incomplete source pool for ${id}`);
 for(const p of [...practice,...examples]){
  if(ids.has(p.id)||fens.has(p.fen))throw Error(`Duplicate bridge drill ${p.id}`);
  ids.add(p.id);fens.add(p.fen);
 }
 output.units[unit.theme]={practice,examples};
}
await writeFile(new URL('../hub/chess-bridge.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(`Built ${ids.size} bridge drills: ${BRIDGE_UNITS.length*15} practice and ${BRIDGE_UNITS.length*3} examples.`);
