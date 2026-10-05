"""Local media checks. JSON input/output only; private paths never enter reports."""
import sys, json, os, hashlib
from pathlib import Path
from PIL import Image, ImageOps
import numpy as np
import cv2
cv2.setNumThreads(1)

IMAGE_EXT = {'.png','.jpg','.jpeg','.webp','.gif','.bmp','.tif','.tiff','.avif','.heic','.ico'}

def hashes(image):
    image = ImageOps.exif_transpose(image).convert('RGB')
    gray = image.convert('L')
    small = np.asarray(gray.resize((9,8),Image.Resampling.LANCZOS), dtype=float)
    dh = small[:,1:] > small[:,:-1]
    pixels = np.asarray(gray.resize((32,32),Image.Resampling.LANCZOS), dtype=np.float32)
    low = cv2.dct(pixels)[:8,:8].flatten()[1:]
    ph = low > np.median(low)
    pack = lambda bits: sum(int(x)<<i for i,x in enumerate(bits.flatten()))
    return pack(dh),pack(ph),float(np.std(pixels))

def distance(a,b): return bin(a^b).count('1')

def photographic_faces(image):
    image=image.convert('RGB');image.thumbnail((960,960))
    rgb=np.asarray(image)
    # Haar is only a candidate detector. Conservative photo classification uses
    # continuous colour/texture; all candidates still require recorded review.
    gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
    classifier=cv2.CascadeClassifier(cv2.data.haarcascades+'haarcascade_frontalface_default.xml')
    faces=classifier.detectMultiScale(gray,scaleFactor=1.08,minNeighbors=5,minSize=(24,24))
    return len(faces)

def main():
    options=json.load(sys.stdin); root=Path(options['root']); refs=[]; errors=[]; count=0
    for index,folder in enumerate(options['references']):
        path=Path(folder).expanduser()
        if not path.exists(): errors.append(f'private-reference-root-{index+1}:1: missing private reference root'); continue
        for f in sorted(path.rglob('*')):
            if not f.is_file() or f.suffix.lower() not in IMAGE_EXT: continue
            count+=1
            try:
                with Image.open(f) as im: refs.append(hashes(im))
            except Exception: errors.append(f'private-reference-root-{index+1}:1: unreadable private image (path withheld)')
    records=[]
    for file in options['files']:
        if Path(file).suffix.lower() not in IMAGE_EXT: continue
        record={'path':file,'issues':[],'faces':0,'referenceMatches':0}
        try:
            with Image.open(root/file) as im:
                # Every frame is checked, including animation frames.
                for frame in range(getattr(im,'n_frames',1)):
                    im.seek(frame); current=im.copy(); dh,ph,spread=hashes(current)
                    # Low-information images use exact hashes only: solid swatches
                    # share perceptual hashes without sharing subject matter.
                    matches=sum(1 for rd,rp,rs in refs if spread>=8 and rs>=8 and distance(dh,rd)<=6 and distance(ph,rp)<=8)
                    record['referenceMatches']+=matches
                    record['faces']+=photographic_faces(current)
                preview=ImageOps.exif_transpose(im).convert('RGBA'); preview.thumbnail((240,180))
                name=hashlib.sha256(file.encode()).hexdigest()+'.png'
                preview.save(Path(options['review'])/name); record['thumbnail']=name
            if record['referenceMatches']: record['issues'].append('near-duplicate of private reference (dHash <=6 AND pHash <=8)')
            if record['faces']: record['issues'].append('face candidate: manual photographic/illustration review required')
        except Exception: record['issues'].append('image decode failed; manual review required')
        records.append(record)
    print(json.dumps({'records':records,'issues':errors,'references':count}))
if __name__=='__main__':
    try: main()
    except Exception: print(json.dumps({'issues':['media-worker:1: media scanner failed (details withheld)'],'records':[],'references':0}));sys.exit(1)
