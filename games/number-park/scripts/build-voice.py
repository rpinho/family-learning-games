"""Finite stock American female prompts. Local inference; no child data."""
import hashlib,json,os,subprocess,sys
sys.dont_write_bytecode=True
from pathlib import Path
import shutil
import numpy as np
import soundfile as sf
import onnxruntime as ort
from kokoro_onnx import Kokoro

def main():
    out=Path(os.environ.get('NUMBER_PARK_DATA',Path.home()/'.local/share/number-park'))/'voice'
    out.mkdir(parents=True,exist_ok=True)
    models=Path.home()/'.local/share/letter-quest/voice-models'
    lines=['Tap and count.','What comes next?','Take away. How many are left?','Slide to the missing number.','Find the missing number.','Lesson complete.','Put the groups together. How many?','Trace a rectangle.','Trace a triangle.','Trace a square.']+[str(i) for i in range(14)]
    opts=ort.SessionOptions();opts.intra_op_num_threads=4;opts.inter_op_num_threads=1
    lines+=['Count only the '+noun+'.' for noun in ['apples','stars','fish','strawberries','soccer balls','butterflies']]
    lines+=[f'Take away {i}. How many are left?' for i in range(14)]
    lines+=['Find the missing factor.','Multiply these numbers.','Count in equal jumps. What comes next?','Build the number from tens and ones.','How many tens?','How many ones?']
    balance_lines=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {balanceVoiceLines} from './lib/balance.mjs'; import {kinderBalanceVoiceLines} from './lib/balance-kinder.mjs'; console.log(JSON.stringify([...new Set([...balanceVoiceLines(),...kinderBalanceVoiceLines()])]))"],cwd=Path(__file__).resolve().parent.parent))
    lines+=['Find the missing picture.','Which two pictures come next?','Drag a picture into the gap.','Which picture starts the pattern?']
    lines+=[str(i) for i in range(14,1001)]
    lines+=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {shapeVoiceLines} from './lib/shapes.mjs'; console.log(JSON.stringify(shapeVoiceLines()))"],cwd=Path(__file__).resolve().parent.parent))
    reading=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {PHONEMES,readingVoiceLines} from './lib/reading.mjs'; console.log(JSON.stringify({phonemes:PHONEMES,lines:readingVoiceLines()}))"],cwd=Path(__file__).resolve().parent.parent))
    lines+=reading['lines']
    lines+=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {planningVoiceLines} from './lib/planning.mjs'; console.log(JSON.stringify(planningVoiceLines()))"],cwd=Path(__file__).resolve().parent.parent))
    lines+=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {artVoiceLines} from './lib/art.mjs'; console.log(JSON.stringify(artVoiceLines()))"],cwd=Path(__file__).resolve().parent.parent))
    lines+=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {cookieVoiceLines} from './lib/cookie-division.mjs'; console.log(JSON.stringify(cookieVoiceLines()))"],cwd=Path(__file__).resolve().parent.parent))
    lines+=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {kinderVoiceLines} from './lib/cookie-kinder.mjs'; console.log(JSON.stringify(kinderVoiceLines()))"],cwd=Path(__file__).resolve().parent.parent))
    lines+=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {placeVoiceLines} from './lib/place-build.mjs'; console.log(JSON.stringify(placeVoiceLines()))"],cwd=Path(__file__).resolve().parent.parent))
    lines+=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {worthVoiceLines} from './lib/place-worth.mjs'; console.log(JSON.stringify(worthVoiceLines()))"],cwd=Path(__file__).resolve().parent.parent))
    lines+=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {recapVoiceLines} from './lib/recap.mjs'; console.log(JSON.stringify(recapVoiceLines()))"],cwd=Path(__file__).resolve().parent.parent))
    lines+=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {storyVoiceLines} from './lib/story.mjs'; console.log(JSON.stringify(storyVoiceLines()))"],cwd=Path(__file__).resolve().parent.parent))
    # Word breaks (shared word-break.mjs): letter/word prompts, the sentence bank and short feedback.
    lines+=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {wordBreakLines} from './lib/word-break.mjs'; console.log(JSON.stringify(wordBreakLines()))"],cwd=Path(__file__).resolve().parent.parent))

    # Split parts of mixed prompts (sound rule: content always, how-to instruction once per session).
    lines+=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {speechParts} from './lib/speech-rule.mjs'; let t=''; process.stdin.on('data',d=>t+=d).on('end',()=>console.log(JSON.stringify(speechParts(JSON.parse(t)))))"],input=json.dumps(lines).encode(),cwd=Path(__file__).resolve().parent.parent))
    # Older already-open screens may still request the former mission wording.
    lines+=['Draw a round shape. Connect the ends.','Draw four sides. Connect the ends.','Draw three sides. Connect the ends.']
    kokoro=None  # Cached releases do not need an inference session.
    voice='af_heart';version='number-park-us-1';manifest={'voice':voice,'version':version,'clips':{}}
    shared=Path(os.environ.get('LETTER_SOUNDS',Path.home()/'.local/share/family-games/letter-sounds'))
    recorded_path=out/'reading-sounds.json'
    recorded=json.loads(recorded_path.read_text()) if recorded_path.exists() else None
    for index,text in enumerate(lines):
        if index%50==0:print(f'Preparing voice {index}/{len(lines)}',flush=True)
        sound=text[len('Reading sound '):-1] if text.startswith('Reading sound ') else None
        source=shared/(sound+'.wav') if sound else None
        if source and source.is_file():
            key=hashlib.sha256(('recorded-phone-full-level-soft-v3\0'+hashlib.sha256(source.read_bytes()).hexdigest()).encode()).hexdigest()[:16]
            file=out/(key+'.wav')
            if not file.exists():
                samples,rate=sf.read(source,dtype='float32')
                if rate!=24000 or samples.ndim!=1 or not len(samples) or not np.isfinite(samples).all():raise ValueError('Invalid reviewed sound '+sound)
                peak=float(np.max(np.abs(samples)))
                # The original i/o vowel has a hard glottal attack. Soften its first
                # 25 ms without shortening the recording or altering its release.
                if sound in 'io':
                    onset=max(0,int(np.flatnonzero(np.abs(samples)>peak*.1)[0])-24)
                    n=min(600,len(samples)-onset)
                    samples[onset:onset+n]*=.5-.5*np.cos(np.linspace(0,np.pi,n))
                active=samples[np.abs(samples)>peak*.1]
                gain=min(64.,.8/max(peak,1e-8),.11/max(float(np.sqrt(np.mean(active**2))),1e-8))
                full=np.concatenate((np.zeros(2880,dtype='float32'),samples*gain,np.zeros(6000,dtype='float32')))
                sf.write(out/(key+'.tmp.wav'),full,rate,subtype='PCM_16');(out/(key+'.tmp.wav')).replace(file)
            manifest['clips'][text]='/voice/'+file.name
            continue
        if recorded and text in recorded['clips']:
            clip=recorded['clips'][text]['url']
            if not (out/Path(clip).name).is_file():raise ValueError('Missing recorded sound '+text)
            manifest['clips'][text]=clip
            continue
        sound=text[len('Reading sound '):-1] if text.startswith('Reading sound ') else None
        spoken=reading['phonemes'][sound] if sound else text[len('Reading word '):-1] if text.startswith('Reading word ') else text
        policy='number-park-phoneme-1' if sound else version
        key=hashlib.sha256((policy+'\0'+voice+'\0'+text).encode()).hexdigest()[:16];file=out/(key+'.wav')
        cache=Path(os.environ['BALANCE_VOICE_CACHE'])/file.name if os.environ.get('BALANCE_VOICE_CACHE') else None
        if not file.exists() and cache and cache.is_file():shutil.copyfile(cache,file)
        if not file.exists():
            if kokoro is None:
                kokoro=Kokoro.from_session(ort.InferenceSession(str(models/'kokoro-v1.0.onnx'),sess_options=opts,providers=['CPUExecutionProvider']),str(models/'voices-v1.0.bin'))
            samples,rate=kokoro.create(spoken,voice=voice,speed=.85 if sound else 1.0,lang='en-us',is_phonemes=bool(sound))
            if not len(samples) or not np.isfinite(samples).all():raise ValueError('Invalid audio')
            sf.write(str(out/(key+'.tmp.wav')),samples,rate,subtype='PCM_16');(out/(key+'.tmp.wav')).replace(file)
        manifest['clips'][text]='/voice/'+file.name
    del kokoro
    from render_balance_voice import render
    manifest['balance']=render(balance_lines,out,models)
    manifest['clips'].update(manifest['balance']['clips'])
    if recorded:manifest['readingSounds']={k:recorded[k] for k in ['version','source','credit','scope']}
    (out/'manifest.tmp.json').write_text(json.dumps(manifest));(out/'manifest.tmp.json').replace(out/'manifest.json')
    print(f"Ready: {len(manifest['clips'])} stock clips ({len(manifest['balance']['clips'])} continuous Balance lines)",flush=True)

if __name__ == '__main__':
    main()
