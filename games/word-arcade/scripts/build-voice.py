"""Stock American female Nova, synthesized locally. No voice cloning or child data."""
import hashlib,json,os,re,subprocess
from pathlib import Path
import numpy as np
import soundfile as sf
import onnxruntime as ort
from kokoro_onnx import Kokoro
root=Path(__file__).resolve().parents[1]
data=Path(os.environ.get('WORD_ARCADE_DATA',Path.home()/'.local/share/word-arcade'))
out=data/'voice';out.mkdir(parents=True,exist_ok=True)
models=Path.home()/'.local/share/letter-quest/voice-models'
lines=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {voiceLines} from './lib/engine.mjs';console.log(JSON.stringify(voiceLines()))"],cwd=root))
opts=ort.SessionOptions();opts.intra_op_num_threads=4;opts.inter_op_num_threads=1
kokoro=Kokoro.from_session(ort.InferenceSession(str(models/'kokoro-v1.0.onnx'),sess_options=opts,providers=['CPUExecutionProvider']),str(models/'voices-v1.0.bin'))
voice='af_heart';version='nova-us-1';manifest={'voice':voice,'version':version,'clips':{}}
# Keep old prompts usable for saved questions and already-open clients.
if (out/'manifest.json').exists():
    previous=json.loads((out/'manifest.json').read_text())
    if previous.get('voice')==voice and previous.get('version')==version:manifest['clips'].update(previous.get('clips',{}))
# Sounding out a CVC word ("Sound out mat."; key -soundout-4 = the clean letter sounds of 2026-09-28 with the longer stops b, d, t, c, g): recorded letter sounds + the word in Nova's voice (scripts/soundout.py),
# then the automatic clip check (length of each sound, clean onsets and releases, no clicks, even loudness).
import sys;sys.path.insert(0,str(root/'scripts'))
import soundout
def sound_out(word):
    samples,rate=soundout.compose(word,lambda t:kokoro.create(t,voice=voice,speed=1.0,lang='en-us'))
    bad=soundout.check(samples,word)
    if bad:raise ValueError(f'Sound-out check failed for {word}: '+'; '.join(bad))
    return samples,rate
for i,text in enumerate(lines):
    sounding=re.fullmatch(r'Sound out ([a-z]{3})\.',text)
    # Letter Slalom's after-gate lines ("mat!", "It's mat.", "F!", "Little f!") must be short: silence trimmed to 30 ms
    # before and 60 ms after, so the next row's question fits (budget: lib/slalom-timing.mjs).
    short=bool(re.fullmatch(r"[a-z]+!|It's [A-Za-z]+\.|[A-Z]!|Little [a-z]!",text))
    key=hashlib.sha256(((version+'-soundout-4' if sounding else version+'-short-1' if short else version)+'\0'+voice+'\0'+text).encode()).hexdigest()[:16];file=out/(key+'.wav')
    if not file.exists():
        samples,rate=sound_out(sounding[1]) if sounding else kokoro.create(text,voice=voice,speed=1.0,lang='en-us')
        if short:
            live=np.flatnonzero(np.abs(samples)>0.01);samples=samples[max(0,live[0]-int(rate*.03)):min(len(samples),live[-1]+int(rate*.06))]
        if not len(samples) or not np.isfinite(samples).all():raise ValueError('Invalid audio')
        sf.write(str(out/(key+'.tmp.wav')),samples,rate,subtype='PCM_16');(out/(key+'.tmp.wav')).replace(file)
    manifest['clips'][text]='/voice/'+file.name
    if (i+1)%30==0:print(f'{i+1}/{len(lines)} Nova clips',flush=True)
(out/'manifest.tmp.json').write_text(json.dumps(manifest));(out/'manifest.tmp.json').replace(out/'manifest.json')
print(f'Ready: {len(lines)} American female clips',flush=True)
# Letter Slalom timing budget from the real clip lengths: feedback + the next question must fit before the next row at
# base and go-faster speed, for both tracks. The build fails otherwise.
subprocess.check_call(['node','scripts/check-slalom-timing.mjs','--voice',str(out)],cwd=root)
