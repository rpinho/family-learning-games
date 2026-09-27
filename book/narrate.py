"""The Book: narration clips with the local Kokoro model (no network, no API key).
Usage: python book/narrate.py request.json   (request: {"lines": [{"text", "voice", "speed"}], "out": "<clip dir>",
"models": "<dir with kokoro-v1.0.onnx + voices-v1.0.bin>"}). Each line has its own voice (narrator, Dad, each
friend). Letter sounds are written as phonemes in [[...]] (plain "Sss" would be spelled
"S S S"). A letter sound (one short phoneme, e.g. [[b]], [[æ]]) is the family's shared recorded letter sound (see below),
with clean silence around it, joined into the line (never blended into
the words next to it, which made "[[lll]]" come out as "lol"). Longer phoneme spans (names like Pikachu) are spoken
inline. Clips are content-addressed and only ever added: an existing clip is never rewritten.
Prints {"made": n, "clips": {"voice|speed|text": file}} as JSON."""
import hashlib, json, os, re, sys
from pathlib import Path
req = json.loads(Path(sys.argv[1]).read_text())
out = Path(req['out']); out.mkdir(mode=0o700, parents=True, exist_ok=True)
def norm(l): return {'text': l['text'], 'voice': l.get('voice') or 'af_heart', 'speed': float(l.get('speed') or 0.95)}
lines = [norm(l) for l in req['lines'] if str(l.get('text', '')).strip()]
SOUND = re.compile(r'\[\[([^\]]*)\]\]')
def is_sound(p): return 0 < len(p.replace('ˈ', '').replace('ˌ', '')) <= 2
# A line with an isolated letter sound is made differently, so its clip has its own key (old clips stay as they were).
# book-2 used Letter Quest's Kokoro phonemes; book-3 uses the shared recorded letter sounds.
def version(l): return 'book-3' if any(is_sound(p) for p in SOUND.findall(l['text'])) else 'book-1'
def key(l): return hashlib.sha256(f"{version(l)}\0{l['voice']}\0{l['speed']}\0{l['text']}".encode()).hexdigest()[:16]
def ref(l, speed): return f"{l['voice']}|{speed}|{l['text']}"
todo = {key(l): l for l in lines if not (out / (key(l) + '.wav')).exists()}
# ---- letter sounds: ONE source of truth, the family's shared recorded letter sounds ----
# ~/.local/share/family-games/letter-sounds/<letter>.wav (private; provenance in letter-sounds.json), processed for
# playback exactly as the other games do it: word-arcade's scripts/soundout.py letter_sound() (trimmed only in silence,
# fades anchored at the true onset and release, continuants held 0.40-0.60 s, matched in loudness to the words around
# it). Every processed sound must pass the shared check (letter_sound_check.check_sound) or the line is refused. A
# letter with no recording is refused too (the book and the hunts never ask for one: SOUND_LETTERS in word-families.mjs).
PH2LETTER = {'æ': 'a', 'b': 'b', 'k': 'c', 'd': 'd', 'ɛ': 'e', 'f': 'f', 'ɡ': 'g', 'h': 'h', 'ɪ': 'i', 'dʒ': 'j', 'l': 'l', 'm': 'm', 'n': 'n', 'ɑ': 'o', 'p': 'p', 'kw': 'q', 'ɹ': 'r', 's': 's', 't': 't', 'ʌ': 'u', 'v': 'v', 'w': 'w', 'ks': 'x', 'j': 'y', 'z': 'z'}
SOUNDS_DIR = Path(os.path.expanduser(req.get('letter_sounds') or os.environ.get('LETTER_SOUNDS') or '~/.local/share/family-games/letter-sounds'))
SOUNDOUT_DIR = req.get('soundout')
def shared():
    """word-arcade's soundout (processing) and letter_sound_check (the check), from the scripts folder the caller names."""
    if not SOUNDOUT_DIR or not (Path(SOUNDOUT_DIR) / 'soundout.py').exists(): raise RuntimeError('letter sounds: soundout.py not found (' + str(SOUNDOUT_DIR) + ')')
    os.environ['LETTER_SOUNDS'] = str(SOUNDS_DIR)
    if SOUNDOUT_DIR not in sys.path: sys.path.insert(0, SOUNDOUT_DIR)
    import soundout, letter_sound_check
    return soundout, letter_sound_check
def letter_sound(ph, target_rms):
    letter = PH2LETTER.get(ph.replace('ˈ', '').replace('ˌ', ''))
    if not letter: raise ValueError('not a letter sound: ' + ph)
    if not (SOUNDS_DIR / (letter + '.wav')).exists(): raise ValueError(f'no recorded sound for {letter} in {SOUNDS_DIR}')
    so, chk = shared()
    a = so.letter_sound(letter, target_rms).astype(np.float32)
    pad = np.zeros(int(24000 * .01), dtype=np.float32); bad = chk.check_sound(np.concatenate([pad, a, pad]), 24000, letter)
    if bad: raise ValueError(f'letter sound {letter} fails the check: ' + '; '.join(bad))
    return a
