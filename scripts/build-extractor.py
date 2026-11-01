"""Build the private extraction runtime; never include game assets."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "extractor-venv"
PYTHON = CACHE / "Scripts" / "python.exe"


def run(*args):
    subprocess.run([str(arg) for arg in args], cwd=ROOT, check=True)


if sys.platform != "win32":
    raise SystemExit("Build the Windows extractor on Windows.")
if not PYTHON.exists():
    run(sys.executable, "-m", "venv", CACHE)
run(PYTHON, "-m", "pip", "install", "-r", ROOT / "scripts" / "extractor-requirements.txt")
run(PYTHON, "-m", "PyInstaller", "--noconfirm", "--clean", "--onedir",
    "--noupx", "--name", "lilith-extractor", "--collect-all", "UnityPy",
    "--collect-all", "fmod_toolkit", "--collect-all", "archspec",
    "--distpath", ROOT / "lilith-pet" / "build" / "extractor",
    "--workpath", ROOT / ".cache" / "extractor-work",
    "--specpath", ROOT / ".cache", ROOT / "extract_lilith.py")
# Collect package metadata and notices alongside the runtime, including transitive
# dependencies. Python's own license is copied from the build interpreter.
run(PYTHON, ROOT / "scripts" / "extractor-notices.py")
