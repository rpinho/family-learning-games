"""The Book: square character portraits cropped from a grown-up's toy photos (private data only).
Usage: python3 book/portraits.py <cast.json>   -> writes cast/<id>.jpg next to cast.json.
Each cast entry with "photo" and "box" [x, y, size] (in a 480px-wide preview of the photo) is cropped,
resized to 360x360 and saved as JPEG with no metadata. Needs Pillow.
"""
import json, os, sys
from pathlib import Path
from PIL import Image, ImageOps
cfg_path = Path(sys.argv[1]); cfg = json.loads(cfg_path.read_text())
photos = Path(os.path.expanduser(cfg['photos'])); out = cfg_path.parent / 'cast'; out.mkdir(mode=0o700, exist_ok=True)
for c in cfg['cast']:
    if not c.get('photo') or not c.get('box'): continue
    img = ImageOps.exif_transpose(Image.open(photos / c['photo'])).convert('RGB')
    k = img.width / 480; x, y, s = (round(v * k) for v in c['box'])
    crop = img.crop((x, y, min(img.width, x + s), min(img.height, y + s))).resize((360, 360), Image.LANCZOS)
    dest = out / (c['id'] + '.jpg'); tmp = out / (c['id'] + '.tmp.jpg')
    crop.save(tmp, 'JPEG', quality=86, optimize=True); os.chmod(tmp, 0o600); tmp.replace(dest)
    print(dest)
