#!/usr/bin/env python3
"""Clip-quality check for letter sounds and sound-outs (shared by the family games; numpy + soundfile only).
A good isolated letter sound: long enough to hear (stops >= 0.12 s, h >= 0.20 s, continuants and vowels >= 0.40 s),
played at its full natural length (2026-09-28: no duration cap; with the source excerpt given, the played sound's
active length must be >= 90% of the source's, measured the same way by true_bounds), a natural attack and release (not cut: the first/last 4 ms of the sounding part stay under 25% of its
peak, and the file starts and ends in silence), no clipping, no clicks (no jump straight out of or into digital silence).
A good sound-out ("m... a... t... mat"): three such sounds, then the word; a clean silent stretch (>= 120 ms) between
parts; every sound within about +-10 dB of the word.
CLI:  letter_sound_check.py sound FILE LETTER [SOURCE]  one isolated sound (as it will be played), vs its source excerpt
      letter_sound_check.py folder DIR             every <letter>.wav in a letter-sounds folder
      letter_sound_check.py soundout FILE WORD     one sound-out clip
      letter_sound_check.py voice DIR              every "Sound out <word>." clip in a voice store (manifest.json)
      letter_sound_check.py selftest               synthetic cases (edge clicks, hard onsets/stops, fades, length)
Exit status 1 if anything fails."""
import json, sys
from pathlib import Path
import numpy as np, soundfile as sf
STOPS = set('bcdgkpt')
def min_len(c): return 0.12 if c in STOPS else 0.20 if c == 'h' else 0.40
def load(path):
    x, rate = sf.read(str(path), dtype='float32'); return (x if x.ndim == 1 else x.mean(1)), rate
def segments(x, rate):
    n = int(rate*0.01); k = len(x)//n
    if not k: return []
    e = np.sqrt(np.mean(x[:k*n].reshape(k, n)**2, 1)); on = e > max(0.004, e.max()*0.03); out, i = [], 0
    while i < k:
        if on[i]:
            j = i
            while j < k and (on[j] or on[j:j+12].any()): j += 1
            out.append((i*n, min(len(x), j*n))); i = j
        else: i += 1
    return out
def true_bounds(x, rate):
    """(start, end) in samples of the sound in an excerpt, down to its real release: 20 ms frames (5 ms hop), full band
    and 2.5-8 kHz (bursts, aspiration and fricatives live up there), power-smoothed over 30 ms. A frame is on when either
    band (80 Hz up / 2.5-8 kHz) is >= 8/6 dB over its floor (8th percentile of the excerpt) and within 40 dB of its peak; the sound runs from its
    loudest frame outwards until 60 ms in a row are off. Works on noisy raw excerpts and on denoised, levelled ones."""
    x = np.asarray(x, dtype='float32'); n = int(rate*0.02); h = int(rate*0.005)
    if len(x) < n+h: return 0, len(x)
    k = (len(x)-n)//h; w = np.hanning(n); f = np.fft.rfftfreq(n, 1/rate); hi = (f >= 2500) & (f <= 8000)
    P = np.abs(np.fft.rfft(np.stack([x[i*h:i*h+n]*w for i in range(k)]), axis=1))**2
    sm = lambda v: 10*np.log10(np.convolve(v, np.ones(6)/6, 'same')+1e-14)
    B, H = sm(P[:, f >= 80].sum(1)), sm(P[:, hi].sum(1))     # no voice below 80 Hz: room rumble and thumps never count
    on = ((B >= np.percentile(B, 8)+8) & (B >= B.max()-40)) | ((H >= np.percentile(H, 8)+6) & (H >= H.max()-40))
    if not on.any(): return 0, len(x)
    pk = int(np.argmax(np.where(on, np.maximum(B-B.max(), H-H.max()), -1e9)))
    def walk(step):
        i, off, last = pk, 0, pk
        while 0 <= i < k:
            if on[i]: last, off = i, 0
            else: off += 1
            if off >= 12: break
            i += step
        return last
    return walk(-1)*h, min(len(x), walk(1)*h+n)
def active_length(x, rate):
    a, b = true_bounds(x, rate); return (b-a)/rate
