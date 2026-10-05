"""Synthetic child-like test utterances for the listening check (never real children's voices).
Kokoro voices are made child-like by raising pitch and formants together (a shorter vocal tract), slowed first so
the result keeps a young reader's pace, with room noise at a living-room level. Words in [[...]] are phonemes.
Usage: python synth.py request.json  ({"models": dir, "out": dir, "items": [{"id", "text", "voice", "shift", "snr"}]})
Writes <id>.pcm (16-bit mono 16 kHz) and prints {"made": n}."""
import json, sys, os
from pathlib import Path
import numpy as np, onnxruntime as ort
from kokoro_onnx import Kokoro
req = json.loads(Path(sys.argv[1]).read_text()); out = Path(req['out']); out.mkdir(parents=True, exist_ok=True)
opts = ort.SessionOptions(); opts.intra_op_num_threads = 2
k = Kokoro.from_session(ort.InferenceSession(str(Path(req['models']) / 'kokoro-v1.0.onnx'), sess_options=opts, providers=['CPUExecutionProvider']), str(Path(req['models']) / 'voices-v1.0.bin'))
rng = np.random.default_rng(7)
made = 0
for it in req['items']:
    f = out / (it['id'] + '.pcm')
    if f.exists(): continue
    shift = float(it.get('shift', 1.3)); lang = 'en-gb' if it['voice'].startswith('b') else 'en-us'
    text = it['text']
    if text.startswith('[[') and text.endswith(']]'):
        s, sr = k.create(text[2:-2], voice=it['voice'], speed=0.9 / shift, lang=lang, is_phonemes=True)
    else:
        s, sr = k.create(text, voice=it['voice'], speed=0.9 / shift, lang=lang)
    # Play it back faster by `shift` (pitch and formants up), landing at 16 kHz.
    n_out = int(len(s) / shift * 16000 / sr)
    # Band-limited resampling (an FFT low-pass), so nothing above the new Nyquist folds back into the speech.
    y = (np.fft.irfft(np.fft.rfft(s)[: n_out // 2 + 1], n_out) * (n_out / len(s))).astype(np.float32)
    y = np.concatenate([np.zeros(4000, np.float32), y, np.zeros(4000, np.float32)])
    y *= 0.5 / (np.abs(y).max() + 1e-6) * float(it.get('gain', 1.0))
    snr = float(it.get('snr', 20)); p = np.mean(y[y != 0] ** 2) if np.any(y) else 1e-4
    noise = np.cumsum(rng.normal(size=len(y))).astype(np.float32); noise -= np.convolve(noise, np.ones(400) / 400, 'same'); noise /= noise.std() + 1e-9
    y = y + noise * np.sqrt(p / (10 ** (snr / 10)))
    f.write_bytes((np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()); made += 1
print(json.dumps({'made': made}))
