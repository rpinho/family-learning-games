"""The Book: narration clips with the local Kokoro model (no network, no API key).
Usage: python book/narrate.py request.json   (request: {"lines": [{"text", "voice", "speed"}], "out": "<clip dir>",
"models": "<dir with kokoro-v1.0.onnx + voices-v1.0.bin>"}). Each line has its own voice (narrator, Dad, each
friend). Clips are content-addressed and only ever added: an existing clip is never rewritten.
Prints {"made": n, "clips": {"voice|speed|text": file}} as JSON."""
import hashlib, json, os, sys
from pathlib import Path
req = json.loads(Path(sys.argv[1]).read_text())
out = Path(req['out']); out.mkdir(mode=0o700, parents=True, exist_ok=True)
def norm(l): return {'text': l['text'], 'voice': l.get('voice') or 'af_heart', 'speed': float(l.get('speed') or 0.95)}
lines = [norm(l) for l in req['lines'] if str(l.get('text', '')).strip()]
def key(l): return hashlib.sha256(f"book-1\0{l['voice']}\0{l['speed']}\0{l['text']}".encode()).hexdigest()[:16]
def ref(l, speed): return f"{l['voice']}|{speed}|{l['text']}"
todo = {key(l): l for l in lines if not (out / (key(l) + '.wav')).exists()}
if todo:
    import numpy as np, soundfile as sf, onnxruntime as ort
    from kokoro_onnx import Kokoro
    models = Path(req['models'])
    opts = ort.SessionOptions(); opts.intra_op_num_threads = int(os.environ.get('BOOK_VOICE_THREADS', '2')); opts.inter_op_num_threads = 1
    kokoro = Kokoro.from_session(ort.InferenceSession(str(models / 'kokoro-v1.0.onnx'), sess_options=opts, providers=['CPUExecutionProvider']), str(models / 'voices-v1.0.bin'))
    for k, l in todo.items():
        lang = 'en-gb' if l['voice'].startswith('b') else 'en-us'
        samples, rate = kokoro.create(l['text'], voice=l['voice'], speed=l['speed'], lang=lang)
        if not len(samples) or not np.isfinite(samples).all(): raise ValueError('invalid audio for: ' + l['text'][:60])
        final = out / (k + '.wav'); temp = out / (k + f'.{os.getpid()}.tmp.wav')
        sf.write(str(temp), samples, rate, subtype='PCM_16'); temp.replace(final)
# The caller's speed spelling (e.g. 1 vs 1.0) is echoed back so it can match its own lines.
clips = {}
for raw in req['lines']:
    if not str(raw.get('text', '')).strip(): continue
    l = norm(raw); clips[f"{raw.get('voice') or 'af_heart'}|{raw.get('speed') if raw.get('speed') is not None else 0.95}|{l['text']}"] = key(l) + '.wav'
print(json.dumps({'made': len(todo), 'clips': clips}))