if todo:
    import numpy as np, soundfile as sf, onnxruntime as ort
    from kokoro_onnx import Kokoro
    models = Path(req['models'])
    opts = ort.SessionOptions(); opts.intra_op_num_threads = int(os.environ.get('BOOK_VOICE_THREADS', '2')); opts.inter_op_num_threads = 1
    kokoro = Kokoro.from_session(ort.InferenceSession(str(models / 'kokoro-v1.0.onnx'), sess_options=opts, providers=['CPUExecutionProvider']), str(models / 'voices-v1.0.bin'))
    for k, l in todo.items():
        lang = 'en-gb' if l['voice'].startswith('b') else 'en-us'
        def spoken(text):
            if '[[' not in text: return kokoro.create(text, voice=l['voice'], speed=l['speed'], lang=lang)
            parts = re.split(r'\[\[([^\]]*)\]\]', text)
            def phon(p):
                core = p.strip()
                return (' ' if p[:1].isspace() else '') + (kokoro.tokenizer.phonemize(core, lang) if core else '') + (' ' if p[-1:].isspace() else '')
            return kokoro.create(''.join(p if i % 2 else phon(p) for i, p in enumerate(parts)), voice=l['voice'], speed=l['speed'], lang=lang, is_phonemes=True)
        if version(l) == 'book-3':
            # Runs of words (with any inline name phonemes) and isolated letter sounds, joined with short pauses.
            chunks, run = [], ''
            for i, p in enumerate(re.split(r'(\[\[[^\]]*\]\])', l['text'])):
                m = SOUND.fullmatch(p)
                if m and is_sound(m.group(1)):
                    if run: chunks.append(('text', run)); run = ''
                    chunks.append(('sound', m.group(1)))
                else: run += p
            if run: chunks.append(('text', run))
            # Words first, so every letter sound can be matched in loudness to the words of its own line.
            said = {i: spoken(v.strip()) for i, (kind, v) in enumerate(chunks) if kind == 'text' and re.search(r'[A-Za-z\[]', v)}
            words = [np.asarray(a, dtype=np.float32) for a, _ in said.values()]
            rate = 24000; target = float(shared()[0].rms(np.concatenate(words))) if words else 0.08
            pieces = []
            for i, (kind, v) in enumerate(chunks):
                if kind == 'sound':
                    # Clean silence on both sides (>= 150 ms): the sound is never blended into the words.
                    pieces += [np.zeros(int(rate * .15), dtype=np.float32), letter_sound(v, target), np.zeros(int(rate * .18), dtype=np.float32)]
                elif i in said:
                    a, rate = said[i]; a = np.asarray(a, dtype=np.float32).copy(); n = min(int(rate * .005), len(a) // 4)
                    if n: a[:n] *= np.linspace(0, 1, n); a[-n:] *= np.linspace(1, 0, n)
                    pieces.append(a)
                else:  # only punctuation between sounds ("... "): a short breath
                    pieces.append(np.zeros(int(rate * .22), dtype=np.float32))
            samples = np.concatenate(pieces)
        elif '[[' in l['text']:
            # Letter sounds come as phonemes in [[...]]: the rest of the line is phonemized normally.
            parts = re.split(r'\[\[([^\]]*)\]\]', l['text'])
            def phon(p):  # the phonemizer trims spaces; keep them so words stay apart
                core = p.strip()
                return (' ' if p[:1].isspace() else '') + (kokoro.tokenizer.phonemize(core, lang) if core else '') + (' ' if p[-1:].isspace() else '')
            ph = ''.join(p if i % 2 else phon(p) for i, p in enumerate(parts))
            samples, rate = kokoro.create(ph, voice=l['voice'], speed=l['speed'], lang=lang, is_phonemes=True)
        else:
            samples, rate = kokoro.create(l['text'], voice=l['voice'], speed=l['speed'], lang=lang)
        if not len(samples) or not np.isfinite(samples).all(): raise ValueError('invalid audio for: ' + l['text'][:60])
        # Some voices run hot (am_adam reaches full scale): never write a clipped line (the clip check refuses it).
        # Only the level of new renders changes; clip names and every existing clip stay as they are.
        peak = float(np.abs(samples).max())
        if peak > 0.9: samples = samples * (0.9 / peak)
        final = out / (k + '.wav'); temp = out / (k + f'.{os.getpid()}.tmp.wav')
        sf.write(str(temp), samples, rate, subtype='PCM_16'); temp.replace(final)
# The caller's speed spelling (e.g. 1 vs 1.0) is echoed back so it can match its own lines.
clips = {}
for raw in req['lines']:
    if not str(raw.get('text', '')).strip(): continue
    l = norm(raw); clips[f"{raw.get('voice') or 'af_heart'}|{raw.get('speed') if raw.get('speed') is not None else 0.95}|{l['text']}"] = key(l) + '.wav'
print(json.dumps({'made': len(todo), 'clips': clips}))
