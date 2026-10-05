"""Generate finite stock American female prompts locally, never child data."""
import hashlib,json,os,subprocess
from pathlib import Path
import numpy as np
import soundfile as sf
import onnxruntime as ort
from kokoro_onnx import Kokoro
root=Path(__file__).resolve().parent.parent
out=Path(os.environ.get('TTT_DATA',Path.home()/'.local/share/three-in-a-row'))/'voice'
out.mkdir(parents=True,exist_ok=True)
models=Path.home()/'.local/share/letter-quest/voice-models'
opts=ort.SessionOptions();opts.intra_op_num_threads=4;opts.inter_op_num_threads=1
kokoro=Kokoro.from_session(ort.InferenceSession(str(models/'kokoro-v1.0.onnx'),sess_options=opts,providers=['CPUExecutionProvider']),str(models/'voices-v1.0.bin'))
lines=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {WORDS} from './engine.mjs';import {wordBreakLines} from './dist/word-break.mjs';console.log(JSON.stringify([...new Set([...Object.values(WORDS),...wordBreakLines()])]))"],cwd=root))
manifest={'voice':'af_heart','version':'three-us-1','clips':{}}
for text in lines:
    key=hashlib.sha256(('three-us-1\0'+text).encode()).hexdigest()[:16];file=out/(key+'.wav')
    if not file.exists():
        samples,rate=kokoro.create(text.replace('Xs','exes').replace('Os','ohs'),voice='af_heart',speed=.95,lang='en-us')
        if not len(samples) or not np.isfinite(samples).all():raise ValueError('Invalid audio')
        temp=out/(key+'.tmp.wav');sf.write(str(temp),samples,rate,subtype='PCM_16');temp.replace(file)
    manifest['clips'][text]='/voice/'+file.name
(out/'manifest.tmp.json').write_text(json.dumps(manifest));(out/'manifest.tmp.json').replace(out/'manifest.json')
print(f'Ready: {len(lines)} American female prompts',flush=True)
