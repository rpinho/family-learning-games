"""Optional household narration workers. No models or household settings in source.

voice-renderers.json: {"voices": {"local:<versioned-id>": {"command": ["python", "worker.py"],
"timeout": 600}}}. A worker accepts one request JSON path and prints {"clips": {id: filename}}.
It receives the original text/phoneme tags, speed and shared-sound paths unchanged.
Workers write only into a temporary directory; the complete batch is checked before publication.
"""
import array
import json
import os
import subprocess
import sys
import tempfile
import wave
from pathlib import Path


def validate_wav(path):
    with wave.open(str(path), 'rb') as w:
        if w.getnchannels() != 1 or w.getsampwidth() != 2 or w.getframerate() != 24000 or w.getcomptype() != 'NONE':
            raise ValueError('external narration must be mono 24 kHz PCM16')
        frames = w.getnframes()
        if not 2400 <= frames <= 24000 * 180:
            raise ValueError('external narration has invalid duration')
        data = w.readframes(frames)
        if len(data) != frames * 2:
            raise ValueError('external narration is truncated')
    samples = array.array('h', data)
    if sys.byteorder != 'little':
        samples.byteswap()
    peak = max(abs(s) for s in samples)
    if not 16 <= peak <= 30000:
        raise ValueError('external narration is silent or clipping')


def render_external(lines, req, out):
    config_file = req.get('voice_renderers')
    if not config_file:
        raise ValueError('local voice requires private voice-renderers.json')
    config = json.loads(Path(config_file).read_text()).get('voices', {})
    groups = {}
    for k, line in lines.items():
        groups.setdefault(line['voice'], {})[k] = line
    with tempfile.TemporaryDirectory(prefix='book-render-', dir=out) as temporary:
        root = Path(temporary)
        validated = []
        for i, (voice, batch) in enumerate(groups.items()):
            setting = config.get(voice, {})
            command = setting.get('command')
            if not isinstance(command, list) or not command or not all(isinstance(c, str) and c for c in command):
                raise ValueError('no configured renderer for local voice: ' + voice)
            folder = root / str(i)
            folder.mkdir()
            request = folder / 'request.json'
            request.write_text(json.dumps({**req, 'out': str(folder), 'lines': [{'id': k, **l} for k, l in batch.items()]}))
            result = subprocess.run([*command, str(request)], capture_output=True, text=True,
                                    timeout=min(900, max(1, int(setting.get('timeout', 600)))))
            if result.returncode:
                raise RuntimeError('external narration failed: ' + result.stderr[-2000:])
            clips = json.loads(result.stdout.strip().splitlines()[-1]).get('clips', {})
            if set(clips) != set(batch):
                raise ValueError('external renderer returned an incomplete batch')
            for k, name in clips.items():
                if not isinstance(name, str) or Path(name).name != name:
                    raise ValueError('external renderer returned an unsafe filename')
                source = folder / name
                if source.is_symlink() or not source.is_file():
                    raise ValueError('external renderer clip is missing or a link')
                validate_wav(source)
                validated.append((k, source))
        for k, source in validated:
            target = out / (k + '.wav')
            # Cache publication never replaces an existing recording.
            try:
                os.chmod(source, 0o600)
                os.link(source, target)
            except FileExistsError:
                validate_wav(target)
