"""The calm sounds (shared with the family hub's calm Book; Word Arcade uses night, meadow, snow, the harp and soft), made from scratch (no recorded or copied audio): quiet ambient beds, one per kind of scene,
harp plucks in C major for right answers, and one soft neutral tone for a wrong one.

Ambient beds (48 s, seamless loop, ~70 BPM feel, warm and dark, normalised to -20 LUFS, AAC 64 kb/s mono, < 1 MB):
  meadow  wind in grass, a slow pad (C - F - Am - G), a far bird now and then
  water   a stream (shaped brown noise), soft drops, the pad
  night   a low pad, crickets far away, a breath of wind
  castle  a hall: a low drone, the pad in a long stone reverb, a slow bell
  forest  leaves in the wind, several quiet birds, the pad
Plucks: Karplus-Strong string (a plucked harp), C4..C5 and a C-major strum. Soft: a muted wooden tone (G3).
Usage: python make-calm-sounds.py <out dir>   (needs numpy, soundfile, ffmpeg)"""
import os, subprocess, sys, tempfile
import numpy as np, soundfile as sf
R = 44100; rng = np.random.default_rng(20260928); out = sys.argv[1] if len(sys.argv) > 1 else 'hub/public/calm'
os.makedirs(out, exist_ok=True)
LOOP, TAIL = 48.0, 4.0                     # seconds; the tail is crossfaded into the start (seamless)
N = int((LOOP + TAIL) * R); t = np.arange(N) / R
BEAT = 60 / 70

def shape_noise(n, f_lo, f_hi, tilt=0.0):
    """Noise with energy between f_lo and f_hi (soft edges); tilt < 0 darkens (brown-ish)."""
    X = np.fft.rfft(rng.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / R)
    m = 1 / (1 + (f_lo / np.maximum(f, 1)) ** 4) / (1 + (f / f_hi) ** 4) * np.maximum(f, 20) ** tilt
    y = np.fft.irfft(X * m, n); return y / (np.abs(y).max() + 1e-9)

def lowpass(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / R); return np.fft.irfft(X / (1 + (f / fc) ** 4), len(x))

def lfo(rate, lo, hi, phase=0.0):
    return lo + (hi - lo) * (0.5 + 0.5 * np.sin(2 * np.pi * rate * t + phase))

def env(n, a, r):
    e = np.ones(n); na, nr = int(a * R), int(r * R)
    e[:na] = np.linspace(0, 1, na) ** 2; e[-nr:] *= np.linspace(1, 0, nr) ** 2; return e

def note(freq, dur, amp=1.0, bright=0.25):
    n = int(dur * R); tt = np.arange(n) / R
    y = np.sin(2 * np.pi * freq * tt) + bright * np.sin(4 * np.pi * freq * tt) + 0.08 * np.sin(6 * np.pi * freq * tt)
    return amp * y * env(n, min(1.2, dur / 3), min(1.6, dur / 2.5))

def reverb(x, secs=2.5, mix=0.35):
    n = int(secs * R); ir = rng.standard_normal(n) * np.exp(-np.arange(n) / R * (6.9 / secs)); ir = lowpass(ir, 3500)
    L = len(x) + n; y = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[:len(x)]
    y /= np.abs(y).max() + 1e-9; return (1 - mix) * x / (np.abs(x).max() + 1e-9) + mix * y

HZ = lambda m: 440 * 2 ** ((m - 69) / 12)
CHORDS = [[48, 55, 64, 71], [41, 53, 60, 69, 76], [45, 52, 60, 67], [43, 50, 59, 64]]   # Cmaj7, Fmaj9, Am7, G6

def pad(octave=0, amp=1.0):
    y = np.zeros(N); step = 4 * BEAT; k = 0; s = 0.0
    while s < LOOP + TAIL:
        for m in CHORDS[k % 4]:
            seg = note(HZ(m + 12 * octave), step * 1.35, 1 / len(CHORDS[k % 4]))
            a = int(s * R); b = min(N, a + len(seg)); y[a:b] += seg[:b - a]
        s += step; k += 1
    return amp * lowpass(y, 1800)

def sprinkle(fn, every, jitter, amp):
    y = np.zeros(N); s = rng.uniform(0, every)
    while s < LOOP:
        seg = fn(); a = int(s * R); b = min(N, a + len(seg)); y[a:b] += amp * seg[:b - a]; s += every + rng.uniform(-jitter, jitter)
    return y

def bird():
    n = int(rng.uniform(0.08, 0.18) * R); tt = np.arange(n) / R; f0 = rng.uniform(2600, 4200)
    f = f0 * (1 + 0.25 * np.sin(2 * np.pi * rng.uniform(8, 16) * tt)); ph = 2 * np.pi * np.cumsum(f) / R
    y = np.sin(ph) * np.sin(np.pi * tt / tt[-1]) ** 2
    if rng.random() < 0.6: y = np.concatenate([y, np.zeros(int(0.07 * R)), y * 0.7])
    return y

def drop():
    n = int(0.12 * R); tt = np.arange(n) / R; f = rng.uniform(900, 1500) * np.exp(-tt * 9)
    return np.sin(2 * np.pi * np.cumsum(f) / R) * np.exp(-tt * 30)

def cricket():
    n = int(0.6 * R); tt = np.arange(n) / R; car = np.sin(2 * np.pi * rng.uniform(4300, 4800) * tt)
    return car * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 28 * tt))) * np.sin(np.pi * tt / tt[-1])

