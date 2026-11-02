"""Generate the authorized local synthetic call sample with macOS system voices.

Usage: python3 scripts/generate-recording-sample.py INPUT_JSON OUTPUT_DIR
INPUT_JSON contains callId and the original transcript (at, speaker, text).
The script writes an aligned WAV and its transcript/waveform manifest.
"""
import json
import math
import struct
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

sample = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
output = Path(sys.argv[2])
output.mkdir(parents=True, exist_ok=True)
voices = {"agent": "Tingting", "customer": "Meijia"}
rate = 22050
duration = math.ceil(sample["transcript"][-1]["at"] + 8)
pcm = bytearray(duration * rate * 2)
with tempfile.TemporaryDirectory(prefix="qc-recording-") as temp:
    for index, segment in enumerate(sample["transcript"]):
        voice = voices[segment["speaker"]]
        path = Path(temp) / (str(index) + ".wav")
        subprocess.run(["/usr/bin/say", "-v", voice, "-r", "165", "--file-format=WAVE",
                        "--data-format=LEI16@22050", "-o", str(path), segment["text"]], check=True)
        with wave.open(str(path), "rb") as audio:
            assert audio.getframerate() == rate and audio.getnchannels() == 1 and audio.getsampwidth() == 2
            frames = audio.readframes(audio.getnframes())
        end = sample["transcript"][index + 1]["at"] if index + 1 < len(sample["transcript"]) else duration
        assert len(frames) / (rate * 2) < end - segment["at"], "Speech exceeds the original transcript timing"
        start = int(segment["at"] * rate) * 2
        pcm[start:start + len(frames)] = frames
    filename = sample.pop("audioFilename", "call-1030-dialogue.wav")
    combined = output / filename
    with wave.open(str(combined), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(rate)
        audio.writeframes(pcm)

samples = struct.unpack("<" + "h" * (len(pcm) // 2), pcm)
peaks = []
for index in range(160):
    chunk = samples[len(samples) * index // 160:len(samples) * (index + 1) // 160]
    peaks.append(max((abs(value) for value in chunk), default=0))
peak = max(peaks) or 1
sample.update(src="/audio/" + filename, duration=duration, voices=voices,
              waveform=[round(value / peak, 3) for value in peaks])
(output / "recording-sample.json").write_text(json.dumps(sample, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("Generated", duration, "seconds; aligned", len(sample["transcript"]), "segments")
