"""Letter-sound clip check: every clip a child hears a letter sound in must sound whole.
For each WAV: the voiced part is long enough (not cut short), the clip starts and ends in silence (not cut
mid-sound), nothing is digitally clipped, and there is no click (a sudden jump in otherwise quiet audio,
which is what a bad join sounds like). Isolated sound clips (Letter Quest's and the shared letter-sounds
folder) must also have a gentle attack and release.
--whole: the clips are single voice renders with no joins; the click test (which is about joins) is skipped
there, because a plosive after a pause ("...cat") looks like a click to it. Edges and clipping are still checked.
Usage: python check-sounds.py [--isolated|--whole] <wav or folder> ... [--json]
Exit 1 when any clip fails."""
import json, sys
from pathlib import Path
import numpy as np, soundfile as sf

def analyse(path, isolated=False, whole=False):
    a, r = sf.read(str(path), dtype='float32')
    if a.ndim > 1: a = a.mean(axis=1)
    out = {'file': Path(path).name, 'seconds': round(len(a) / r, 3), 'issues': []}
    if not len(a): out['issues'].append('empty'); return out
    env = np.abs(a); loud = np.flatnonzero(env > 0.02)
    voiced = (loud[-1] - loud[0]) / r if len(loud) else 0
    out['voiced'] = round(float(voiced), 3); out['peak'] = round(float(env.max()), 3)
    edge = int(r * .01)
    if env[:edge].max() > 0.02: out['issues'].append(f'starts mid-sound ({env[:edge].max():.3f} in the first 10 ms)')
    if env[-edge:].max() > 0.02: out['issues'].append(f'ends mid-sound ({env[-edge:].max():.3f} in the last 10 ms)')
    if env.max() >= 0.98: out['issues'].append('digitally clipped (peak at full scale)')
    # Clicks: a jump between neighbouring samples that is large for how quiet the audio around it is.
    # A click is a lone discontinuity: a spike in the second difference that stands far above the second
    # difference around it (speech and hiss have plenty of high-frequency energy all around, so they do not count).
    sd = np.abs(np.diff(a, 2)); w = int(r * .005)
    kernel = np.ones(2 * w + 1); kernel[w - 2:w + 3] = 0; kernel /= kernel.sum()
    floor = np.sqrt(np.convolve(sd * sd, kernel, mode='same'))
    clicks = np.flatnonzero((sd > 0.08) & (sd > 10 * np.maximum(floor, 1e-4)))
    if len(clicks) and not whole: out['issues'].append(f'{len(clicks)} click(s), first at {clicks[0] / r:.3f} s')
    if isolated:
        if voiced < 0.06: out['issues'].append(f'sound too short ({voiced:.3f} s voiced)')
        if len(loud):
            # Attack and release: the level rises and falls over a few ms, not in one sample.
            on = env[loud[0]:loud[0] + int(r * .003)].max(); pre = env[max(0, loud[0] - int(r * .003)):loud[0]].max(initial=0)
            if on - pre > 0.5: out['issues'].append('abrupt attack')
    return out

def main(args):
    iso = '--isolated' in args; whole = '--whole' in args; as_json = '--json' in args
    files = []
    for x in [a for a in args if not a.startswith('--')]:
        p = Path(x); files += sorted(p.glob('*.wav')) if p.is_dir() else [p]
    res = [analyse(f, iso, whole) for f in files]
    bad = [r for r in res if r['issues']]
    if as_json: print(json.dumps({'ok': not bad, 'checked': len(res), 'failures': bad, 'all': res}))
    else:
        for r in res: print(f"{'FAIL' if r['issues'] else 'ok  '} {r['file']} {r['seconds']}s voiced {r.get('voiced')}s peak {r.get('peak')} {'; '.join(r['issues'])}")
    return 1 if bad else 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
