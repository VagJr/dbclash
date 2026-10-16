from pathlib import Path
from PIL import Image
src = Path('assets/cards')
out = Path('assets/rework/temporary-art')
out.mkdir(parents=True, exist_ok=True)
count = 0
for file in src.glob('*.png'):
    with Image.open(file) as image:
        image = image.convert('RGB')
        w, h = image.size
        # These legacy cards are 5:7; retain the complete illustration window and its subject.
        crop = image.crop((round(w*.035), round(h*.105), round(w*.965), round(h*.89)))
        crop.save(out / file.name, optimize=True)
        count += 1
print(f'Prepared {count} legacy illustration crops without upscaling.')
