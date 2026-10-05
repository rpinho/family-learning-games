"""Letter Slalom sound-outs: recorded letter sounds (see import-letter-sounds.py) + the whole word in Nova's voice.
compose(word, say): 'm... a... t... mat'. check(samples): the automatic clip check used by the voice build.
Each sound keeps its natural attack and release: it is trimmed only in silence, with raised-cosine fades; every sound
plays at its full natural length, ending on its real release (no cap); every sound is matched in loudness to the word; the gaps
between sounds are even and silent (no hard joins, so no clicks)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pathlib import Path
import numpy as np, soundfile as sf
RATE = 24000
SOUNDS = Path(os.environ.get('LETTER_SOUNDS', os.path.expanduser('~/.local/share/family-games/letter-sounds')))
STOPS, VOWELS = set('bcdgkpt'), set('aeiou')
LEAD, GAP, BEFORE_WORD, TAIL = 0.12, 0.30, 0.42, 0.10
def _fade(n, rising):
    t = 0.5 - 0.5*np.cos(np.linspace(0, np.pi, n)); return t if rising else t[::-1]
def _active(x, frac=0.06):
    n = int(RATE*0.01); k = len(x)//n; e = np.sqrt(np.mean(x[:k*n].reshape(k, n)**2, 1)); on = np.flatnonzero(e > e.max()*frac)
    return on[0]*n, min(len(x), (on[-1]+1)*n)
def rms(x):
    a, b = _active(x); s = x[a:b]; return float(np.sqrt(np.mean(s**2)))
def source(letter):
    x, rate = sf.read(SOUNDS/(letter+'.wav'), dtype='float32')
    if rate != RATE: raise ValueError('letter sound rate')
    return x
def letter_sound(letter, target_rms, x=None):
    """One letter sound as placed in a sound-out: its FULL natural length (2026-09-28: the 0.55-0.60 s hold for vowels
    and continuants cut them short; the recorded vowels run 0.7-0.85 s). It starts at the real onset and ends on its
    real release (true_bounds in letter_sound_check.py: down to the room floor, both bands), then fades out over the
    last 40 ms, which lie past the release in the room's own silence."""
    x = source(letter) if x is None else np.asarray(x, dtype='float32')
    ts, te = true_bounds(x, RATE)
    a = max(0, ts-int(RATE*0.025)); b = min(len(x), te+int(RATE*0.03))
    s = x[a:b].copy()
    # Attack anchored to where the voice really starts (10% of its 2 ms envelope; the low hiss before it is removed):
    # ~25 ms for vowels and continuants (softens a hard glottal onset, as in the recorded /e/ and /u/), 3 ms for stops.
    # Stops keep everything from the real onset (the voice bar before the burst of /b/ /d/ /g/ is part of the sound,
    # audible now the room noise is gone; zeroing it made b and d shorter than the recording).
    env = envelope(s, RATE); up = np.flatnonzero(env > 0.1*float(env.max())); on = int(up[0])*RATE//1000
    if letter in STOPS: on = min(on, ts-a)
    attack = int(RATE*(0.003 if letter in STOPS else 0.025)); a0 = max(0, on-int(RATE*0.001))
    s[:a0] = 0; s[a0:a0+attack] *= _fade(len(s[a0:a0+attack]), True)
    release = min(len(s)-a0-attack, int(RATE*0.04)); s[len(s)-release:] *= _fade(release, False)
    gain = target_rms/max(1e-5, rms(s)) * (0.8 if letter in STOPS else 1.0)
    s *= min(gain, 64.0)   # up to +36 dB: a high-passed or denoised fricative's level is the hiss alone
    peak = float(np.max(np.abs(s)))
    if peak > 0.85: s *= 0.85/peak
    return s
def compose(word, say):
    """say(text) -> (samples, rate) in Nova's voice (Kokoro)."""
    w, rate = say(word+'.')
    if rate != RATE: raise ValueError('voice rate')
    w = np.asarray(w, dtype='float32'); target = rms(w)
    parts = [np.zeros(int(RATE*LEAD), 'float32')]
    for k, c in enumerate(word):
        parts.append(letter_sound(c, target)); parts.append(np.zeros(int(RATE*(GAP if k < len(word)-1 else BEFORE_WORD)), 'float32'))
    parts += [w, np.zeros(int(RATE*TAIL), 'float32')]
    return np.concatenate(parts), RATE
# The clip check lives in letter_sound_check.py (shared with the other family games).
from letter_sound_check import check_soundout, check_sound, envelope, true_bounds, segments as _segments
def segments(x): return _segments(np.asarray(x, dtype='float32'), RATE)
def check(x, word): return check_soundout(np.asarray(x, dtype='float32'), RATE, word, {c: source(c) for c in set(word)})
if __name__ == '__main__':
    # every processed letter sound (as it is placed in a sound-out) passes the isolated-sound check
    import sys; bad = 0
    for c in sorted(p.stem for p in SOUNDS.glob('?.wav')):
        s = np.concatenate([np.zeros(240,'float32'), letter_sound(c, 0.1), np.zeros(240,'float32')]); b = check_sound(s, RATE, c, source(c))
        if b: bad += 1; print(c, b)
    print('letter sounds', 'ok' if not bad else f'{bad} failed'); sys.exit(1 if bad else 0)
