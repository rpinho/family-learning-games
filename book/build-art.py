"""The Book: build a household's picture library from source images.
Usage: python3 book/build-art.py <art dir>   (reads <art>/spec.json and <art>/src/<id>.png, writes <art>/lib/)
spec.json: {"actors": {"<actor>": {"name", "h"}}, "fly": ["<actor>-<pose>"], "items": [{"id", "type": "sprite"|"background",
"about"?, "h"?, "seats"?, "cars"? (a train's wagons and engine, see hub/public/book-scene.mjs), "goal"?: [x, y, w, h] of a soccer goal in the picture}]}. Sprites are "<actor>-<pose>" when <actor> is listed in "actors", otherwise props.
Sprites are trimmed to their visible pixels; everything becomes WebP. Needs Pillow."""
import json, sys
from pathlib import Path
from PIL import Image
art = Path(sys.argv[1]); spec = json.loads((art / 'spec.json').read_text())
src, lib = art / 'src', art / 'lib'
for d in ('bg', 'actors', 'props'): (lib / d).mkdir(parents=True, exist_ok=True)
actors = spec.get('actors', {}); fly = set(spec.get('fly', []))
out = {'backgrounds': {}, 'actors': {}, 'props': {}}
def sky(im):
    """A background with transparent parts gets a soft sky behind it."""
    bg = Image.new('RGBA', im.size)
    for y in range(im.height):
        t = y / im.height; c = (int(150 + 80 * t), int(205 + 40 * t), int(245 + 10 * t), 255)
        bg.paste(c, (0, y, im.width, y + 1))
    bg.alpha_composite(im); return bg
import re, shutil
for it in spec['items']:
    f = src / f"{it['id']}.png"
    svg = src / f"{it['id']}.svg"
    if not f.exists() and svg.exists() and it['type'] == 'sprite':
        # Hand-drawn SVG sprite: copied as is; its aspect ratio comes from the viewBox.
        vb = [float(x) for x in re.search(r'viewBox="([^"]+)"', svg.read_text()).group(1).split()]
        ar = round(vb[2] / vb[3], 3); actor = next((a for a in sorted(actors, key=len, reverse=True) if it['id'].startswith(a + '-')), None)
        name = f"{'actors' if actor else 'props'}/{it['id']}.svg"; shutil.copyfile(svg, lib / name)
        if actor:
            a = out['actors'].setdefault(actor, {'name': actors[actor].get('name', actor), 'h': actors[actor].get('h', 0.4), 'poses': {}})
            a['poses'][it['id'][len(actor) + 1:]] = {'file': name, 'ar': ar}
        else: out['props'][it['id']] = {'file': name, 'h': it.get('h', 0.12), 'ar': ar, 'about': it.get('about', it['id'])}
        continue
    if not f.exists(): continue
    im = Image.open(f).convert('RGBA')
    if it['type'] == 'background':
        if im.getextrema()[3][0] < 250: im = sky(im)
        im = im.convert('RGB'); im.thumbnail((1600, 1600))
        name = f"bg/{it['id']}.webp"; im.save(lib / name, 'WEBP', quality=82, method=5)
        out['backgrounds'][it['id']] = {'file': name, 'about': it.get('about', it['id'].replace('-', ' ')), **({'goal': it['goal']} if it.get('goal') else {})}
        continue
    box = im.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox() or (0, 0, im.width, im.height)
    pad = 6; box = (max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad))
    im = im.crop(box); im.thumbnail((900, 900))
    ar = round(im.width / im.height, 3)
    actor = next((a for a in sorted(actors, key=len, reverse=True) if it['id'].startswith(a + '-')), None)
    if actor:
        pose = it['id'][len(actor) + 1:]; name = f"actors/{it['id']}.webp"
        a = out['actors'].setdefault(actor, {'name': actors[actor].get('name', actor), 'h': actors[actor].get('h', 0.4), 'poses': {}})
        a['poses'][pose] = {'file': name, 'ar': ar, **({'fly': True} if it['id'] in fly else {})}
    else:
        name = f"props/{it['id']}.webp"
        out['props'][it['id']] = {'file': name, 'h': it.get('h', 0.12), 'ar': ar, 'about': it.get('about', it['id'].replace('-', ' ')), **({'seats': it['seats']} if it.get('seats') else {}), **({'cars': it['cars']} if it.get('cars') else {})}
    im.save(lib / name, 'WEBP', quality=86, method=5)
(lib / 'library.json').write_text(json.dumps(out, indent=1))
print(f"{len(out['backgrounds'])} backgrounds, {len(out['actors'])} actors ({sum(len(a['poses']) for a in out['actors'].values())} poses), {len(out['props'])} props")
