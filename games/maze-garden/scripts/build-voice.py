"""Generate short, stock American voice prompts locally; never send child data."""
import hashlib,json,os
from pathlib import Path
import numpy as np
import soundfile as sf
import onnxruntime as ort
from kokoro_onnx import Kokoro
out=Path(os.environ.get('MAZE_DATA_DIR',Path.home()/'.local/share/maze-garden'))/'voice'
out.mkdir(parents=True,exist_ok=True)
models=Path.home()/'.local/share/letter-quest/voice-models'
opts=ort.SessionOptions();opts.intra_op_num_threads=4;opts.inter_op_num_threads=1
kokoro=Kokoro.from_session(ort.InferenceSession(str(models/'kokoro-v1.0.onnx'),sess_options=opts,providers=['CPUExecutionProvider']),str(models/'voices-v1.0.bin'))
lines=['Help the rabbit find the carrot.','Help the turtle find the island.','Help the bee find the flower.','Help the rocket reach the planet.','Help the penguin find the fish.','Help the monkey find the banana.','Help the fox find its home.','Help the dragon find the gem.','What comes next in the pattern?','Count the stars. How many?','You found the way!','Sound is on.']
lines += ['Look at the circle. Which way could you go?','Go back along your trail. Follow the arrow.','Try the arrow, then find the next turn.']
lines += list('ACDFGIMNORST')+[f'Find the lowercase letter {c}.' for c in 'ACDFGIMNORST']+[str(i) for i in range(1,10)]
lines += ['Make a trail. Start at the rabbit. Reach the flag.','Follow the open paths to the flag.','Draw a trail. Leave empty squares for tricky branches. Reach the flag.','Drag the rabbit through the maze to the flag.']
lines += [f'Which letter starts {word}?' for word in ['sun','moon','top']]
maker_words=['cat','hat','mat','sun','run','fun','top','hop','mop',
             'pen','hen','ten','map','cap','tap','pig','big','wig',
             'dog','log','fog','bug','hug','mug','fin','pin','tin',
             'jet','net','pet','cut','nut','hut']
lines += [f'Listen. Find {word}.' for word in maker_words]
lines += maker_words
import subprocess
lines += json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {wordBreakLines} from './public/word-break.mjs';console.log(JSON.stringify(wordBreakLines()))"],cwd=Path(__file__).resolve().parent.parent))
lines = list(dict.fromkeys(lines))
manifest={'voice':'af_heart','clips':{}}
for text in lines:
    key=hashlib.sha256(('maze-us-1\0'+text).encode()).hexdigest()[:16];file=out/(key+'.wav')
    if not file.exists():
        samples,rate=kokoro.create(text,voice='af_heart',speed=.95,lang='en-us')
        if not len(samples) or not np.isfinite(samples).all():raise ValueError('Invalid audio')
        sf.write(str(file),samples,rate,subtype='PCM_16')
    manifest['clips'][text]='/voice/'+file.name
(out/'manifest.json').write_text(json.dumps(manifest))
print(f'Ready: {len(lines)} local American voice clips',flush=True)
