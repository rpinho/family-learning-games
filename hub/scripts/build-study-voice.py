"""Original stock narration for a review study; output only to the deployer's cloned voice store."""
import hashlib,json,os,subprocess
from pathlib import Path
import numpy as np
import soundfile as sf
import onnxruntime as ort
from kokoro_onnx import Kokoro
root=Path.cwd();data=Path(os.environ['FAMILY_DATA']);out=data/'chess-voice';models=data/'voice-models'
lines=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {LINES} from './hub/public/study/activity.mjs'; console.log(JSON.stringify(LINES));"],cwd=root))
manifest=json.loads((out/'manifest.json').read_text());clips=dict(manifest['clips']);opts=ort.SessionOptions();opts.intra_op_num_threads=2;opts.inter_op_num_threads=1
engine=None
for text in lines:
    name=hashlib.sha256(('book-study-stock-v1\\0af_bella\\0'+text).encode()).hexdigest()[:16]+'.wav';dest=out/name
    if not dest.exists():
        if engine is None:engine=Kokoro.from_session(ort.InferenceSession(str(models/'kokoro-v1.0.onnx'),sess_options=opts,providers=['CPUExecutionProvider']),str(models/'voices-v1.0.bin'))
        audio,rate=engine.create(text,voice='af_bella',speed=.9,lang='en-us')
        if rate!=24000 or len(audio)<4800 or not np.isfinite(audio).all():raise ValueError('Invalid study narration')
        peak=np.abs(audio).max();audio=audio*min(1,.9/max(float(peak),1e-6));temp=out/(name+'.tmp.wav');sf.write(str(temp),audio,rate,subtype='PCM_16');temp.replace(dest)
    clips['Study: '+text]='/chess-voice/'+name
manifest={**manifest,'clips':clips,'studyVoice':'af_bella','studyVoiceProvenance':'Original stock Kokoro narration, no reference conditioning'}
p=out/'manifest.study.tmp.json';p.write_text(json.dumps(manifest));p.replace(out/'manifest.json');print(json.dumps({'studyLines':len(lines),'voice':'af_bella'}))
