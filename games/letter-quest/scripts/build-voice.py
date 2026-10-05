"""Render the finite dialogue inventory locally; never sends text to a service.

Run with ~/.local/share/letter-quest-voice-env/bin/python scripts/build-voice.py
Requires kokoro-onnx==0.4.9, soundfile, model/voices in the data voice-models folder.
"""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import subprocess
import time
import numpy as np
import onnxruntime as ort
import soundfile as sf
from kokoro_onnx import Kokoro

parser = argparse.ArgumentParser()
parser.add_argument('--limit', type=int, default=0)
parser.add_argument('--recorded-phonics', type=Path, help='Private directory with reviewed single-sound <letter>.wav files')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
data = Path(os.environ.get('LETTER_QUEST_DATA', Path.home()/'.local/share/letter-quest'))
models = data/'voice-models'
output = data/'voice'
output.mkdir(parents=True, exist_ok=True)
lines = json.loads(subprocess.check_output(['node', str(root/'scripts/voice-lines.mjs')]))
phonemes = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', "import {PHONEMES} from './public/phonics.mjs'; console.log(JSON.stringify(PHONEMES))"], cwd=root))
if args.limit:
    lines = lines[:args.limit]
options = ort.SessionOptions()
options.intra_op_num_threads = 4
options.inter_op_num_threads = 1
session = ort.InferenceSession(str(models/'kokoro-v1.0.onnx'), sess_options=options, providers=['CPUExecutionProvider'])
kokoro = Kokoro.from_session(session, str(models/'voices-v1.0.bin'))
# Stock American male voice for Rook Classic.
voice = 'am_michael'
manifest = {'version': 'rook-neural-v2-us', 'voice': voice, 'engine': 'Kokoro-82M', 'clips': {}}
start = time.monotonic()
for index, text in enumerate(lines):
    # Whole-word prompts must not go through the single-letter pronunciation rule.
    sound = re.fullmatch(r'Sound ([a-z])\.', text)
    recording = args.recorded_phonics/(sound[1]+'.wav') if sound and args.recorded_phonics else None
    policy = 'phoneme-v2-padded' if sound else 'word-prompt-v1' if text.startswith('Find the word ') else 'rook-neural-v2-us'
    digest = hashlib.sha256((policy+'\0'+voice+'\0'+text).encode()).hexdigest()[:16]
    if recording:
        digest=hashlib.sha256(('recorded-phone-full-level-v2\0'+hashlib.sha256(recording.read_bytes()).hexdigest()).encode()).hexdigest()[:16]
    filename = digest+'.wav'
    destination = output/filename
    if not destination.exists():
        # Letter names are explicitly spoken as letters; keep on-screen text unchanged.
        spoken = text
        if re.fullmatch(r'Find (?:little )?[A-Z0-9]\.', text):
            token = text[5:-1]
            if token.isdigit():
                spoken = f'Find the number {token}.'
            else:
                spoken = 'Find the '+('little letter '+token[7:] if token.startswith('little ') else 'letter '+token)+'.'
        if recording:
            samples,rate=sf.read(recording,dtype='float32')
            if samples.ndim!=1:raise ValueError('Recorded phonics must be mono')
        else:
            samples, rate = kokoro.create(phonemes[sound[1]] if sound else spoken, voice=voice, speed=0.85 if sound else 1.0, lang='en-us', is_phonemes=bool(sound))
        if rate != 24000 or not len(samples) or not np.isfinite(samples).all():
            raise ValueError('Invalid generated audio')
        if recording:
            peak=float(np.max(np.abs(samples))); active=samples[np.abs(samples)>peak*.1]
            gain=min(64.,.8/max(peak,1e-8),.11/max(float(np.sqrt(np.mean(active**2))),1e-8))
            samples=samples*gain
            samples=np.concatenate((np.zeros(int(rate*.12),dtype=samples.dtype),samples,np.zeros(int(rate*.25),dtype=samples.dtype)))
        elif sound:
            # Isolated consonants are naturally only a few tenths of a second.
            # Keep the phoneme honest, but give the tablet player enough lead
            # and tail room that it never sounds clipped between quick taps.
            lead = int(rate*.16)
            tail = max(int(rate*.28), int(rate*1.05)-lead-len(samples))
            samples = np.concatenate((np.zeros(lead, dtype=samples.dtype), samples, np.zeros(tail, dtype=samples.dtype)))
        temporary = output/(digest+'.tmp.wav')
        sf.write(str(temporary), samples, rate, subtype='PCM_16')
        temporary.replace(destination)
    manifest['clips'][text] = '/voice/'+filename
    if (index+1)%20 == 0 or index+1 == len(lines):
        print(f'Generated {index+1}/{len(lines)} clips in {time.monotonic()-start:.1f}s', flush=True)
temporary_manifest=output/'manifest.tmp.json'
temporary_manifest.write_text(json.dumps(manifest, indent=2))
temporary_manifest.replace(output/'manifest.json')
print(f'Voice ready: {voice}, {len(lines)} complete clips', flush=True)
