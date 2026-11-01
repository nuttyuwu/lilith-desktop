"""Preserve installed dependency metadata and licenses in the extractor bundle."""
from importlib.metadata import distributions
from pathlib import Path
import shutil
import sys

root = Path(__file__).resolve().parent.parent
target = root / "lilith-pet" / "build" / "extractor" / "lilith-extractor" / "notices"
target.mkdir(parents=True, exist_ok=True)
for dist in distributions():
    name = dist.metadata["Name"]
    for file in dist.files or []:
        if any(token in str(file).lower() for token in ("license", "copying", "notice")) or file.name == "METADATA":
            source = Path(dist.locate_file(file))
            if source.is_file():
                # Metadata paths can include ../; keep every copy inside notices.
                dest = target / name / Path(*[p for p in file.parts if p not in ("..", ".")])
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, dest)
license_file = Path(sys.base_prefix) / "LICENSE.txt"
if not license_file.is_file():
    raise SystemExit("Python LICENSE.txt is required for packaging")
shutil.copyfile(license_file, target / "Python-LICENSE.txt")
