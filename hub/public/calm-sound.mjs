// Book feedback only. No ambient files, looping sources or scene audio.
// Wrong answers: a soft wooden tone. Hunt hints: harp plucks.
const NOTES = ['c4', 'd4', 'e4', 'g4', 'a4', 'c5'];
const note_ = e => { try { (globalThis.__calmLog ||= []).push({...e, at: Date.now()}); } catch {} };
export function calmSound() {
  let ctx = null, fx = null, step = 0, muted = false, disposed = false, generation=0; const playing=new Set();
  const raw = new Map(), decoded = new Map();
  const bytes = url => { if (!raw.has(url)) raw.set(url, fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status)))); return raw.get(url); };
  const buffer = url => {
    if (!ctx || disposed) return Promise.reject(new Error('no audio yet'));
    const context = ctx;
    if (!decoded.has(url)) decoded.set(url, bytes(url).then(b => disposed ? null : context.decodeAudioData(b.slice(0))));
    return decoded.get(url);
  };
  function unlock() {
    if (disposed) return;
    try {
      if (!ctx) { const C = globalThis.AudioContext || globalThis.webkitAudioContext; if (!C) return;
        ctx = new C(); fx = ctx.createGain(); fx.gain.value = 0.8; fx.connect(ctx.destination); }
      if (ctx.state === 'suspended') void ctx.resume();
    } catch {}
  }
  function prefetch() {
    const go = () => { if (disposed) return;
      for (const n of NOTES) void bytes(`/calm/harp-${n}.m4a`).catch(() => {});
      void bytes('/calm/soft.m4a').catch(() => {});
    };
    (globalThis.requestIdleCallback || (f => setTimeout(f, 600)))(go, {timeout: 2500});
  }
  async function play(name, gain = 1) {
    if (!ctx || muted || disposed) return;
    const token=generation;const buf = await buffer(`/calm/${name}.m4a`).catch(() => null);
    if (disposed || muted || token!==generation || !ctx || !buf) return;
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf;
    g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.04); s.connect(g); g.connect(fx); playing.add(s);s.onended=()=>playing.delete(s);s.start(); note_({fx: name, gain, attackMs:40});
  }
  return {
    unlock, prefetch,
    cancel(){generation++;for(const s of playing)try{s.stop();}catch{}playing.clear();},
    page({page, background} = {}) { note_({page, background}); },
    pageTurn() { step = 0; },
    pluck() { return play(`harp-${NOTES[Math.min(step++, NOTES.length - 1)]}`, 0.9); },
    soft() { return play('soft', 0.8); },
    mute(on) { muted = !!on;if(muted){generation++;for(const s of playing)try{s.stop();}catch{}playing.clear();} },
    stop() { disposed = true;generation++;playing.clear(); try { void ctx?.close(); } catch {} ctx = null; fx = null; },
  };
}
