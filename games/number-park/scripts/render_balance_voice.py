"""Continuous stock narration, matching the Book's @relaxed single-take delivery.

One Kokoro create call per complete line. Never join isolated numbers or sentences.
Content-addressed clips are immutable; only the manifest changes.
"""
import hashlib, os, shutil, sys
sys.dont_write_bytecode = True
from concurrent.futures import ProcessPoolExecutor, as_completed
from multiprocessing import get_context
from pathlib import Path
import numpy as np
import soundfile as sf
import onnxruntime as ort
from kokoro_onnx import Kokoro

def render_chunk(args):
    lines, out, models = args
    return render_serial(lines, out, models)

def render_serial(lines, out, models):
    voice = os.environ.get('BALANCE_NARRATOR', 'af_bella@relaxed')
    speed = float(os.environ.get('BALANCE_NARRATOR_SPEED', '0.8'))
    version = 'balance-continuous-relaxed-1'
    clips = {}
    model = None
    for i, text in enumerate(dict.fromkeys(lines)):
        key = hashlib.sha256(f'{version}\0{voice}\0{speed}\0{text}'.encode()).hexdigest()[:16]
        file = out / (key + '.wav')
        cache = os.environ.get('BALANCE_VOICE_CACHE')
        cached = Path(cache) / file.name if cache else None
        if not file.exists() and cached and cached.is_file():
            info = sf.info(cached)
            if info.samplerate != 24000 or info.channels != 1 or info.frames == 0: raise ValueError('Invalid cached narration: ' + text)
            shutil.copyfile(cached, file)
        if not file.exists():
            if model is None:
                opts = ort.SessionOptions(); opts.intra_op_num_threads = 2; opts.inter_op_num_threads = 1
                model = Kokoro.from_session(ort.InferenceSession(str(models / 'kokoro-v1.0.onnx'), sess_options=opts, providers=['CPUExecutionProvider']), str(models / 'voices-v1.0.bin'))
            a, rate = model.create(text.strip(), voice=voice.split('@')[0], speed=round(speed * 1.125, 3), lang='en-us')
            a = np.asarray(a, dtype=np.float32)
            if not len(a) or not np.isfinite(a).all(): raise ValueError('Invalid narration: ' + text)
            on = np.where(np.abs(a) > 0.01 * (np.abs(a).max() + 1e-9))[0]
            if len(on): a = a[max(0, on[0] - 2400):on[-1] + 2400]
            samples = np.concatenate([np.zeros(int(rate * .15), dtype=np.float32), a])
            fl = int(rate * .01); n = len(samples) // fl
            if n > 4:
                rms = np.sqrt(np.mean(samples[:n * fl].reshape(n, fl) ** 2, axis=1)); loud = rms >= np.abs(samples).max() * 0.015
                keep = loud.copy()
                for j in np.where(loud)[0]: keep[max(0, j - 2):j + 3] = True
                g = np.repeat(keep.astype(np.float32), fl); g = np.concatenate([g, np.ones(len(samples) - len(g), dtype=np.float32)])
                fk = max(1, int(rate * .005)); g = np.convolve(g, np.ones(fk) / fk, mode='same').astype(np.float32); samples = samples * g
            peak = float(np.abs(samples).max())
            if peak > .9: samples *= .9 / peak
            temp = out / (key + f'.{os.getpid()}.tmp.wav')
            sf.write(str(temp), samples, rate, subtype='PCM_16'); temp.replace(file)
        clips[text] = '/voice/' + file.name

    return {'voice': voice, 'speed': speed, 'version': version, 'takesPerLine': 1, 'clips': clips}


def render(lines, out, models):
    lines = list(dict.fromkeys(lines))
    workers = max(1, min(4, int(os.environ.get('BALANCE_VOICE_WORKERS', '2'))))
    # Independent complete takes share no samples. Parallelism only shortens stock rendering.
    chunks = [lines[i:i+25] for i in range(0, len(lines), 25)]
    metadata = None
    clips = {}
    with ProcessPoolExecutor(max_workers=workers, mp_context=get_context('spawn')) as pool:
        pending = {pool.submit(render_chunk, (chunk, out, models)): len(chunk) for chunk in chunks}
        completed = 0
        for future in as_completed(pending):
            result = future.result()
            metadata = result
            clips.update(result['clips'])
            completed += pending[future]
            print(f'Continuous Balance voice {completed}/{len(lines)}', flush=True)
    clips = {text: clips[text] for text in lines}
    return {**metadata, 'clips': clips}
