"""Offline Qwen worker. stdout is JSON protocol; model diagnostics go to stderr."""
import base64
import contextlib
import json
import os
from pathlib import Path
import sys
import time

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')
model = None
prompts = {}
backend = None
fast = False
root = Path(sys.argv[1])
refs = Path(__file__).parent / 'voices'
for line in sys.stdin:
    request = json.loads(line)
    try:
        started = time.monotonic()
        language = request['language']
        if language not in ('English', 'Chinese'):
            raise ValueError('Unsupported speech language')
        text = request['text']
        if not isinstance(text, str) or not 0 < len(text) <= 600:
            raise ValueError('Invalid speech text')
        with contextlib.redirect_stdout(sys.stderr):
            import numpy as np
            import torch
            from qwen_tts import Qwen3TTSModel
            torch.set_num_threads(2)
            requested = request.get('device', 'auto')
            if requested not in ('auto', 'gpu', 'cpu'):
                raise ValueError('Invalid speech device')
            if model is None:
                gpu = requested != 'cpu' and torch.cuda.is_available()
                if requested == 'gpu' and not gpu:
                    raise RuntimeError('GPU speech is selected but this runtime cannot access the GPU. Run GPU setup or choose CPU.')
                device = 'cuda:0' if gpu else 'cpu'
                backend = ('ROCm' if torch.version.hip else 'CUDA') if gpu else 'CPU'
                # Half precision reduces VRAM pressure alongside Ollama on 6 GB cards.
                dtype = (torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16) if gpu else torch.float32
                # The graph engine reuses the same unquantized weights and reference voice.
                # Keep CPU/ROCm on the original path until graph capture is verified there.
                fast = gpu and not torch.version.hip
                if fast:
                    try:
                        from faster_qwen3_tts import FasterQwen3TTS
                    except ModuleNotFoundError as error:
                        if error.name != 'faster_qwen3_tts':
                            raise
                        # Previously prepared runtimes remain usable until repaired.
                        fast = False
                        backend += ' (standard; repair GPU setup for acceleration)'
                if fast:
                    model = FasterQwen3TTS.from_pretrained(str(root), device=device, dtype=dtype, attn_implementation='sdpa', max_seq_len=2048)
                else:
                    model = Qwen3TTSModel.from_pretrained(str(root), device_map=device, dtype=dtype, attn_implementation='sdpa', local_files_only=True)
            key = language.lower()
            if key not in prompts:
                meta = json.loads((refs / (key + '.json')).read_text(encoding='utf-8'))
                base = model.model if fast else model
                prompts[key] = base.create_voice_clone_prompt(ref_audio=str(refs / (key + '.wav')), ref_text=meta['text'], x_vector_only_mode=False)
            with torch.inference_mode():
                options = dict(text=text, language=language, voice_clone_prompt=prompts[key], max_new_tokens=1024)
                if fast:
                    chunks = model.generate_voice_clone_streaming(**options, chunk_size=8)
                else:
                    waves, rate = model.generate_voice_clone(**options)
                    chunks = [(waves[0], rate, {})]
                total = 0
                for wave, rate, _ in chunks:
                    samples = np.asarray(wave, dtype='<f4').reshape(-1)
                    if not len(samples):
                        continue
                    total += len(samples)
                    if rate != 24000 or total > rate * 120 or not np.isfinite(samples).all():
                        raise ValueError('Invalid generated audio')
                    packet = dict(id=request['id'], audio=base64.b64encode(samples.tobytes()).decode('ascii'), sampleRate=rate, elapsedMs=round((time.monotonic()-started)*1000), backend=backend)
                    # Bypass redirected diagnostic stdout for protocol packets.
                    sys.__stdout__.write(json.dumps(packet) + '\n')
                    sys.__stdout__.flush()
                if not total:
                    raise ValueError('No generated audio')
        result = dict(id=request['id'], done=True, elapsedMs=round((time.monotonic()-started)*1000), backend=backend)
    except Exception as error:
        result = dict(id=request.get('id'), error=str(error)[:800])
    print(json.dumps(result), flush=True)
