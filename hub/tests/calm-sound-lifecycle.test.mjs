import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../public/calm-sound.mjs', import.meta.url), 'utf8')).replaceAll('export ', '');
function setup({pendingFetch = false, pendingDecode = false} = {}) {
  const handlers = new Map(), activity = [], idle = [];
  const speech = {
    addEventListener(name, fn) { handlers.set(name, fn); },
    removeEventListener(name, fn) { if (handlers.get(name) === fn) handlers.delete(name); },
    dispatch(name) { handlers.get(name)?.(); },
  };
  let fetchDone, decodeDone;
  class Context {
    state = 'running'; currentTime = 7; destination = {};
    constructor() { activity.push('context'); }
    createGain() { return {gain: {setValueAtTime(){},linearRampToValueAtTime(value, at){activity.push(['ramp', value, at]);},cancelAndHoldAtTime(){},setTargetAtTime: value => activity.push(['gain', value])}, connect() {}}; }
    createBufferSource() { activity.push('source'); return {connect() { activity.push('source-connected'); }, start() { activity.push('start'); }, stop() { activity.push('stop'); }}; }
    decodeAudioData() { activity.push('decode'); return pendingDecode ? new Promise(r => { decodeDone = r; }) : Promise.resolve({duration: 10}); }
    close() { activity.push('close'); return Promise.resolve(); }
  }
  const context = vm.createContext({AudioContext: Context, setTimeout, clearTimeout, console,
    requestIdleCallback: fn => idle.push(fn),
    fetch: () => { activity.push('fetch'); return Promise.resolve({ok: true,
      arrayBuffer: () => pendingFetch ? new Promise(r => { fetchDone = r; }) : Promise.resolve(new ArrayBuffer(1))}); }});
  vm.runInContext(source, context);
  const sound = context.calmSound({speech});
  return {sound, speech, activity, idle, handlers,
    finishFetch: () => fetchDone(new ArrayBuffer(1)), finishDecode: () => decodeDone({duration: 10})};
}
const tick = () => new Promise(r => setImmediate(r));

test('Leaving cancels idle prefetch and never reopens audio', async () => {
  const {sound, speech, activity, idle, handlers} = setup();
  sound.unlock(); await sound.soft(); sound.prefetch(); sound.stop(); sound.stop();
  const closed = activity.slice();
  for (const event of ['pause', 'ended', 'emptied', 'playing']) speech.dispatch(event);
  sound.mute(true); sound.unlock(); await sound.soft();
  idle.forEach(fn => fn()); await tick();
  assert.equal(handlers.size, 0); assert.deepEqual(activity, closed);
});
for (const stage of ['fetch', 'decode']) test(`Leaving during ${stage} cancels pending effects`, async () => {
  const rig = setup({pendingFetch: stage === 'fetch', pendingDecode: stage === 'decode'});
  rig.sound.unlock(); const pending = rig.sound.soft();
  await tick(); rig.sound.stop(); const closed = rig.activity.slice();
  if (stage === 'fetch') rig.finishFetch(); else rig.finishDecode();
  await pending; await tick(); assert.deepEqual(rig.activity, closed);
});

test('Wrong-answer gain rises from zero over 40 ms, never an abrupt attack',async()=>{
 const rig=setup();rig.sound.unlock();await rig.sound.soft();
 assert.ok(rig.activity.some(x=>Array.isArray(x)&&x[0]==='ramp'&&x[1]===0.8&&Math.abs(x[2]-7.04)<1e-6));
});
