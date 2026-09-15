"""Optional original coach narration using a local stock Kokoro voice.
Usage: python scripts/build-chess-voice.py --models /path/to/models --data /path/to/hub-data
Requires kokoro-onnx==0.4.9, onnxruntime, numpy, soundfile. No network calls.
Without these clips the game stays text-only; it never substitutes robotic device speech.
"""
import argparse, hashlib, json, subprocess, time
from pathlib import Path
import numpy as np
import onnxruntime as ort
import soundfile as sf
from kokoro_onnx import Kokoro
parser=argparse.ArgumentParser()
parser.add_argument('--models',type=Path,required=True)
parser.add_argument('--data',type=Path,required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
lines=json.loads(subprocess.check_output(['node',str(root/'scripts/chess-voice-lines.mjs')]))
options=ort.SessionOptions();options.intra_op_num_threads=4;options.inter_op_num_threads=1
session=ort.InferenceSession(str(args.models/'kokoro-v1.0.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
model=Kokoro.from_session(session,str(args.models/'voices-v1.0.bin'))
voice='am_michael';output=args.data/'chess-voice';output.mkdir(parents=True,exist_ok=True)
manifest={'version':'rook-chess-v2','voice':voice,'engine':'Kokoro-82M','clips':{}}
start=time.monotonic()
for i,text in enumerate(lines):
 digest=hashlib.sha256(('rook-chess-v2\0'+voice+'\0'+text).encode()).hexdigest()[:16]
 path=output/(digest+'.wav')
 if not path.exists():
  samples,rate=model.create(text,voice=voice,speed=1.0,lang='en-us')
  if rate!=24000 or not len(samples) or not np.isfinite(samples).all():raise ValueError('Invalid audio')
  temp=output/(digest+'.tmp.wav');sf.write(str(temp),samples,rate,subtype='PCM_16');temp.replace(path)
 manifest['clips'][text]='/chess-voice/'+path.name
 if (i+1)%10==0:print(f'{i+1}/{len(lines)} clips, {time.monotonic()-start:.0f}s',flush=True)
temp=output/'manifest.tmp.json';temp.write_text(json.dumps(manifest,indent=2));temp.replace(output/'manifest.json')
print(f'Complete: {len(lines)} original coaching lines, stock {voice} voice',flush=True)
