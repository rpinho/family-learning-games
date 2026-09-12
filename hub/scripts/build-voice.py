"""Optional local narration; existing Kokoro models required, no API key.
Set FAMILY_VOICE_MODELS (kokoro-v1.0.onnx + voices-v1.0.bin) and FAMILY_DATA.
"""
import hashlib,json,os,subprocess
from pathlib import Path
import numpy as np
import soundfile as sf
import onnxruntime as ort
from kokoro_onnx import Kokoro
root=Path(__file__).resolve().parent.parent
out=Path(os.environ['FAMILY_DATA'])/'voice'
out.mkdir(parents=True,exist_ok=True)
models=Path(os.environ['FAMILY_VOICE_MODELS'])
opts=ort.SessionOptions();opts.intra_op_num_threads=4;opts.inter_op_num_threads=1
kokoro=Kokoro.from_session(ort.InferenceSession(str(models/'kokoro-v1.0.onnx'),sess_options=opts,providers=['CPUExecutionProvider']),str(models/'voices-v1.0.bin'))
lines=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {VOICE_LINES} from './dribble.mjs';import {INTRO,GOAL_VOICE} from './public/dribble-live.mjs';import {READING_LINES} from './public/reading-reward.mjs';console.log(JSON.stringify([...VOICE_LINES,INTRO,GOAL_VOICE,...READING_LINES]))"],cwd=root))
manifest={'voice':'af_heart','version':'dribble-us-1','clips':{}}
for text in lines:
    key=hashlib.sha256(('dribble-us-1\0'+text).encode()).hexdigest()[:16];file=out/(key+'.wav')
    if not file.exists():
        samples,rate=kokoro.create(text,voice='af_heart',speed=.95,lang='en-us')
        if not len(samples) or not np.isfinite(samples).all():raise ValueError('Invalid audio')
        temp=out/(key+'.tmp.wav');sf.write(str(temp),samples,rate,subtype='PCM_16');temp.replace(file)
    manifest['clips'][text]='/voice/'+file.name
(out/'manifest.tmp.json').write_text(json.dumps(manifest));(out/'manifest.tmp.json').replace(out/'manifest.json')
print(f'Ready: {len(lines)} American female prompts',flush=True)
