import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {buildLearner,cookieLevel,wordTallies,wordStatus,detectTricks,playOn,sageSummary} from '../learner.mjs';
import {learnerFor,wordBreakRows,writeLearner} from '../build-learner.mjs';
import {bookPaths,readProfiles} from '../paths.mjs';
import {saves,deployment,NOW} from './fixtures.mjs';

test('Learner model: letters, words, maths, tricks, story and dad lines from synthetic saves',()=>{
 const s=saves('older');
 const m=buildLearner({player:'older',name:'Robin',profile:{age:8,interests:['robots'],companions:[{name:'Gizmo'}],tricks:[{id:'sentence-position',text:'guesses by position'}]},now:NOW,saves:s,
  wordBreaks:[{kind:'sentence',answer:'Bo and Max run to the net.',misses:9,ms:6000},{kind:'sentence',answer:'A red bug sat on Bo.',misses:8,ms:5000},{kind:'sentence',answer:'Is Bo in the net?',misses:6,ms:4000}],
  notes:[{date:'2026-03-09',at:new Date(NOW-5*36e5).toISOString(),text:'Robin scored a goal',player:'older'},{date:'2026-03-09',at:new Date(NOW-5*36e5).toISOString(),text:'Ada drew a whale',player:'young'},{date:'2026-03-01',at:'2026-03-01T10:00:00Z',text:'old',player:null}],
  playDate:'2026-03-09',timeZone:'UTC'});
 assert.equal(m.schema,'family-book-learner-1');
 assert.deepEqual(m.companions,[{name:'Gizmo'}]);
 assert.ok(m.literacy.lettersMastered.includes('A'));
 assert.deepEqual(m.literacy.wordsMastered,[],'save counters cannot establish word mastery');
 assert.deepEqual(m.literacy.wordsStuck,[],'save counters cannot establish low first-try reading');
 assert.equal(m.math.track,'facts');assert.deepEqual(m.math.cookies,{level:1,stage:'own'});
 assert.deepEqual(m.math.factsStuck,['6x7']);
 const trick=m.tricks.find(t=>t.id==='sentence-position');assert.equal(trick.source,'parent');assert.deepEqual(trick.evidence,{sentenceBreaks:3,tapThrough:3});
 assert.ok(m.tricks.some(t=>t.id==='harder-tapping'),'rapid "harder" taps are noticed');
 assert.deepEqual(m.recent.dadLines.map(l=>l.text),['Robin scored a goal'],'only this child’s and recent lines');
 assert.ok(m.recent.play.some(l=>l.startsWith('Sling Shot: 1 round')));
 assert.ok(m.interests.includes('robots'));
});
test('Young learner: early maths track, letters still being learned, no invented tricks',()=>{
 const m=buildLearner({player:'young',name:'Ada',profile:{age:5,mathTrack:'early'},now:NOW,saves:{...saves('young'),'maze-garden':{history:[]}}});
 assert.equal(m.math.track,'early');assert.equal(m.math.countTo,7);assert.deepEqual(m.math.takeAwayStuck,['9-2']);
 assert.equal(m.literacy.track,'letters');assert.ok(m.literacy.learning.includes('F'));assert.ok(!m.literacy.learning.includes('A'),'mastered letters are not "learning"');
 assert.deepEqual(m.tricks,[]);
});
test('Missing saves degrade to defaults, never throw',()=>{
 const m=buildLearner({player:'x',name:'X',now:NOW,saves:{}});
 assert.equal(m.math.source,'none');assert.equal(m.literacy.sentenceLevel,1);assert.deepEqual(m.stuck.filter(s=>s.area==='words'),[]);
});
test('Word tallies and cookie ladder are pure and bounded',()=>{
 const t=wordTallies({lq:{foundation:{skills:{'Bad Word!':{hits:9}}}}});assert.deepEqual(t,{});
 assert.deepEqual(wordStatus({a1:{hits:0,errors:0}}),{mastered:[],stuck:[]});
 assert.equal(cookieLevel({history:[]}).level,1);
 assert.deepEqual(detectTricks({wordBreaks:[{kind:'sentence',answer:'A b c',misses:0,ms:9000}]}),[]);
 assert.deepEqual(playOn({date:'2026-03-09',timeZone:'UTC'}),[]);
});
test('Builder reads saves and logs without changing them, and writes a private model file',async()=>{
 const {root,env}=await deployment();const paths=bookPaths(env),profiles=readProfiles(paths);
 const file=join(root,'data','letter-quest','older.json'),before=await readFile(file,'utf8'),mtime=(await stat(file)).mtimeMs;
 const rows=await wordBreakRows(paths.data['maze-garden'],'older',{now:NOW});assert.equal(rows.length,3);assert.equal(rows[2].misses,6);
 const m=await learnerFor('older',{paths,profiles,now:NOW,chapterDate:'2026-03-10'});
 assert.equal(m.name,'Robin');assert.equal(m.recent.yesterday.date,'2026-03-09');assert.equal(m.literacy.wordLevel,1);
 assert.equal(m.tricks.find(t=>t.id==='sentence-position').evidence.tapThrough,3);
 const young=await learnerFor('young',{paths,profiles,now:NOW,chapterDate:'2026-03-10'});
 assert.ok(young.recent.play.some(l=>/Make-a-Maze/.test(l)),'hub opens become play lines');
 const out=await writeLearner(m,join(root,'learner'));
 assert.equal(((await stat(out)).mode&0o777),0o600);
 assert.equal(await readFile(file,'utf8'),before);assert.equal((await stat(file)).mtimeMs,mtime);
});
test('Outside tutor file (family-sage-1) is summarised read-only; absent or foreign files are ignored',()=>{
 const sage={schema:'family-sage-1',sessions:3,lastSession:'2026-03-09T10:00:00Z',worked:['Counting I'],
  mastered:['Counting I: Map numeral to quantity'],practising:[{area:'Place Value',skill:'State digit place value'}],
  recentMisses:[{area:'Place Value',target:'Worth of tens digit',note:'face value',extra:'dropped'}]};
 const m=buildLearner({player:'older',name:'Robin',profile:{age:8},now:NOW,saves:saves('older'),sage});
 assert.deepEqual(m.sage.mastered,['Counting I: Map numeral to quantity']);
 assert.deepEqual(m.sage.practising,['Place Value: State digit place value']);
 assert.deepEqual(m.sage.recentMisses,[{area:'Place Value',target:'Worth of tens digit',note:'face value'}]);
 assert.ok(m.stuck.some(s=>s.area==='sage'&&s.detail.includes('State digit place value')));
 assert.equal(buildLearner({player:'x',name:'X',now:NOW,saves:{}}).sage,null);
 assert.equal(sageSummary({schema:'other',mastered:['x']}),null);
});
