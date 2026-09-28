import test from 'node:test';
import assert from 'node:assert/strict';
import {bookDay,bookMarkdown} from '../recap-book.mjs';

test('Book recap: per-beat tries, first-try right, fast taps, time per page, fork item, hunts', ()=>{
 const chapter={title:'The Wizard Map',pages:[{},{beat:{id:'b1',kind:'signs'}},{beat:{id:'b2',kind:'puzzle',variant:'nines'}},{beat:{id:'b3',kind:'fork',options:[{id:'cave',item:{name:'a dragon scale'}},{id:'lake',item:{name:'a glowing crystal'}}]}},{}]};
 const progress={days:{'2026-09-28':{opens:1,page:5,finished:true,
  results:[{page:1,kind:'signs',misses:0,ms:9000,attempts:1,correct:true,firstTapMs:4200,guess:false},{page:2,kind:'puzzle',misses:2,ms:30000,attempts:3,correct:true,firstTapMs:800,guess:true,hints:2},{page:3,kind:'fork',misses:0,ms:5000,choice:'lake'}],
  dwell:{0:20000,1:15000,2:40000,3:8000,4:12000},hunts:[{id:'F-sound-2026-09-28',startedAt:'x',foundAt:'y',found:4,ms:360000},{id:'R-sound-2026-09-28',startedAt:'x'}]}}};
 const b=bookDay(progress,chapter,'2026-09-28');
 assert.equal(b.reached,5);assert.equal(b.firstTryRight,'1/2');assert.equal(b.guesses,1);assert.equal(b.item,'a glowing crystal');
 assert.deepEqual(b.pageSeconds,{1:20,2:15,3:40,4:8,5:12});assert.equal(b.minutes,2);
 assert.deepEqual(b.hunts,[{id:'F-sound-2026-09-28',found:true,count:4,minutes:6},{id:'R-sound-2026-09-28',found:false}]);
 const nines=b.beats.find(x=>x.variant==='nines');assert.equal(nines.tries,3);assert.equal(nines.firstTry,false);assert.equal(nines.fastTap,true);
 const md=bookMarkdown([{name:'Leo',book:b}]);assert.match(md,/right on the first try 1\/2, 1 fast tap/);assert.match(md,/chose a glowing crystal/);assert.match(md,/nines \(3 tries, hint\)/);assert.match(md,/F-sound-2026-09-28 found 4 in 6 min/);
 assert.equal(bookDay({days:{}},null,'2026-09-28'),null);
});

test('Book recap counts only the kids\' day (06:00-20:00 local)', ()=>{
 const progress={days:{'2026-09-28':{opens:1,page:1,results:[{page:0,kind:'signs',at:'2026-09-28T14:00:00Z',attempts:1,correct:true},{page:1,kind:'puzzle',at:'2026-09-29T01:30:00Z',attempts:2,correct:true}],hunts:[{id:'a',startedAt:'2026-09-28T15:00:00Z'},{id:'b',startedAt:'2026-09-29T02:00:00Z'}]}}};
 const b=bookDay(progress,{pages:[{},{}]},'2026-09-28',{timeZone:'America/New_York'});
 assert.equal(b.beats.length,1);assert.deepEqual(b.hunts.map(h=>h.id),['a']);
});
