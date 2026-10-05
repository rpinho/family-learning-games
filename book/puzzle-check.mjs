// Every number game in a chapter must be well-formed, at the child's level, and SPOKEN in full: whatever the board
// shows (numbers, a sum, a sequence, routes) is also said, so he never has to read a formula to know the question.
// checkBeat(beat) -> list of problems (empty = fine). Used by the chapter lint and the tests.
// Level table (an 8-year-old reader, 2026-09-28): skip counting up to 50; the 9s times table (9 x 1..10);
// remainders only with small objects (at most 20) and at most 5 plates; place value with two-digit numbers;
// the other sums with numbers up to 100.
import {checkChess,checkMaze} from './board-beats.mjs';
const ONES=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const TENS={twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
// The numbers a text says, as digits or words ("forty-five", "twenty-something" counts as its tens digit shown "2?").
export function spokenNumbers(text){const t=String(text).toLowerCase().replace(/\[\[[^\]]*\]\]/g,' ');const out=new Set();
 for(const m of t.matchAll(/\d+/g))out.add(Number(m[0]));
 for(const m of t.matchAll(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](one|two|three|four|five|six|seven|eight|nine))?\b/g))out.add(TENS[m[1]]+(m[2]?ONES.indexOf(m[2]):0));
 for(const m of t.matchAll(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/g))out.add(ONES.indexOf(m[1]));
 for(const m of t.matchAll(/\b(ten|twenty|thirty)-something\b/g))out.add(({ten:1,twenty:2,thirty:3})[m[1]]);
 return out;}
