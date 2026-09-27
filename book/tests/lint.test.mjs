import test from 'node:test';
import assert from 'node:assert/strict';
import {safetyIssues,wrongEquations,lintChapter,safeDadLine,tokens,spelledSound} from '../lint.mjs';
import {SOUNDS} from '../plan.mjs';
import {planChapter,chooseCast,chooseProps} from '../plan.mjs';
import {templateChapter} from '../template.mjs';
import {plans,saves,NOW} from './fixtures.mjs';
import {buildLearner} from '../learner.mjs';

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
import {readFileSync} from 'node:fs';
import {actorIdsFor} from '../generate.mjs';
import {layoutActors,normalizeScene} from '../../hub/public/book-scene.mjs';
const library=JSON.parse(readFileSync(new URL('../../hub/public/book-art/library.json',import.meta.url),'utf8'));
const opts=p=>{const ids=actorIdsFor(p,library);p.actorIds=ids;return {extra:['Smithers'],actors:ids.all,dadId:ids.dad};};
test('No clinical, therapy or school-report language, and no staff names (private list)',()=>{
 for(const t of ['The OT came to see him.','He had a meltdown.','His teacher was concerned.','They had a meeting about it.','Big feelings and sensory breaks.','She wrote an evaluation.','He is struggling.'])
  assert.ok(safetyIssues(t).some(i=>i.startsWith('clinical or school-report language')),t);
 assert.deepEqual(safetyIssues('He got the ball, sat in the boat and ate a big hot pizza with Dad.'),[]);
 assert.ok(safetyIssues('Miss Honeybun waved.',{extra:['Honeybun']}).some(i=>i.startsWith('private word')));
 assert.deepEqual(safetyIssues('A brown bear in the wood.',{extra:['Ann Brown','Ella Wood']}),[],'colour and common words stay usable');
});
test('Template chapters pass the lint for both reading levels on many days',()=>{
 for(const p of plans())assert.deepEqual(lintChapter(templateChapter(p,library),p,opts(p)),[],`${p.player} ${p.date}`);
});
test('Plans are deterministic, learning is in beats, and the NO! beat is a real, fixable mistake',()=>{
 for(const p of plans()){
  assert.deepEqual(plans([p.date]).find(x=>x.player===p.player),p);
  const no=p.beats.find(b=>b.kind==='no');assert.notEqual(no.wrong,no.right);assert.ok(no.options.includes(no.right)&&no.options.includes(no.wrong));
  if(p.level==='reader'){const [a,b]=no.display.split(/[×=]/).map(Number);assert.equal(a*b,Number(no.right));assert.notEqual(a*b,Number(no.wrong));assert.ok(p.magic.length>=2);
   const sp=p.beats.find(b=>b.kind==='spell');assert.notDeepEqual(sp.tiles.slice(0,sp.answer.length),sp.answer,'never in order');
   const sg=p.beats.find(b=>b.kind==='signs');assert.ok(sg.options.includes(sg.target));assert.equal(new Set(sg.options).size,sg.options.length);}
  else{const [teach,stones,count]=p.beats;assert.equal(stones.letter,teach.letter);assert.equal(stones.stones.filter(l=>l===teach.letter).length,stones.need);
   assert.ok(count.options.includes(count.answer));assert.ok(p.quest.text.includes(teach.letter));assert.ok(p.quest.hints.length>=3);}
 }
});
test('A young reader collects each friend’s letter key once, then reviews earlier keys in the NO! beat',()=>{
 const young=buildLearner({player:'young',name:'Ada',profile:{age:5,mathTrack:'early'},now:NOW,saves:saves('young')});
 const cast={cast:[{id:'snake',name:'Sparkle',letter:'S',word:'snake',shape:'curl into an S'},{id:'robo',name:'Robo',letter:'R',word:'robot',shape:'draw an R'},{id:'pup',name:'Loop',letter:'L',word:'loop',shape:'make an L'}],children:{young:{fixed:['pup'],rotate:['snake','robo'],perChapter:1}}};
 const a=planChapter(young,{date:'2026-03-10',cast,collection:{keys:[]}});
 const b=planChapter(young,{date:'2026-03-10',cast,collection:{keys:[a.beats[0].letter]}});
 assert.notEqual(b.beats[0].letter,a.beats[0].letter,'a new key next time');
 assert.equal(b.beats.find(x=>x.kind==='no').right,a.beats[0].letter,'the NO! beat reviews the earlier key');
 assert.ok(b.cast.some(c=>c.id===b.beats[0].owner),'the owner of today’s letter is in today’s chapter');
 assert.match(a.beats[0].lines[0][1],/Look, I /);
});
test('Chapter lint catches beats, magic words, speakers, give-aways, Dad and level',()=>{
 const p=plans(['2026-03-10'])[1],o=opts(p),good=templateChapter(p,library);
 const clone=()=>JSON.parse(JSON.stringify(good));
 let c=clone();c.pages=c.pages.filter(x=>x.beat!=='b2');assert.ok(lintChapter(c,p,o).some(i=>i.includes('b2')));
 c=clone();const bi=c.pages.findIndex(x=>x.beat==='b1'),ci=c.pages.findIndex(x=>x.beat==='b3');[c.pages[bi],c.pages[ci]]=[c.pages[ci],c.pages[bi]];assert.ok(lintChapter(c,p,o).some(i=>i.includes('must come after')));
 c=clone();const mp=c.pages.find(x=>x.magic);mp.say.push(['narrator',`It says ${mp.magic.word}.`]);assert.ok(lintChapter(c,p,o).some(i=>i.includes('must not say the magic word')));
 c=clone();c.pages.find(x=>x.magic).magic.word='zebra';assert.ok(lintChapter(c,p,o).some(i=>i.includes('not one of today')));
 c=clone();c.pages[0].say.push([p.player,'I can talk!']);assert.ok(lintChapter(c,p,o).some(i=>i.includes('cannot speak')));
 c=clone();const n=p.beats.find(b=>['share','score'].includes(b.kind));c.pages.find(x=>x.beat===n.id).say.push(['narrator',`It is ${n.answer}.`]);assert.ok(lintChapter(c,p,o).some(i=>i.includes('gives away')));
 c=clone();for(const pg of c.pages){pg.actors=(pg.actors||[]).filter(a=>!a.startsWith(o.dadId));pg.say=pg.say.filter(l=>l[0]!=='dad');}assert.ok(lintChapter(c,p,o).some(i=>i.startsWith('Dad must')));
 c=clone();c.pages[0].say.push(['narrator','And 2 + 2 = 5, said the cat.']);assert.ok(lintChapter(c,p,o).some(i=>i.startsWith('arithmetic mistakes')));
 c=clone();c.pages[0].say.unshift(['narrator','Leo Parker went out.']);assert.ok(lintChapter(c,p,o).some(i=>i.startsWith('looks like a full name')));
 c=clone();c.pages[0].caption='a very long caption with far too many words';assert.ok(lintChapter(c,p,o).some(i=>i.includes('caption')));
 c=clone();c.pages[1].actors=['robot-unicorn'];assert.ok(lintChapter(c,p,o).some(i=>i.includes('unknown actor')));
 const y=plans(['2026-03-10'])[0],yo=opts(y),yc=templateChapter(y,library);yc.pages[0].caption='Hello there';assert.ok(lintChapter(yc,y,yo).some(i=>i.includes('caption must be at most 1 word')));
 assert.deepEqual(lintChapter(null,p),['not a chapter object with pages']);
});
test('Scenes: unknown pictures are replaced, and groups shrink to fit a tall phone screen',()=>{
 const {scene,notes}=normalizeScene({scene:'moon-base',actors:['hero:dance','bo','ghost'],props:['ball:3','ball'],fx:'lasers'},library,{fallbackBg:'forest'});
 assert.equal(scene.bg,'forest');assert.deepEqual(scene.actors,[{id:'hero',pose:'idle'},{id:'bo',pose:'idle'}]);assert.deepEqual(scene.props,[{id:'ball',n:3}]);assert.equal(scene.fx,'none');assert.equal(notes.length,2);
 const art={actors:{a:{h:.5,poses:{idle:{ar:.6}}},b:{h:.5,poses:{idle:{ar:.6}}},c:{h:.5,poses:{idle:{ar:.6}}}}};
 const actors=[{id:'a',pose:'idle'},{id:'b',pose:'idle'},{id:'c',pose:'idle'}];
 const wide=layoutActors(actors,art,{width:1366,height:768}),tall=layoutActors(actors,art,{width:390,height:844});
 assert.equal(wide[0].height,.5,'room to spare on a wide screen');assert.ok(tall[0].height<.5,'smaller on a phone');
 for(const l of [wide,tall]){assert.ok(l[0].left>=0&&l.at(-1).left+l.at(-1).width<=1.0001);for(let i=1;i<l.length;i++)assert.ok(l[i].left>=l[i-1].left+l[i-1].width-1e-9,'no overlap');}
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
  const o=opts(withCast);
  assert.deepEqual(lintChapter(templateChapter(withCast,library),withCast,o),[],who);
  const t=templateChapter(withCast,library);const name=withCast.cast.at(-1).name.replace(/^the /,'');for(const pg of t.pages){pg.say=pg.say.map(([w,x])=>[w,x.split(name).join('someone')]);if(pg.magic)pg.magic.after=pg.magic.after.map(([w,x])=>[w,x.split(name).join('someone')]);}
  assert.ok(lintChapter(t,withCast,o).some(i=>i.startsWith('the friend')),'every friend must appear');}
});
test('A family’s own toy names pass the brand rule only when allowed, and no other brand does',()=>{
 assert.ok(safetyIssues('Little Mario naps.').some(i=>i.startsWith('brand')));
 assert.deepEqual(safetyIssues('Little Mario naps.',{allow:['Mario']}),[]);
 assert.ok(safetyIssues('Little Mario builds with Lego.',{allow:['Mario']}).some(i=>i==='brand: "Lego"'));
 assert.ok(safetyIssues('Mario went to the hospital.',{allow:['Mario']}).some(i=>i.startsWith('illness')),'allowing a name never relaxes other rules');
});

