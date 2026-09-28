"""Stock narration for an isolated pond review. Output and model paths must be explicit.
Never point --out at production. The generated WAVs are private runtime files, not source assets.
"""
import argparse, hashlib, json, subprocess
from pathlib import Path
import numpy as np
import soundfile as sf
import onnxruntime as ort
from kokoro_onnx import Kokoro
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--models',required=True);a=p.parse_args()
out=Path(a.out);out.mkdir(parents=True,exist_ok=True);models=Path(a.models)
root=Path(__file__).resolve().parents[2]
lines=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {LINES} from './hub/public/pond/model.mjs';console.log(JSON.stringify(LINES))"],cwd=root))
opts=ort.SessionOptions();opts.intra_op_num_threads=2;opts.inter_op_num_threads=1
voice=Kokoro.from_session(ort.InferenceSession(str(models/'kokoro-v1.0.onnx'),sess_options=opts,providers=['CPUExecutionProvider']),str(models/'voices-v1.0.bin'))
path=out/'manifest.json';manifest=json.loads(path.read_text()) if path.exists() else {'clips':{}}
for text in lines:
 key=hashlib.sha256(('pond-stock-1\0af_heart\0'+text).encode()).hexdigest()[:16];f=out/(key+'.wav')
 if not f.exists():
  samples,rate=voice.create(text,voice='af_heart',speed=.95,lang='en-us')
  if not len(samples) or not np.isfinite(samples).all():raise ValueError('Invalid samples')
  sf.write(str(f),samples,rate,subtype='PCM_16')
 manifest['clips'][text]='/voice/'+f.name
path.write_text(json.dumps(manifest));print(f'{len(lines)} stock review lines ready')