const shownNumbers=text=>[...String(text||'').matchAll(/\d+/g)].map(m=>Number(m[0]));
const text=l=>typeof l==='string'?l:l?.text||'';
export function checkBeat(b){
 const out=[],said=new Set([...spokenNumbers(text(b.spoken)),...spokenNumbers(text(b.ask)),...spokenNumbers(text(b.claim))]);
 const opts=(b.options||[]).map(o=>typeof o==='object'?o.id:String(o));
 if(['puzzle','remainder','share','score','count'].includes(b.kind)){
  if(!opts.includes(String(b.answer)))out.push(`${b.id}: the answer ${b.answer} is not one of the choices`);
  if(new Set(opts).size!==opts.length)out.push(`${b.id}: two choices are the same`);}
 // What the board shows is said.
 const shown=[...shownNumbers(b.display),...(b.lines||[]).flatMap(shownNumbers),...(b.kind==='remainder'||b.kind==='share'?[b.total,b.groups]:[])].filter(n=>Number.isFinite(n));
 const unsaid=shown.filter(n=>!said.has(n));if(unsaid.length&&b.kind!=='no')out.push(`${b.id}: the board shows ${[...new Set(unsaid)].join(', ')} but the question never says it`);
 const v=b.variant||b.kind;
 if(b.kind==='puzzle'&&v==='skip'){const seq=String(b.display).split(', ');const nums=seq.map(Number);const gap=seq.indexOf('?');const step=(nums.find((x,i)=>i>gap&&Number.isFinite(x))-nums[0])/(nums.findIndex((x,i)=>i>gap&&Number.isFinite(x)));
  if(!(step>0)||seq.length<4)out.push(`${b.id}: not a skip-counting sequence (${b.display})`);else{if(Number(b.answer)!==nums[0]+gap*step)out.push(`${b.id}: the missing number is ${nums[0]+gap*step}, not ${b.answer}`);if(nums[0]+(seq.length-1)*step>50)out.push(`${b.id}: skip counting past 50`);}}
 if(b.kind==='puzzle'&&v==='nines'){const m=String(b.display).match(/^9 × (\d+)$/);if(!m)out.push(`${b.id}: the nines puzzle must be "9 × n" (${b.display})`);else{const n=Number(m[1]);if(n<1||n>10)out.push(`${b.id}: 9 × ${n} is outside the 9s table`);if(Number(b.answer)!==9*n)out.push(`${b.id}: 9 × ${n} is ${9*n}, not ${b.answer}`);}}
 if(b.kind==='puzzle'&&v==='lock'){const a=Number(b.answer);if(!(a>=10&&a<40))out.push(`${b.id}: lock number ${a} out of range`);const t=String(b.display).match(/(\d)\?/);if(!t||Number(t[1])!==Math.floor(a/10))out.push(`${b.id}: the lock shows ${b.display} but the answer is ${a}`);}
 if(b.kind==='puzzle'&&(v==='route'||v==='playcard')){const sums=(b.lines||[]).map(l=>shownNumbers(l).reduce((x,y)=>x+y,0));const best=v==='playcard'?Math.max(...sums):Math.min(...sums);
  const i=(b.options||[]).indexOf(b.answer);if(i<0||sums[i]!==best||sums.filter(x=>x===best).length>1)out.push(`${b.id}: the ${v==='playcard'?'longest':'shortest'} route is not ${b.answer} (${sums.join(', ')})`);}
 // board puzzles: the position and the labyrinth are checked by the rules themselves (book/board-beats.mjs)
 if(b.kind==='puzzle'&&v==='points'){const sum=shownNumbers(b.display).reduce((x,y)=>x+y,0);if(Number(b.answer)!==sum)out.push(`${b.id}: the points add up to ${sum}, not ${b.answer}`);}
 if(b.kind==='puzzle'&&v==='ahead'){const s=(b.lines||[]).map(l=>shownNumbers(l).reduce((x,y)=>x+y,0));if(s.length!==2||s[0]===s[1]||Number(b.answer)!==Math.abs(s[0]-s[1])||(s[0]>s[1]?'cream':'dark')!==b.ahead)out.push(`${b.id}: the sides are ${s.join(' and ')}, not ${b.ahead} ahead by ${b.answer}`);}
 if(b.kind==='puzzle'&&v==='captures'){const V={queen:9,rook:5,bishop:3,knight:3,pawn:1},s=k=>(b.captures?.[k]||[]).reduce((x,y)=>x+(V[y]??NaN),0),d=s('dad'),m=s('hero');
  if(!(d>=0&&m>=0)||d===m||b.answer!==`${m>d?'me':'dad'}:${Math.abs(m-d)}`)out.push(`${b.id}: the captures are ${m} for him and ${d} for Dad, not ${b.answer}`);}
 if(b.kind==='puzzle'&&v==='chess')out.push(...checkChess(b));
 if(b.kind==='puzzle'&&v==='maze')out.push(...checkMaze(b));
 // mental division and times facts: inside his tables (2 to 10 times 2 to 10)
 if(b.kind==='puzzle'&&v==='divide'){const m=String(b.display).match(/^(\d+) ÷ (\d+)$/);if(!m)out.push(`${b.id}: the division puzzle must be "a ÷ b" (${b.display})`);else{const [c,d]=[Number(m[1]),Number(m[2])];
  if(c%d!==0)out.push(`${b.id}: ${c} ÷ ${d} does not share out exactly (no remainders)`);else{if(Number(b.answer)!==c/d)out.push(`${b.id}: ${c} ÷ ${d} is ${c/d}, not ${b.answer}`);if(d<2||d>10||c/d<2||c/d>10)out.push(`${b.id}: ${c} ÷ ${d} is outside his tables`);}}}
 if(b.kind==='puzzle'&&v==='times'){const m=String(b.display).match(/^(\d+) × (\d+)$/);if(!m)out.push(`${b.id}: the times puzzle must be "a × b" (${b.display})`);else{const [a,c]=[Number(m[1]),Number(m[2])];
  if(Number(b.answer)!==a*c)out.push(`${b.id}: ${a} × ${c} is ${a*c}, not ${b.answer}`);if(a<2||a>10||c<2||c>10)out.push(`${b.id}: ${a} × ${c} is outside his tables`);}}
 if(b.kind==='no'&&/÷/.test(b.display||'')){const m=String(b.display).match(/(\d+) ÷ (\d+) = (\d+)/);if(m){const q=m[1]/m[2];if(Number(b.right)!==q)out.push(`${b.id}: ${m[1]} ÷ ${m[2]} is ${q}, not ${b.right}`);if(Number(m[3])===q)out.push(`${b.id}: the "wrong" claim is actually right`);}}
 if(b.kind==='share'&&(b.groups>6||b.total>36))out.push(`${b.id}: ${b.total} things on ${b.groups} plates (at most 36 on 6 plates)`);
 if(b.kind==='remainder'){if(b.total>20)out.push(`${b.id}: ${b.total} objects (at most 20)`);if(b.groups>5||b.groups<2)out.push(`${b.id}: ${b.groups} plates (2 to 5)`);if(Number(b.answer)!==b.total%b.groups)out.push(`${b.id}: ${b.total} on ${b.groups} plates leaves ${b.total%b.groups}, not ${b.answer}`);if(b.total%b.groups===0)out.push(`${b.id}: nothing is left over`);}
 if(b.kind==='share'&&(b.total%b.groups!==0||Number(b.answer)!==b.total/b.groups))out.push(`${b.id}: ${b.total} shared by ${b.groups} is not ${b.answer} each`);
 if(b.kind==='score'&&Number(b.answer)!==b.a*b.b)out.push(`${b.id}: ${b.b} × ${b.a} is ${b.a*b.b}, not ${b.answer}`);
 if(b.kind==='no'&&b.pv){const {n,digit}=b.pv;if(n<10||n>99||Math.floor(n/10)!==digit)out.push(`${b.id}: place value must be a two-digit number and its tens digit`);if(Number(b.right)!==digit*10)out.push(`${b.id}: the ${digit} in ${n} is worth ${digit*10}, not ${b.right}`);}
 if(b.kind==='no'&&!b.pv&&/×/.test(b.display||'')){const m=String(b.display).match(/(\d+) × (\d+) = (\d+)/);if(m&&Number(b.right)!==m[1]*m[2])out.push(`${b.id}: ${m[1]} × ${m[2]} is ${m[1]*m[2]}, not ${b.right}`);if(m&&Number(m[3])===m[1]*m[2])out.push(`${b.id}: the "wrong" claim is actually right`);}
 return out;
}
export const checkBeats=beats=>(beats||[]).flatMap(checkBeat);
