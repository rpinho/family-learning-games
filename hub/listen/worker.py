"""Local speech recognition for short utterances (a word, a name, a letter sound). No network, nothing stored.
Reads JSON lines on stdin: {"id", "pcm": base64 16-bit little-endian mono 16 kHz, "prompt": "hint words",
"rank": {"target": [texts], "others": [texts]}} and writes one JSON line per request:
{"id", "text", "speech", "ms", "rank": {"best": "target"|"other", "target": score, "other": score}}.
- text: free transcription, nudged by the prompt (the words the page is about).
- rank: when given, which group of candidate readings explains the audio best (forced alignment scores). This is
  how "did he say bed?" is answered when the free transcription is ambiguous ("bad", "Mattt", "Hey bed").
The audio lives only in this process's memory for one request. Nothing is written to disk.
Engine: Whisper via CTranslate2 (faster-whisper's model files, from the local Hugging Face cache), with a short
encoder window (utterances are a few seconds), which is ~3x faster than the standard 30-second window.
Usage: python worker.py [--model small] [--threads 4] [--window 1000]"""
import argparse, base64, json, os, sys, time
os.environ.setdefault('HF_HUB_OFFLINE', '1')  # never download at run time
ap = argparse.ArgumentParser()
ap.add_argument('--model', default=os.environ.get('LISTEN_MODEL', 'small'))
ap.add_argument('--threads', type=int, default=int(os.environ.get('LISTEN_THREADS', '4')))
ap.add_argument('--window', type=int, default=int(os.environ.get('LISTEN_WINDOW', '1000')))  # mel frames (10 ms each)
args = ap.parse_args()
import numpy as np, ctranslate2
from faster_whisper import WhisperModel
t0 = time.time()
wm = WhisperModel(args.model, device='cpu', compute_type='int8', cpu_threads=args.threads)
tok = wm.hf_tokenizer
SOT = [tok.token_to_id(x) for x in ('<|startoftranscript|>', '<|en|>', '<|transcribe|>', '<|notimestamps|>')]
PREV = tok.token_to_id('<|startofprev|>')
EOT = tok.token_to_id('<|endoftext|>')
def encode(audio):
    f = wm.feature_extractor(audio); n = args.window
    f = f[:, :n] if f.shape[1] >= n else np.pad(f, ((0, 0), (0, n - f.shape[1])))
    return wm.model.encode(ctranslate2.StorageView.from_array(np.ascontiguousarray(f[None].astype(np.float32))))
def transcribe(enc, prompt):
    start = ([PREV] + tok.encode(' ' + prompt.strip()).ids[-60:] if prompt else []) + SOT
    r = wm.model.generate(enc, [start], beam_size=1, max_length=len(start) + 24, suppress_blank=True, return_no_speech_prob=True)[0]
    ids = [i for i in r.sequences_ids[0] if i < EOT]
    return tok.decode(ids).strip(), 1.0 - float(r.no_speech_prob)
def score(enc, frames, text):
    ids = tok.encode(' ' + text.strip()).ids
    if not ids: return -99.0
    p = np.maximum(np.array(wm.model.align(enc, SOT, [ids], [frames])[0].text_token_probs, dtype=np.float64), 1e-9)
    return float(np.mean(np.log(p)))
encode(np.zeros(16000, dtype=np.float32))  # warm-up: the first run allocates
print(json.dumps({'ready': True, 'model': args.model, 'window': args.window, 'loadMs': round((time.time() - t0) * 1000)}), flush=True)
for line in sys.stdin:
    req = {}
    try:
        req = json.loads(line); t = time.time()
        audio = np.frombuffer(base64.b64decode(req['pcm']), dtype='<i2').astype(np.float32) / 32768.0
        if audio.size < 1600: raise ValueError('too short')
        audio = np.concatenate([np.zeros(3200, np.float32), audio[: (args.window - 90) * 160], np.zeros(4800, np.float32)])
        enc = encode(audio)
        text, speech = transcribe(enc, str(req.get('prompt') or '')[:200])
        out = {'id': req.get('id'), 'text': text, 'speech': round(speech, 3)}
        rank = req.get('rank')
        if isinstance(rank, dict) and rank.get('target') and rank.get('others'):
            frames = min(args.window, len(audio) // 160) // 2
            tg = max(score(enc, frames, x) for x in rank['target'][:6])
            ot = max([score(enc, frames, x) for x in (rank.get('others') or [])[:8]] or [-99.0])
            out['rank'] = {'best': 'target' if tg > ot else 'other', 'target': round(tg, 2), 'other': round(ot, 2)}
        out['ms'] = round((time.time() - t) * 1000)
        del audio, enc
    except Exception as e:  # one bad request never stops the worker
        out = {'id': req.get('id') if isinstance(req, dict) else None, 'error': str(e)[:200]}
    print(json.dumps(out), flush=True)
