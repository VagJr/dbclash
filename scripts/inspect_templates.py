import os
from PIL import Image

templates = [
    "template_red.png",
    "template_beam.png",
    "template_blue.png",
    "template_green.png",
    "template_roxo.png",
    "template_leader.png"
]

cards_dir = r"C:\dbtcg"

for t in templates:
    p = os.path.join(cards_dir, t)
    if os.path.exists(p):
        img = Image.open(p)
        bbox = img.getbbox()
        # Find transparent hole in middle if any (alpha == 0)
        alpha = img.split()[-1]
        alpha_bbox = alpha.getbbox()
        print(f"{t}: size={img.size}, alpha_bbox={alpha_bbox}")
