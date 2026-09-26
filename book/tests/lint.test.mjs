import test from 'node:test';
import assert from 'node:assert/strict';
import {safetyIssues,wrongEquations,lintChapter,safeDadLine,tokens} from '../lint.mjs';
import {planChapter} from '../plan.mjs';
import {templateChapter} from '../template.mjs';
import {plans} from './fixtures.mjs';

test('Safety lint flags every forbidden category',()=>{
 const cases={'violence':'The knight had a sword.','scary':'A scary ghost appeared.','death or loss':'The fish died.','abuse or danger':'A stranger gave him candy.','illness or medical':'She went to the hospital.','grandparents':'Grandma baked bread.','brand':'They built a Lego castle.','personal data':'Call 555-123-4567 today.'};
 for(const [label,text] of Object.entries(cases))assert.ok(safetyIssues(text).some(i=>i.startsWith(label)),`${label}: ${text}`);
 assert.ok(safetyIssues('Her hand felt numb.').length,'no medical symptoms');
 assert.ok(safetyIssues('Hi Smithers',{extra:['Smithers']}).some(i=>i.startsWith('private word')));
});
test('Safety lint does not trip on ordinary game words',()=>{
 for(const t of ['He took a shot at goal and scored!','What number comes next?','I’ll still kick the ball.','The robot beat the clock.','Bo shared the cookies fairly.','They hit the target with the sling.'])assert.deepEqual(safetyIssues(t),[],t);
});
test('Arithmetic checker finds only wrong statements',()=>{
 assert.deepEqual(wrongEquations('3 × 4 = 12, 12 ÷ 3 = 4, 7 + 5 = 12, 9 - 2 = 7'),[]);
 assert.deepEqual(wrongEquations('5 × 4 = 25 and 2 + 2 = 4'),['5 × 4 = 25']);
});
test('Template chapters pass the lint for both reading levels on many days',()=>{
 for(const p of plans())assert.deepEqual(lintChapter(templateChapter(p),p,{extra:['Smithers']}),[],`${p.player} ${p.date}`);
});
test('Plans are deterministic and their mistakes are real, fixable mistakes',()=>{
 for(const p of plans()){
  assert.deepEqual(plans([p.date]).find(x=>x.player===p.player),p);
  const m=p.mistake;assert.notEqual(m.wrong,m.right);assert.ok(m.fix.options.includes(m.right));
  if(m.kind==='math'){assert.equal(wrongEquations(m.claim).length,1);const [a,b]=m.claim.split(/[×=]/).map(Number);assert.equal(a*b,Number(m.right));}
  else{assert.equal(p.teach.letter,m.right,'teach first, then the mistake contradicts what was taught');assert.ok(p.teach.word.toUpperCase().startsWith(m.right));}
  for(const c of p.challenges){const it=c.item;assert.ok(it.spoken);if(it.options)assert.ok(it.options.map(String).includes(String(it.answer)),c.id);if(it.kind==='sentence')assert.notDeepEqual(it.tiles,it.answer,'never in sentence order');}
 }
});
test('Chapter lint catches structure, level, answer give-aways and unplanned mistakes',()=>{
 const p=plans(['2026-03-10'])[1],good=templateChapter(p);
 const clone=()=>JSON.parse(JSON.stringify(good));
 let c=clone();c.pages=c.pages.filter(x=>x.challenge!=='c2');assert.ok(lintChapter(c,p).some(i=>i.includes('c2')));
 c=clone();c.pages.find(x=>x.mistake).text='Gizmo was very sure.';assert.ok(lintChapter(c,p).some(i=>i.includes('must contain exactly')));
 c=clone();c.pages[0].text+=' And 2 + 2 = 5, said the cat.';assert.ok(lintChapter(c,p).some(i=>i.startsWith('unplanned arithmetic')));
 c=clone();const math=p.challenges.find(x=>x.item.kind==='math');c.pages.find(x=>x.challenge===math.id).text+=` It is ${math.item.answer}.`;assert.ok(lintChapter(c,p).some(i=>i.includes('gives away')));
 c=clone();const s=p.challenges.find(x=>x.item.kind==='sentence');c.pages.find(x=>x.challenge===s.id).text+=' '+s.item.sentence;assert.ok(lintChapter(c,p).some(i=>i.includes('writes out the sentence')));
 c=clone();c.pages[0].text='Leo Smithers went out. '+c.pages[0].text;assert.ok(lintChapter(c,p,{extra:['Smithers']}).some(i=>i.startsWith('private word')));
 c=clone();c.pages[0].text='Leo Parker went out. '+c.pages[0].text;assert.ok(lintChapter(c,p).some(i=>i.startsWith('looks like a full name')));
 c=clone();c.pages=c.pages.slice(0,5);assert.ok(lintChapter(c,p).some(i=>/story has \d+ words/.test(i)));
 c=clone();c.pages[0].scene='🔫';assert.ok(lintChapter(c,p).some(i=>i.includes('scene')));
 const y=plans(['2026-03-10'])[0],yc=templateChapter(y);yc.pages=yc.pages.filter(x=>!x.teach);assert.ok(lintChapter(yc,y).some(i=>i.includes('teach')));
 assert.deepEqual(lintChapter(null,p),['not a chapter object with pages']);
});
test('Dad’s line is used only when it is safe',()=>{
 assert.equal(safeDadLine('we built the robot track'),'we built the robot track');
 assert.equal(safeDadLine('grandma was in the hospital'),null);
 assert.equal(safeDadLine(''),null);
 assert.deepEqual(tokens('"5 × 4 = 25!"'),['5','4','25']);
});
