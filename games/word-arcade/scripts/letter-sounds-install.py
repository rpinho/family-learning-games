"""PRIVATE: install a set of letter sounds into the shared folder in ONE step (the games' sound-outs and the book read
<letter>.wav from it). Works for a full set or a few letters (e.g. the book agent's "longer stops" b/d/p/t/c/g).
  python scripts/letter-sounds-install.py SET_DIR --label clean-2026-09-28 [--letters bdptcg] [--note "..."] [--dry-run]
SET_DIR holds <letter>.wav (24 kHz mono) and optionally set.json {"processing": "...", "sounds": {letter: {...}}}.
Every file it replaces is MOVED (never deleted) to old/pre-<label>/ together with the previous letter-sounds.json,
and each installed letter's entry in letter-sounds.json records the set, its processing and where the old file went.
Undo = run it again with SET_DIR = old/pre-<label>/. Each new file must pass letter_sound_check's isolated-sound check
when played the way the sound-outs play it (soundout.letter_sound)."""
import argparse, json, os, shutil, sys, time
from pathlib import Path
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
DEFAULT = os.path.expanduser('~/.local/share/family-games/letter-sounds')
def main():
    ap = argparse.ArgumentParser(description=__doc__); ap.add_argument('set_dir'); ap.add_argument('--label', required=True)
    ap.add_argument('--letters'); ap.add_argument('--note', default=''); ap.add_argument('--out', default=DEFAULT); ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args(); src, out = Path(a.set_dir), Path(a.out); os.environ['LETTER_SOUNDS'] = str(src)
    import soundout; from letter_sound_check import check_sound
    meta_in = json.loads((src/'set.json').read_text()) if (src/'set.json').exists() else {}
    letters = [c for c in (a.letters or ''.join(sorted(p.stem for p in src.glob('?.wav'))))]
    if not letters: raise SystemExit('no <letter>.wav in '+str(src))
    bad = []
    for c in letters:
        x, rate = sf.read(src/(c+'.wav'), dtype='float32')
        if rate != 24000 or x.ndim != 1: bad.append(f'{c}: must be 24 kHz mono'); continue
        z = np.zeros(2400, 'float32'); played = np.concatenate([z, soundout.letter_sound(c, 0.1, x), z])
        b = check_sound(played, 24000, c, x)
        if b: bad.append(f'{c}: '+'; '.join(b))
    if bad: raise SystemExit('not installed, check failed:\n  '+'\n  '.join(bad))
    meta = json.loads((out/'letter-sounds.json').read_text()); old = out/'old'/f'pre-{a.label}'
    if a.dry_run: print('ok (dry run):', ''.join(letters), '->', out); return
    old.mkdir(parents=True, exist_ok=True); shutil.copy2(out/'letter-sounds.json', old/'letter-sounds.json')
    for c in letters:
        if (out/(c+'.wav')).exists(): shutil.move(out/(c+'.wav'), old/(c+'.wav'))
        shutil.copy2(src/(c+'.wav'), out/(c+'.wav'))
        prev = meta['sounds'].get(c, {})
        meta['sounds'][c] = {**prev, **meta_in.get('sounds', {}).get(c, {}), 'file': c+'.wav', 'set': a.label,
            'processing': meta_in.get('processing', a.note), 'installed': time.strftime('%Y-%m-%dT%H:%M:%S'), 'replaced': f'old/pre-{a.label}/{c}.wav'}
        meta['sounds'][c].pop('previous', None)
    meta.setdefault('history', []).append({'label': a.label, 'letters': ''.join(letters), 'at': time.strftime('%Y-%m-%dT%H:%M:%S'), 'old': f'old/pre-{a.label}/', 'note': a.note or meta_in.get('processing', '')})
    (out/'letter-sounds.tmp.json').write_text(json.dumps(meta, indent=1)); (out/'letter-sounds.tmp.json').replace(out/'letter-sounds.json')
    print('installed', ''.join(letters), 'from', src, '| previous files in', old)
if __name__ == '__main__': main()
