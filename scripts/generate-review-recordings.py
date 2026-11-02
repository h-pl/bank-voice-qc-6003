"""Generate local two-voice samples for explicitly collected review-call transcripts.

node --experimental-strip-types scripts/collect-review-audio.mjs /tmp/review-audio-input.json
python3 scripts/generate-review-recordings.py /tmp/review-audio-input.json public/audio lib/review-recordings.json
Existing call audio takes priority at runtime. No user records are changed.
"""
import hashlib
import json
import math
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import wave

RATE = 22050
VOICES = {'agent': 'Tingting', 'customer': 'Meijia'}
groups = json.loads(Path(sys.argv[1]).read_text())
output = Path(sys.argv[2])
output.mkdir(parents=True, exist_ok=True)
manifest = []
cache = {}
with tempfile.TemporaryDirectory(prefix='qc-review-voice-') as temp:
    def speech(text, role, speed=165):
        key = (text, role, speed)
        if key not in cache:
            path = Path(temp) / (hashlib.sha256(str(key).encode()).hexdigest() + '.wav')
            subprocess.run(['/usr/bin/say', '-v', VOICES[role], '-r', str(speed),
                            '--file-format=WAVE', '--data-format=LEI16@22050', '-o', str(path), text], check=True)
            with wave.open(str(path), 'rb') as audio:
                assert (audio.getnchannels(), audio.getsampwidth(), audio.getframerate()) == (1, 2, RATE)
                cache[key] = audio.readframes(audio.getnframes())
        return cache[key]

    # Verify the installed voices do not silently fall back to the same engine voice.
    probe = '您好，请帮我核对业务办理进度。'
    assert speech(probe, 'agent') != speech(probe, 'customer'), 'Role voices must produce different PCM'
    for group in groups:
        transcript = group['transcript']
        duration = math.ceil(transcript[-1]['at'] + 8)
        pcm = bytearray(duration * RATE * 2)
        timings = []
        for index, segment in enumerate(transcript):
            end = transcript[index + 1]['at'] if index + 1 < len(transcript) else duration
            available = end - segment['at']
            assert segment['at'] >= 0 and available > 0
            for speed in [165, 180, 195, 210, 225, 240]:
                frames = speech(segment['text'], segment['speaker'], speed)
                speech_duration = len(frames) / (RATE * 2)
                if speech_duration < available - 0.08:
                    break
            else:
                raise ValueError(f'Speech cannot fit without truncation: {group["callIds"]}, segment {index}')
            start = round(segment['at'] * RATE) * 2
            pcm[start:start + len(frames)] = frames
            timings.append({'at': segment['at'], 'end': end, 'speechDuration': speech_duration,
                            'voice': VOICES[segment['speaker']], 'rate': speed})
        digest = hashlib.sha256(pcm).hexdigest()[:16]
        filename = f'review-dialogue-{digest}.wav'
        with wave.open(str(output / filename), 'wb') as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(RATE)
            audio.writeframes(pcm)
        samples = struct.unpack('<' + 'h' * (len(pcm) // 2), pcm)
        peaks = [max((abs(v) for v in samples[len(samples)*i//160:len(samples)*(i+1)//160]), default=0) for i in range(160)]
        peak = max(peaks) or 1
        manifest.append({**group, 'src': '/audio/' + filename, 'duration': duration,
                         'voices': VOICES, 'timings': timings,
                         'waveform': [round(value / peak, 3) for value in peaks]})
        print(f'{len(manifest)}/{len(groups)}: {filename} ({duration}s, {len(group["callIds"])} call bindings)', flush=True)
Path(sys.argv[3]).write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
