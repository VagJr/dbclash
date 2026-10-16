import os
from PIL import Image

cards_dir = r"C:\dbtcg"
target_size = (1024, 1536)

# Reference templates that fill 0 to 1024
reference_templates = ["template_red.png", "template_beam.png"]

# Templates with transparent padding around edges that need trimming and scaling
templates_to_fix = [
    "template_blue.png",
    "template_green.png",
    "template_roxo.png",
    "template_leader.png"
]

for t in templates_to_fix:
    p = os.path.join(cards_dir, t)
    if os.path.exists(p):
        img = Image.open(p)
        alpha = img.split()[-1]
        bbox = alpha.getbbox()
        print(f"Trimming {t} from alpha_bbox {bbox}...")
        
        # Crop to the actual graphic content
        cropped = img.crop(bbox)
        
        # Resize cropped graphic to fill exact target_size (1024, 1536)
        resized = cropped.resize(target_size, Image.Resampling.LANCZOS)
        resized.save(p, "PNG")
        print(f"Successfully normalized {t} to exact (1024, 1536) full-bleed graphic!")

print("\nVerifying all template bounding boxes after fix:")
all_templates = ["template_red.png", "template_beam.png", "template_blue.png", "template_green.png", "template_roxo.png", "template_leader.png"]
for t in all_templates:
    p = os.path.join(cards_dir, t)
    if os.path.exists(p):
        img = Image.open(p)
        alpha = img.split()[-1]
        print(f"{t}: size={img.size}, alpha_bbox={alpha.getbbox()}")
