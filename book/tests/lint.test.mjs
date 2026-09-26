import test from 'node:test';
import assert from 'node:assert/strict';
import {safetyIssues,wrongEquations,lintChapter,safeDadLine,tokens} from '../lint.mjs';
import {planChapter,chooseCast,chooseProps} from '../plan.mjs';
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
test('Cast: each child’s own toys, fixed friends every chapter, a rotating few, props, and a shared fallback',()=>{
 const cast={cast:[{id:'bear',name:'Bear'},{id:'owl',name:'Captain Owl'},{id:'fox',name:'Fox'},{id:'cat',name:'the Twin Cats'},{id:'dragon',name:'Dragon'}],props:[{id:'kite',name:'the kite',kind:'a red kite'}],
  children:{older:{fixed:['dragon','fox'],rotate:[],perChapter:0},young:{fixed:['bear'],rotate:['owl','cat'],perChapter:1,props:['kite']}}};
 const [y,o]=plans(['2026-03-10']);
 assert.deepEqual(chooseCast({player:'older'},{date:'2026-03-10',cast}).map(c=>c.id),['dragon','fox']);
 const young=chooseCast({player:'young'},{date:'2026-03-10',cast});assert.equal(young[0].id,'bear');assert.equal(young.length,2);assert.ok(['owl','cat'].includes(young[1].id));
 assert.deepEqual(chooseCast({player:'young'},{date:'2026-03-10',cast}),young,'deterministic per date');
 assert.deepEqual(chooseProps({player:'young'},cast).map(p=>p.id),['kite']);
 assert.equal(chooseCast({player:'nobody'},{date:'2026-03-10',cast:{cast:cast.cast,perChapter:{early:3}},level:'early'}).length,3,'shared cast when ownership is unknown');
 assert.equal(chooseCast({player:'x',companions:[{name:'Pip',kind:'k'}]},{date:'d',cast:null})[0].name,'Pip');
 for(const [p,who] of [[y,'young'],[o,'older']]){const withCast={...p,cast:chooseCast({player:who},{date:p.date,cast})};withCast.companion=withCast.cast[0];
  assert.deepEqual(lintChapter(templateChapter(withCast),withCast),[],who);
  const t=templateChapter(withCast);const name=withCast.cast.at(-1).name.replace(/^the /,'');for(const pg of t.pages)pg.text=pg.text.split(name).join('someone');
  assert.ok(lintChapter(t,withCast).some(i=>i.startsWith('the friend')),'every friend must appear');}
});
test('A family’s own toy names pass the brand rule only when allowed, and no other brand does',()=>{
 assert.ok(safetyIssues('Little Mario naps.').some(i=>i.startsWith('brand')));
 assert.deepEqual(safetyIssues('Little Mario naps.',{allow:['Mario']}),[]);
 assert.ok(safetyIssues('Little Mario builds with Lego.',{allow:['Mario']}).some(i=>i==='brand: "Lego"'));
 assert.ok(safetyIssues('Mario went to the hospital.',{allow:['Mario']}).some(i=>i.startsWith('illness')),'allowing a name never relaxes other rules');
});
