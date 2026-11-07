import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {freshSearch,searchAct,makeBoard,boardRule,boardErrors,BANNED} from '../word-search-model.mjs';
import {picture} from '../public/word-blocks/art.mjs';
const words=['CAT','HEN','FISH','SUN','CUP','FOX','MAP','PIN','TIN'];
const context={date:'2026-01-10',words,player:'beginner'};
const solve=p=>{for(const t of p.current.targets)searchAct(p,{type:'select',first:t.cells[0],last:t.cells.at(-1)},context);};
// Deliberately independent scanner: strings from each starting point, no generator helpers.
function scan(grid,n,word){
 const matches=[];
 for(let y=0;y<n;y++)for(let x=0;x<n;x++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  if(!dx&&!dy)continue;let text='',cells=[];
  for(let k=0;k<word.length;k++){const yy=y+k*dy,xx=x+k*dx;if(yy<0||xx<0||yy>=n||xx>=n)break;cells.push(yy*n+xx);text+=grid[yy*n+xx];}
  if(text===word)matches.push({cells,dx,dy});
 }return matches;
}
test('boards grow from small warm-ups toward larger gardens',()=>{
 const p=freshSearch();
 for(let i=0;i<6;i++){
  const expected=i<2?{size:6,count:4}:i<4?{size:7,count:5}:{size:8,count:6};assert.deepEqual(boardRule(p.completed),expected);
  searchAct(p,{type:i?'next':'start'},context);assert.equal(p.current.size,expected.size);assert.equal(p.current.targets.length,expected.count);
  assert.equal(p.completed,i);solve(p);assert.equal(p.current.phase,'finish');assert.equal(p.completed,i+1);
  solve(p);assert.equal(p.completed,i+1,'replayed finds never credit a finish twice');
 }
});
test('3,000 generated boards: target directions, exact unique occurrences and filler safety (independent eight-direction scan)',{timeout:600000},()=>{
 for(let seed=0;seed<1000;seed++)for(const completed of [0,2,4]){
  const rule=boardRule(completed),pool=seed%3===0?['DOG','LOG',...words]:seed%3===1?['DOG','LOG','RUG','MUG','POT','FOX',...words]:words;
  const b=makeBoard({...rule,words:pool,seed:`synthetic-${seed}-${completed}`,date:context.date});
  assert.equal(b.grid.length,rule.size**2);assert.ok(b.grid.every(c=>/^[A-Z]$/.test(c)));assert.deepEqual(boardErrors(b),[]);
  for(const target of b.targets){
   const a=target.cells[0],z=target.cells.at(-1);assert.ok(z>a);assert.ok(Math.floor(a/b.size)===Math.floor(z/b.size)||z%b.size===a%b.size);
   const matches=scan(b.grid,b.size,target.word);assert.equal(matches.length,target.word===[...target.word].reverse().join('')?2:1);
   assert.ok(matches.some(m=>m.cells.join()===target.cells.join()));
   for(const m of matches)assert.ok(m.cells.join()===target.cells.join()||m.cells.toReversed().join()===target.cells.join());
  }
  for(const bad of BANNED)assert.equal(scan(b.grid,b.size,bad).length,0,bad);
 }
});
test('board generation is deterministic by household date, preset and completed-board count',()=>{
 const a=freshSearch(),b=freshSearch();searchAct(a,{type:'start'},context);searchAct(b,{type:'start'},context);assert.deepEqual(a,b);
 const other=freshSearch();searchAct(other,{type:'start'},{...context,player:'explorer'});assert.notDeepEqual(a.current.grid,other.current.grid);
 const next=freshSearch();searchAct(next,{type:'start'},{...context,date:'2026-01-11'});assert.notDeepEqual(a.current.grid,next.current.grid);
});
test('start pins unfinished and finished boards across household dates; only explicit next replaces a finished board',()=>{
 const p=freshSearch();searchAct(p,{type:'start'},context);const original=structuredClone(p);
 assert.throws(()=>searchAct(p,{type:'next'},context));searchAct(p,{type:'start'},{...context,date:'2026-01-11'});assert.deepEqual(p,original);
 solve(p);const done=structuredClone(p);searchAct(p,{type:'start'},{...context,date:'2026-01-12'});assert.deepEqual(p,done);
 searchAct(p,{type:'next'},{...context,date:'2026-01-12'});assert.equal(p.current.date,'2026-01-12');assert.notDeepEqual(p.current.grid,original.current.grid);
});
test('wrong, backwards, partial and diagonal selections let go without a revision, penalty or progress change',()=>{
 const p=freshSearch();searchAct(p,{type:'start'},context);const original=structuredClone(p),t=p.current.targets[0];
 for(const [first,last]of [[t.cells.at(-1),t.cells[0]],[t.cells[0],t.cells[1]],[0,7],[0,0]]){
  assert.equal(searchAct(p,{type:'select',first,last},context).word,null);assert.deepEqual(p,original);
 }
 for(const value of [-1,36,1.5,null,'2'])assert.throws(()=>searchAct(p,{type:'select',first:value,last:0},context));
});
test('safety audit detects accidental target repeats, diagonal targets and rude filler backwards or down',()=>{
 const b=makeBoard({...boardRule(0),words,seed:'audit',date:context.date});
 const duplicate=structuredClone(b);duplicate.grid.fill('Q');duplicate.targets=[{word:'CAT',cells:[0,1,2]}];duplicate.targets[0].cells.forEach((n,i)=>duplicate.grid[n]='CAT'[i]);
 for(const cells of [[6,7,8],[7,14,21],[3,9,15]]){const d=structuredClone(duplicate);cells.forEach((n,i)=>d.grid[n]='CAT'[i]);assert.ok(boardErrors(d).includes('extra-target'));}
 for(const cells of [[12,13,14,15],[30,24,18,12]]){const d=structuredClone(duplicate);cells.forEach((n,i)=>d.grid[n]='HATE'[i]);assert.ok(boardErrors(d).includes('vocabulary'));}
 const reverse=structuredClone(duplicate);reverse.targets[0].cells.reverse();assert.ok(boardErrors(reverse).includes('direction'));
});
test('unsafe target packs and ambiguous substrings cannot create an unvalidated board',()=>{
 assert.throws(()=>makeBoard({...boardRule(0),words:['HATE'],seed:'unsafe',date:context.date}));
 const b=makeBoard({...boardRule(0),words:['CAT','FISH','SUN','HEN','MUG'],seed:'substring',date:context.date});assert.deepEqual(boardErrors(b),[]);
});
test('complete lazy route payload stays small and never requests a microphone',async()=>{
 const paths=['word-search/app.mjs','word-search/style.css','word-search.svg','word-blocks/art.mjs'];let bytes=0;
 for(const path of paths){const buffer=await readFile(new URL('../public/'+path,import.meta.url));bytes+=gzipSync(buffer).length;assert.doesNotMatch(buffer.toString(),/getUserMedia/);}
 assert.ok(bytes<30*1024,`${bytes} gzip bytes`);
});
