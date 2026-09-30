import test from 'node:test';
import assert from 'node:assert/strict';
import {createReleaseLoader} from '../public/release-loader.mjs';

test('A retained page reloads before a new Book can import a stale shared sound module', async () => {
  let loads=0,reloads=0;
  const open=createReleaseLoader({loadedRelease:'release-old',readRelease:async()=> 'release-new',reload:()=>reloads++,load:()=>{loads++;throw new SyntaxError('Missing shared export');}});
  assert.equal(await open(),null);assert.equal(loads,0);assert.equal(reloads,1);
  assert.equal(await open(),null);assert.equal(reloads,1);
});
test('A promotion racing the import reloads; unchanged-release bugs still surface', async () => {
  for(const promotion of [true,false]){
    let reads=0,reloads=0;const failure=new SyntaxError('Missing shared export');
    const open=createReleaseLoader({loadedRelease:'release-old',readRelease:async()=> ++reads===1||!promotion?'release-old':'release-new',reload:()=>reloads++,load:async()=>{throw failure;}});
    if(promotion){assert.equal(await open(),null);assert.equal(reloads,1);}
    else{await assert.rejects(open(),e=>e===failure);assert.equal(reloads,0);}
  }
});
test('Same-release and unmanaged pages share one import; failed checks can retry', async () => {
  for(const loadedRelease of ['release-current','development','']){
    let loads=0;const app={mountBook(){}};
    const open=createReleaseLoader({loadedRelease,readRelease:async()=>loadedRelease,reload:()=>assert.fail('unnecessary reload'),load:async()=>{loads++;return app;}});
    assert.deepEqual(await Promise.all([open(),open()]),[app,app]);assert.equal(loads,1);
  }
  let reads=0,loads=0;
  const open=createReleaseLoader({loadedRelease:'release-current',readRelease:async()=>{if(++reads===1)throw Error('offline');return 'release-current';},reload:()=>assert.fail('offline is not an update'),load:async()=> ++loads});
  await assert.rejects(open(),/offline/);assert.equal(loads,0);assert.equal(await open(),1);
});