def envelope(x, rate):
    """RMS over 2 ms windows, one value per ms."""
    h = int(rate*0.001); w = 2*h; n = max(1, (len(x)-w)//h+1)
    return np.sqrt(np.array([np.mean(x[k*h:k*h+w]**2) for k in range(n)]))
def clicks(x):
    """A hard cut: a jump straight out of, or straight into, digital silence. The silence is looked for on ONE side of the
    jump (the 24 samples just before it, or just after it), so a click right at the edge of silence is caught."""
    x = np.asarray(x, dtype='float32'); n = 24; z = (np.abs(x) < 1e-4).astype(int); c = np.concatenate([[0], np.cumsum(z)])
    k = np.arange(len(x)-1); step = np.abs(np.diff(x)) > 0.02
    before = (k+1 >= n) & ((c[np.minimum(k+1, len(x))]-c[np.maximum(k+1-n, 0)]) >= n)       # x[k+1-n .. k] all silent
    after = (k+1+n <= len(x)) & ((c[np.minimum(k+1+n, len(x))]-c[k+1]) >= n)               # x[k+1 .. k+n] all silent
    return bool(np.any(step & (before | after)))
def selftest():
    """Synthetic cases (the book agent's edge click included). Returns a list of failures."""
    r = 24000; t = np.arange(int(r*0.5))/r; tone = (0.4*np.sin(2*np.pi*220*t)).astype('float32'); sil = np.zeros(int(r*0.2), 'float32')
    fade = lambda s, a, b: np.concatenate([s[:a]*np.linspace(0, 1, a), s[a:len(s)-b], s[len(s)-b:]*np.linspace(1, 0, b)]).astype('float32')
    edge = np.concatenate([sil, np.float32([0.5]), tone*0.0+0.0, sil]); edge[len(sil)+1:len(sil)+1+len(tone)] = 0   # a lone spike at the silence edge
    hard_in = np.concatenate([sil, np.float32([0.3])+tone[:1]*0, tone, sil]); hard_out = np.concatenate([sil, fade(tone, 480, 1), np.float32([0.3]), sil])
    smooth = np.concatenate([sil, fade(tone, 600, 1200), sil])
    cases = [('lone spike at the edge of silence', clicks(edge), True), ('hard onset out of silence', clicks(hard_in), True),
             ('hard stop into silence', clicks(hard_out), True), ('smooth fades', clicks(smooth), False),
             ('smooth sound passes check_sound', bool(check_sound(smooth, r, 'm')), False),
             ('hard onset fails check_sound', bool(check_sound(hard_in, r, 'm')), True),
             ('too short fails', bool(check_sound(np.concatenate([sil, fade(tone[:int(r*0.15)], 200, 600), sil]), r, 'm')), True),
             ('a vowel trimmed to 60% of its source fails', bool(check_sound(np.concatenate([sil, fade(tone[:int(r*0.3)], 600, 1200), sil]), r, 'a', smooth)), True),
             ('the full-length vowel passes against its source', bool(check_sound(smooth, r, 'a', smooth)), False)]
    return [f'{name}: got {got}, want {want}' for name, got, want in cases if got != want]
def check_part(x, rate, a, b, c, source=None, win=None):
    bad = []; d = (b-a)/rate; s = x[a:b]; pk = float(np.max(np.abs(s))) or 1.0
    if d < min_len(c): bad.append(f'{c}: {d:.2f}s is too short (min {min_len(c)})')
    if source is not None:     # full natural length: never trimmed (vowels and continuants were capped at 0.55-0.60 s)
        lo, hi = win or (0, len(x)); z = np.zeros(int(rate*0.1), 'float32')
        # the played sound in silence (its own levelling sets no floor); the source against its room floor
        mine, src = active_length(np.concatenate([z, x[lo:hi], z]), rate), active_length(source, rate)
        if mine < 0.9*src: bad.append(f'{c}: plays {mine:.2f}s of the source\'s {src:.2f}s (min 90%)')
    # Edges from a 2 ms envelope: a natural attack takes time to rise from 10% to 70% of the sound's level (>= 6 ms for
    # vowels and continuants, >= 1 ms for a stop's burst) and a natural release takes >= 12 ms to fall back.
    lo, hi = max(0, a-int(rate*0.05)), min(len(x), b+int(rate*0.05)); env = envelope(x[lo:hi], rate); m = float(env.max()) or 1.0
    up = np.flatnonzero(env > 0.1*m); t10, t90 = int(up[0]), int(up[-1])
    t70 = t10+int(np.argmax(env[t10:] > 0.7*m)); f70 = t90-int(np.argmax(env[t90::-1] > 0.7*m))
    if t70-t10 < (1 if c in STOPS else 6): bad.append(f'{c}: onset cut ({t70-t10} ms rise)')
    if t90-f70 < 12: bad.append(f'{c}: release cut ({t90-f70} ms fall)')
    return bad
def check_sound(x, rate, c, source=None):
    bad = []
    if float(np.max(np.abs(x))) >= 0.98: bad.append('clipping')
    if float(np.max(np.abs(x[:int(rate*0.005)]))) > 0.01 or float(np.max(np.abs(x[-int(rate*0.005):]))) > 0.01: bad.append('file starts or ends mid-sound')
    seg = segments(x, rate)
    if not seg: return bad+['silent']
    bad += check_part(x, rate, seg[0][0], seg[-1][1], c, source)
    if clicks(x): bad.append('click')
    return bad
def check_soundout(x, rate, word, sources=None):
    bad = []
    if float(np.max(np.abs(x))) >= 0.98: bad.append('clipping')
    seg = segments(x, rate)
    if len(seg) < 4: return bad+[f'{len(seg)} parts, want 3 sounds then the word']
    wa, wb = seg[3][0], seg[-1][1]; wr = float(np.sqrt(np.mean(x[wa:wb]**2)))
    for k, ((a, b), c) in enumerate(zip(seg[:3], word)):
        win = ((seg[k-1][1]+a)//2 if k else 0, (b+seg[k+1][0])//2)     # up to halfway into the silences around it
        bad += check_part(x, rate, a, b, c, (sources or {}).get(c), win); s = x[a:b]; pk = float(np.max(np.abs(s)))
        r = float(np.sqrt(np.mean(s[np.abs(s) > pk*0.05]**2))) if pk else 0
        if not 0.3 < r/max(wr, 1e-6) < 3.0: bad.append(f'{c}: loudness {20*np.log10(max(r,1e-6)/wr):+.0f} dB vs the word')
    for (a0, b0), (a1, b1) in zip(seg, seg[1:]):
        g = np.abs(x[b0:a1]); w = int(rate*0.12)
        if len(g) < w or float(np.min(np.maximum.reduce([g[k:len(g)-w+k+1] for k in range(0, w, 24)]))) > 0.005: bad.append('no clean silence between sounds')
    if clicks(x): bad.append('click at a join')
    return bad
def main(argv):
    mode, *rest = argv; fails = 0; n = 0
    def report(name, bad):
        nonlocal fails, n; n += 1
        if bad: fails += 1; print(name, '->', '; '.join(bad))
    if mode == 'sound': x, r = load(rest[0]); report(rest[0], check_sound(x, r, rest[1], load(rest[2])[0] if len(rest) > 2 else None))
    elif mode == 'soundout': x, r = load(rest[0]); report(rest[0], check_soundout(x, r, rest[1]))
    elif mode == 'folder':
        for f in sorted(Path(rest[0]).glob('?.wav')): x, r = load(f); report(f.name, check_sound(x, r, f.stem))
    elif mode == 'selftest':
        bad = selftest(); print('\n'.join(bad) or 'selftest ok'); return 1 if bad else 0
    elif mode == 'voice':
        d = Path(rest[0]); m = json.loads((d/'manifest.json').read_text())
        for text, url in sorted(m['clips'].items()):
            if text.startswith('Sound out '): x, r = load(d/url.split('/')[-1]); report(text, check_soundout(x, r, text[10:-1]))
    else: print(__doc__); return 2
    print(f'{n} checked, {fails} with problems'); return 1 if fails else 0
if __name__ == '__main__': sys.exit(main(sys.argv[1:]))