test('Letter sounds are phonemes, never text the voice would spell out ("L L L")',()=>{
 for(const [l,snd] of Object.entries(SOUNDS)){assert.match(snd,/^\[\[[^\]]+\]\]$/,l);assert.equal(spelledSound(snd),null,l);}
 for(const p of plans())for(const b of p.beats)for(const t of [b.spoken,b.notIt,b.tap,b.hint,...(b.lines||[]).map(x=>x[1])].filter(Boolean))assert.equal(spelledSound(t),null,`${p.player} ${b.kind}: ${t}`);
 for(const t of ['Sss! said the snake.','Lll!','Grrr, went the bear.','Zzzz.','Mmm, pizza!'])assert.ok(spelledSound(t),t);
 for(const t of ['Hello, balloon! Coffee and a hiss.','[[sss]] and a hum'])assert.equal(spelledSound(t),null,t);
 const p=plans(['2026-03-10'])[1],o=opts(p),c=templateChapter(p,library);c.pages[0].say.push(['narrator','Sss, went the snake.']);
 assert.ok(lintChapter(c,p,o).some(i=>i.includes('read aloud as letter names')));
});
test('He plays: action pages are required, need a reaction after he acts, and a young soccer fan kicks the letter ball',()=>{
 const p=plans(['2026-03-10'])[0],o=opts(p),good=templateChapter(p,library);
 assert.ok(good.pages.filter(x=>x.action).length>=p.minActions);
 let c=JSON.parse(JSON.stringify(good));c.pages.forEach(x=>{delete x.action;delete x.after;});assert.ok(lintChapter(c,p,o).some(i=>i.startsWith('needs at least')));
 c=JSON.parse(JSON.stringify(good));c.pages.find(x=>x.action).after=[];assert.ok(lintChapter(c,p,o).some(i=>i.includes('needs "after" lines')));
 c=JSON.parse(JSON.stringify(good));c.pages.find(x=>x.action==='drive').props=[];assert.ok(lintChapter(c,p,o).some(i=>i.includes('drive action needs "train"')));
 const young=buildLearner({player:'young',name:'Ada',profile:{age:5,mathTrack:'early',interests:['soccer']},now:NOW,saves:saves('young')});
 const k=planChapter(young,{date:'2026-03-10',profile:{interests:['soccer']}});const b2=k.beats[1];
 assert.equal(b2.kind,'kick-letter');assert.equal(b2.balls.filter(x=>x===b2.letter).length,1);assert.equal(b2.balls.length,3);
 assert.deepEqual(lintChapter(templateChapter(k,library),k,opts(k)),[],'the template handles the kick-letter beat');
});
