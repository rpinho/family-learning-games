"""Clip check for every line a child hears a letter sound in (and the Letter Hunt lines): the clip must sound whole.
For each WAV: the clip starts and ends in silence (not cut mid-sound), nothing is digitally clipped, and there is no
click at a join. A click is judged by the family's shared checker (word-arcade scripts/letter_sound_check.py:
a jump straight out of or into digital silence, which is what a bad join is); the letter sounds themselves are
checked by the same shared checker when a line is made (book/narrate.py). A plosive inside the voice's own speech
("Kick") is not a join and is not flagged.
--soundout DIR: where letter_sound_check.py is (default: $FAMILY_SOUNDOUT, the live word-arcade, ~/dev/word-arcade).
--isolated: a clip that is only a letter sound (also: long enough, gentle attack). --whole: accepted for older callers.
Usage: python check-sounds.py [--isolated|--whole] [--soundout DIR] <wav or folder> ... [--json]
Exit 1 when any clip fails."""
import json, os, sys
from pathlib import Path
import numpy as np, soundfile as sf

def find_checker(given=None):
    for d in [given, os.environ.get('FAMILY_SOUNDOUT'), os.path.expanduser('~/.local/share/family-games/live/word-arcade/scripts'), os.path.expanduser('~/dev/word-arcade/scripts')]:
        if d and os.path.exists(os.path.join(d, 'letter_sound_check.py')): return d
    raise SystemExit('check-sounds: letter_sound_check.py not found (pass --soundout DIR)')
def shared_clicks(a):
    import letter_sound_check
    return letter_sound_check.clicks(a) or edge_jumps(a)
def edge_jumps(a, run=24, jump=0.02):
    """The same definition, measured causally: a jump > 0.02 right after >= 24 digitally silent samples, or right
    before them. (The shared checker centres its silence window, so a step at the very edge of silence slips past it.)"""
    silent = (np.abs(a) < 1e-4).astype(int); c = np.concatenate([[0], np.cumsum(silent)])
    i = np.arange(run, len(a) - run)
    before = (c[i] - c[i - run]) == run; after = (c[i + 1 + run] - c[i + 1]) == run
    big = np.abs(a[i] - a[i - 1]) > jump; big_next = np.abs(a[i + 1] - a[i]) > jump
    return bool(np.any(before & big) or np.any(after & big_next))
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
    # Digitally clipped = samples AT full scale (a loud but whole clip, peak 0.98, is fine).
    full = env >= 0.999
    if full.sum() >= 2 or env.max() >= 0.9999: out['issues'].append('digitally clipped (peak at full scale)')
    if shared_clicks(a): out['issues'].append('click at a join (jump out of or into digital silence)')
    if isolated:
        if voiced < 0.06: out['issues'].append(f'sound too short ({voiced:.3f} s voiced)')
        if len(loud):
            # Attack and release: the level rises and falls over a few ms, not in one sample.
            on = env[loud[0]:loud[0] + int(r * .003)].max(); pre = env[max(0, loud[0] - int(r * .003)):loud[0]].max(initial=0)
            if on - pre > 0.5: out['issues'].append('abrupt attack')
    return out

def main(args):
    iso = '--isolated' in args; whole = '--whole' in args; as_json = '--json' in args
    given = args[args.index('--soundout') + 1] if '--soundout' in args else None
    if given: args = [x for i, x in enumerate(args) if x != '--soundout' and (i == 0 or args[i - 1] != '--soundout')]
    sys.path.insert(0, find_checker(given))
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
