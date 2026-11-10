"""Generate web assets while retaining the supplied JPEG originals (requires Pillow)."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'public' / 'panoramas'
for name in ('neva-corridor', 'neva-room'):
    with Image.open(root / f'{name}.jpg') as original:
        for width, quality in ((1024, 65), (4096, 84), (8192, 82)):
            image = original if original.width == width else original.resize(
                (width, width // 2), Image.Resampling.LANCZOS)
            target = root / f'{name}-{width}.webp'
            image.save(target, 'WEBP', quality=quality, method=4)
            print(f'{target.name}: {target.stat().st_size:,} bytes')
