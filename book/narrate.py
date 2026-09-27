"""The Book: narration clips with the local Kokoro model (no network, no API key).
Usage: python book/narrate.py request.json   (request: {"lines": [{"text", "voice", "speed"}], "out": "<clip dir>",
"models": "<dir with kokoro-v1.0.onnx + voices-v1.0.bin>"}). Each line has its own voice (narrator, Dad, each
friend). Letter sounds are written as phonemes in [[...]] (plain "Sss" would be spelled
"S S S"). A letter sound (one short phoneme, e.g. [[l]], [[b]], [[æ]]) is spoken on its own, as Letter Quest does:
a clean isolated phoneme at a gentle speed with a little air around it, joined into the line (never blended into
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
def version(l): return 'book-2' if any(is_sound(p) for p in SOUND.findall(l['text'])) else 'book-1'
def key(l): return hashlib.sha256(f"{version(l)}\0{l['voice']}\0{l['speed']}\0{l['text']}".encode()).hexdigest()[:16]
def ref(l, speed): return f"{l['voice']}|{speed}|{l['text']}"
todo = {key(l): l for l in lines if not (out / (key(l) + '.wav')).exists()}
# ---- letter sounds: ONE source of truth, Letter Quest's isolated phoneme clips ----
# Letter Quest verified its own clips ("Sound b." etc.; voice, speed and padding in its scripts/build-voice.py). A
# letter it has is taken from its voice folder as is; any other letter is made with exactly the same recipe (same
# voice, speed, padding and file key as Letter Quest would use), into the shared letter-sound folder. In a line the
# sound is only trimmed in its silence (never into the attack or the release), with a few ms of fade at the cut.
LQ_POLICY, LQ_VOICE, LQ_SPEED = 'phoneme-v2-padded', 'am_michael', 0.85
PH2LETTER = {'æ': 'a', 'b': 'b', 'k': 'c', 'd': 'd', 'ɛ': 'e', 'f': 'f', 'ɡ': 'g', 'h': 'h', 'ɪ': 'i', 'dʒ': 'j', 'l': 'l', 'm': 'm', 'n': 'n', 'ɑ': 'o', 'p': 'p', 'kw': 'q', 'ɹ': 'r', 's': 's', 't': 't', 'ʌ': 'u', 'v': 'v', 'w': 'w', 'ks': 'x', 'j': 'y', 'z': 'z'}
lq_voice = Path(req['lq_voice']) if req.get('lq_voice') else None
sounds_dir = Path(req.get('sounds') or (out / 'letter-sounds')); sounds_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
def sound_file(ph):
    letter = PH2LETTER.get(ph.replace('ˈ', '').replace('ˌ', ''))
    if not letter: raise ValueError('not a letter sound: ' + ph)
    text = f'Sound {letter}.'
    if lq_voice and (lq_voice / 'manifest.json').exists():
        clip = json.loads((lq_voice / 'manifest.json').read_text()).get('clips', {}).get(text)
        if clip and (lq_voice / Path(clip).name).exists(): return lq_voice / Path(clip).name, 'letter-quest'
    digest = hashlib.sha256((LQ_POLICY + '\0' + LQ_VOICE + '\0' + text).encode()).hexdigest()[:16]
    return sounds_dir / (digest + '.wav'), 'recipe'
def make_sound(ph, dest):
    a, rate = kokoro.create(ph, voice=LQ_VOICE, speed=LQ_SPEED, lang='en-us', is_phonemes=True)
    lead = int(rate * .16); tail = max(int(rate * .28), int(rate * 1.05) - lead - len(a))
    a = np.concatenate((np.zeros(lead, dtype=a.dtype), a, np.zeros(tail, dtype=a.dtype)))
    tmp = dest.with_suffix(f'.{os.getpid()}.tmp.wav'); sf.write(str(tmp), a, rate, subtype='PCM_16'); tmp.replace(dest)
def letter_sound(ph):
    f, src = sound_file(ph)
    if not f.exists(): make_sound(ph, f)
    a, rate = sf.read(str(f), dtype='float32')
    if a.ndim > 1: a = a.mean(axis=1)
    loud = np.flatnonzero(np.abs(a) > 0.004)
    if len(loud):
        g = int(rate * .03); a = a[max(0, loud[0] - g):min(len(a), loud[-1] + g)]
    n = min(int(rate * .008), len(a) // 4)
    if n: a[:n] *= np.linspace(0, 1, n); a[-n:] *= np.linspace(1, 0, n)
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
        if version(l) == 'book-2':
            # Runs of words (with any inline name phonemes) and isolated letter sounds, joined with short pauses.
            chunks, run = [], ''
            for i, p in enumerate(re.split(r'(\[\[[^\]]*\]\])', l['text'])):
                m = SOUND.fullmatch(p)
                if m and is_sound(m.group(1)):
                    if run: chunks.append(('text', run)); run = ''
                    chunks.append(('sound', m.group(1)))
                else: run += p
            if run: chunks.append(('text', run))
            pieces, rate = [], 24000
            for kind, v in chunks:
                if kind == 'sound':
                    # The one source of letter sounds: Letter Quest's own clip (see letter_sound()).
                    pieces += [np.zeros(int(rate * .06), dtype=np.float32), letter_sound(v), np.zeros(int(rate * .1), dtype=np.float32)]
                elif re.search(r'[A-Za-z\[]', v):
                    a, rate = spoken(v.strip()); a = a.astype(np.float32); n = min(int(rate * .005), len(a) // 4)
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
