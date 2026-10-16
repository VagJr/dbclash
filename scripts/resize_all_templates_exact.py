import os
from PIL import Image

templates = [
    "template_red.png",
    "template_blue.png",
    "template_green.png",
    "template_roxo.png",
    "template_beam.png",
    "template_leader.png"
]

cards_dir = r"C:\dbtcg"
target_size = (1024, 1536)

for t in templates:
    p = os.path.join(cards_dir, t)
    if os.path.exists(p):
        img = Image.open(p)
        print(f"Original size of {t}: {img.size}")
        if img.size != target_size:
            resized = img.resize(target_size, Image.Resampling.LANCZOS)
            resized.save(p, "PNG")
            print(f"Resized {t} to exact {target_size}")
        else:
            print(f"{t} is already exact {target_size}")
    else:
        print(f"Warning: {t} not found at {p}")
