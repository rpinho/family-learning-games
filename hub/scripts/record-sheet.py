"""Contact sheet for record-chapter.mjs: every 2nd frame (one per second) in a grid, frames with an overlap or a
friend off the ground framed red with the reason, and the transcript's repeats listed at the top.
Usage: python3 record-sheet.py <recording dir>"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
d = sys.argv[1]; r = json.load(open(os.path.join(d, 'report.json')))
frames = sorted(f for f in os.listdir(os.path.join(d, 'frames')) if f.endswith('.jpg'))[::2]
bad = {b['frame']: b for b in r['badFrames']}
for b in r['badFrames']:
    if b['frame'] not in frames: frames.append(b['frame'])
frames.sort()
F = lambda n, bold=False: ImageFont.truetype(f"/System/Library/Fonts/Supplemental/Arial{' Bold' if bold else ''}.ttf", n)
first = Image.open(os.path.join(d, 'frames', frames[0])); tw, th = 240, round(240 * first.height / first.width)
cols = 10; rows = (len(frames) + cols - 1) // cols; head = 70 + 18 * min(8, len(r['repeats']))
im = Image.new('RGB', (cols * (tw + 6) + 10, head + rows * (th + 22) + 10), (250, 246, 236)); g = ImageDraw.Draw(im)
g.text((10, 8), f"{r['player']} {r['date']}: {r['seconds']} s, {r['frames']} frames, {len(r['repeats'])} repeated lines, {len(r['badFrames'])} frames with a problem", fill=(40, 40, 40), font=F(22, True))
g.text((10, 40), 'Red = a friend overlapping another or off the ground at that moment. One frame per second.', fill=(90, 90, 90), font=F(16))
for i, rep in enumerate(r['repeats'][:8]): g.text((10, 62 + 18 * i), f"repeated: \"{rep['text'][:90]}\" at {rep['at'][0]:.0f} s and {rep['at'][1]:.0f} s", fill=(180, 30, 30), font=F(15))
for i, f in enumerate(frames):
    x, y = 10 + (i % cols) * (tw + 6), head + (i // cols) * (th + 22)
    im.paste(Image.open(os.path.join(d, 'frames', f)).convert('RGB').resize((tw, th)), (x, y))
    t = (int(f[1:6]) - 1) * 0.5; b = bad.get(f)
    g.rectangle([x - 2, y - 2, x + tw + 1, y + th + 1], outline=(200, 30, 30) if b else (200, 190, 170), width=3 if b else 1)
    g.text((x, y + th + 3), f"{t:.0f}s" + (f"  p{b['page']} {', '.join(b['why'])[:34]}" if b else ''), fill=(200, 30, 30) if b else (90, 90, 90), font=F(13))
im.save(os.path.join(d, 'sheet.jpg'), quality=82)
