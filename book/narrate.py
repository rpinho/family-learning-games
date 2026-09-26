"""The Book: narration clips with the local Kokoro model (no network, no API key).
Usage: python book/narrate.py request.json   (request: {"lines": [...], "voice": "af_heart", "speed": 0.95,
"out": "<clip dir>", "models": "<dir with kokoro-v1.0.onnx + voices-v1.0.bin>"}). Clips are content-addressed
and only ever added: an existing clip is never rewritten. Prints {"clips": {text: file}} as JSON.
"""
import hashlib, json, os, sys
from pathlib import Path
req = json.loads(Path(sys.argv[1]).read_text())
out = Path(req['out']); out.mkdir(parents=True, exist_ok=True)
voice = req.get('voice', 'af_heart'); speed = float(req.get('speed', 0.95))
def key(text): return hashlib.sha256(f'book-1\0{voice}\0{speed}\0{text}'.encode()).hexdigest()[:16]
todo = [t for t in dict.fromkeys(req['lines']) if t.strip() and not (out / (key(t) + '.wav')).exists()]
kokoro = None
if todo:
    import numpy as np, soundfile as sf, onnxruntime as ort
    from kokoro_onnx import Kokoro
    models = Path(req['models'])
    opts = ort.SessionOptions(); opts.intra_op_num_threads = int(os.environ.get('BOOK_VOICE_THREADS', '2')); opts.inter_op_num_threads = 1
    kokoro = Kokoro.from_session(ort.InferenceSession(str(models / 'kokoro-v1.0.onnx'), sess_options=opts, providers=['CPUExecutionProvider']), str(models / 'voices-v1.0.bin'))
    for text in todo:
        samples, rate = kokoro.create(text, voice=voice, speed=speed, lang='en-us')
        if not len(samples) or not np.isfinite(samples).all(): raise ValueError('invalid audio for: ' + text[:60])
        final = out / (key(text) + '.wav'); temp = out / (key(text) + f'.{os.getpid()}.tmp.wav')
        sf.write(str(temp), samples, rate, subtype='PCM_16'); temp.replace(final)
print(json.dumps({'voice': voice, 'speed': speed, 'made': len(todo), 'clips': {t: key(t) + '.wav' for t in req['lines'] if t.strip()}}))