def bell():
    f = HZ(rng.choice([72, 74, 76, 79, 81])); n = int(4 * R); tt = np.arange(n) / R
    return sum(a * np.sin(2 * np.pi * f * k * tt) * np.exp(-tt * d) for k, a, d in [(1, 1, 1.2), (2.01, 0.4, 2.2), (3.02, 0.2, 3.5)])

SCENES = {
    'meadow': lambda: 0.55 * shape_noise(N, 250, 1400) * lfo(0.07, 0.25, 1.0) + 0.5 * pad() + sprinkle(bird, 9, 3, 0.05),
    'water': lambda: 0.6 * shape_noise(N, 120, 900, -0.8) * lfo(0.11, 0.6, 1.0) + sprinkle(drop, 1.9, 1.2, 0.05) + 0.45 * pad(),
    'night': lambda: 0.55 * pad(-1) + 0.2 * shape_noise(N, 200, 900) * lfo(0.05, 0.2, 0.8) + sprinkle(cricket, 3.1, 1.4, 0.018),
    'castle': lambda: reverb(0.6 * pad() + 0.25 * note(HZ(36), LOOP + TAIL, 1, 0.1) + sprinkle(bell, 11, 3, 0.1), 3.2, 0.5),
    'snow': lambda: 0.6 * shape_noise(N, 150, 900, -0.4) * lfo(0.06, 0.2, 1.0) * lfo(0.017, 0.6, 1.0, 1.3) + 0.4 * pad(-1) + sprinkle(bell, 13, 4, 0.05),
    'forest': lambda: 0.4 * shape_noise(N, 400, 2200) * lfo(0.09, 0.15, 0.8) + 0.5 * pad() + sprinkle(bird, 5.5, 2, 0.035),
}

def loop(y):
    """Seamless: the last TAIL seconds fade into the first TAIL seconds."""
    nt, nl = int(TAIL * R), int(LOOP * R); f = np.sin(np.linspace(0, np.pi / 2, nt)) ** 2   # equal-power-ish
    z = y[:nl].copy(); z[:nt] = z[:nt] * np.sqrt(f) + y[nl:nl + nt] * np.sqrt(1 - f); return z

def measure(wav):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', wav, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(r.split('Integrated loudness:')[1].split('I:')[1].split('LUFS')[0])

def encode(wav, dst, lufs=None, kbps=64):
    # one fixed gain to the target loudness (not loudnorm's riding gain, which fades the loop's start in)
    af = [f'volume={lufs - measure(wav):.2f}dB', 'alimiter=limit=0.9'] if lufs is not None else []
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, *(['-af', ','.join(af)] if af else []), '-ar', str(R), '-ac', '1',
                    '-c:a', 'aac', '-b:a', f'{kbps}k', '-movflags', '+faststart', dst], check=True)

with tempfile.TemporaryDirectory() as d:
    for name, fn in SCENES.items():
        y = loop(fn()); y = 0.5 * y / (np.abs(y).max() + 1e-9); w = os.path.join(d, name + '.wav'); sf.write(w, y.astype(np.float32), R)
        encode(w, os.path.join(out, f'ambient-{name}.m4a'), lufs=-20)
    # Karplus-Strong plucked string: a noise burst in a delay line with a soft averaging filter
    def pluck(freq, dur=2.6, damp=0.996):
        p = int(round(R / freq)); n = int(dur * R); buf = lowpass(rng.uniform(-1, 1, p * 8), 5000)[:p]; y = np.zeros(n)
        for i in range(n):
            y[i] = buf[i % p]; buf[i % p] = damp * 0.5 * (buf[i % p] + buf[(i + 1) % p])
        y *= np.minimum(1, np.arange(n) / (0.004 * R)); y[-int(0.3 * R):] *= np.linspace(1, 0, int(0.3 * R)); return y
    notes = {'c4': 60, 'd4': 62, 'e4': 64, 'f4': 65, 'g4': 67, 'a4': 69, 'b4': 71, 'c5': 72}
    for k, m in notes.items():
        y = reverb(pluck(HZ(m)), 1.6, 0.25); y = 0.5 * y / np.abs(y).max(); w = os.path.join(d, k + '.wav'); sf.write(w, y.astype(np.float32), R)
        encode(w, os.path.join(out, f'harp-{k}.m4a'), lufs=-18, kbps=48)
    strum = np.zeros(int(3.2 * R))
    for i, m in enumerate([60, 64, 67, 72]):
        s = pluck(HZ(m), 3.0); a = int(i * 0.07 * R); strum[a:a + len(s)] += s[:len(strum) - a]
    strum = reverb(strum, 1.8, 0.28); w = os.path.join(d, 'strum.wav'); sf.write(w, (0.5 * strum / np.abs(strum).max()).astype(np.float32), R)
    encode(w, os.path.join(out, 'harp-strum.m4a'), lufs=-18, kbps=48)
    # The soft neutral tone for a wrong answer: a muted wooden G3, no buzz
    n = int(0.45 * R); tt = np.arange(n) / R
    soft = (np.sin(2 * np.pi * HZ(55) * tt) + 0.3 * np.sin(2 * np.pi * HZ(67) * tt)) * np.exp(-tt * 9) * np.minimum(1, tt / 0.006)
    w = os.path.join(d, 'soft.wav'); sf.write(w, (0.4 * lowpass(soft, 1200)).astype(np.float32), R)
    encode(w, os.path.join(out, 'soft.m4a'), lufs=-24, kbps=48)
for f in sorted(os.listdir(out)): print(f, os.path.getsize(os.path.join(out, f)) // 1024, 'KB')
