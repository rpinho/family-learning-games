import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {spokenIssues,chapterSpokenIssues} from '../spoken-lint.mjs';
import {spokenForm,spokenLine} from '../../hub/public/spoken-form.mjs';
import {episodeLines} from '../episodes/generate.mjs';
import {generateOne} from '../generate.mjs';
import {assemble,voicesFor} from '../assemble.mjs';
import {templateChapter} from '../template.mjs';
import {worldLines} from '../../hub/world-service.mjs';
import {CASTLE,SMALL} from '../../hub/public/world-definitions.mjs';
import {bookPaths,readProfiles} from '../paths.mjs';
import {deployment,NOW,plans} from './fixtures.mjs';
// Screen notation a narrator would otherwise read aloud as "slash", "arrow" and "plus".
const BUG='Example: S + U + N → sun.\nWhich picture matches the sounds /k/ /a/ /t/?';

test('the lint fails on screen notation the narrator would read literally',()=>{
 assert.deepEqual(spokenIssues(BUG).sort(),['arrow','bare symbol','math symbol','phoneme slashes (/x/)','screen label "Example:"'].sort());
 for(const bad of ['Which number fills the gap: 4, 6, 8, ___, 12?','Example: 11 − 4 = 7.','17 > 14','What comes next in 🌼, 🍃?','12 - 2','Tap /m/.','red → blue'])assert.ok(spokenIssues(bad).length,bad);
 // Numbers spoken as words are fine; recorded letter sounds are Kokoro phonemes in [[...]].
 for(const ok of ['What is 12 minus 2?','Listen: [[k]]... [[æ]]... [[t]]. Which picture is that?','Ready! Let’s help together.'])assert.deepEqual(spokenIssues(ok),[],ok);
});

test('spokenForm turns notation into words and letter sounds into the recorded sounds',()=>{
 const said=spokenForm(BUG);assert.deepEqual(spokenIssues(said),[]);
 assert.match(said,/\[\[k\]\]\.\.\. \[\[æ\]\]\.\.\. \[\[t\]\]/);assert.doesNotMatch(said,/slash|arrow|plus/i);
 assert.match(said,/^For example, \[\[s\]\]\.\.\. \[\[ʌ\]\]\.\.\. \[\[n\]\] makes sun\./);
 assert.equal(spokenForm('Example: 11 − 4 = 7.'),'For example, 11 minus 4 is 7.');
 assert.equal(spokenForm('17 > 14'),'17 is more than 14');
 assert.equal(spokenForm('3 × 4 + 2'),'3 times 4 plus 2');
 assert.equal(spokenForm('🌼'),'flower');
 assert.equal(spokenForm('Find [[pˈɪp]] + friends'),'Find [[pˈɪp]] plus friends','existing phoneme spans are kept as written');
 assert.deepEqual(spokenLine('2 × 3 = 6',{voice:'v'}),{text:'2 times 3 is 6',shown:'2 × 3 = 6',voice:'v'});
 assert.deepEqual(spokenLine('Plain words.',{voice:'v'}),{text:'Plain words.',voice:'v'},'a clean line is unchanged (same clip)');
});

test('Book lines speak the spoken form and keep the notation on screen',()=>{
 const library=JSON.parse(readFileSync(new URL('../../hub/public/book-art/library.json',import.meta.url),'utf8'));
 const plan=plans(['2026-03-10'])[1],story=templateChapter(plan,library);
 story.pages[0].say=[['narrator','Example: 8 + 5 = 13.']];
 const line=assemble(story,plan,{library}).pages[0].say.find(l=>l.shown==='Example: 8 + 5 = 13.');
 assert.ok(line,'the screen keeps the notation');assert.equal(line.text,'For example, 8 plus 5 is 13.');
});

test('episode lines speak the spoken form and show the notation',async()=>{
 const ep=JSON.parse(await readFile(new URL('../episodes/fixtures/early.json',import.meta.url),'utf8'));
 ep.intro='Example: 2 + 3 = 5. Let’s go!';
 const lines=episodeLines(ep,{voices:voicesFor({cast:[]})});
 assert.equal(lines.intro.shown,'Example: 2 + 3 = 5. Let’s go!');assert.equal(lines.intro.text,'For example, 2 plus 3 is 5. Let’s go!');
 assert.deepEqual(Object.entries(lines).filter(([,l])=>spokenIssues(l.text).length).map(([k,l])=>k+': '+l.text),[]);
});

test('World lines (castle and small worlds) are spoken forms',()=>{
 for(const def of [CASTLE,SMALL])for(const [k,l]of Object.entries(worldLines({},def,{})))assert.deepEqual(spokenIssues(l.text),[],k+': '+l.text);
});

for(const player of ['young','older'])test(`${player}: a generated chapter has no notation in any narrated line`,async()=>{
 const {env}=await deployment(),paths=bookPaths(env),profiles=readProfiles(paths);
 const r=await generateOne(player,{paths,profiles,date:'2026-03-10',noVoice:true,noLLM:true,review:true,now:NOW,log:()=>{}});
 assert.deepEqual(chapterSpokenIssues(r.chapter).map(i=>i.path+': '+i.text),[]);
});
