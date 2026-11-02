from pathlib import Path
import sys
import os
os.environ['HF_HUB_DISABLE_XET'] = '1'
from huggingface_hub import snapshot_download
root = Path(sys.argv[1]) / 'Qwen3-TTS-12Hz-0.6B-Base'
snapshot_download('Qwen/Qwen3-TTS-12Hz-0.6B-Base', revision='5d83992436eae1d760afd27aff78a71d676296fc', local_dir=str(root))
