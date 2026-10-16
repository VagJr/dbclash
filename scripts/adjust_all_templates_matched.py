import os
from PIL import Image

cards_dir = r"C:\dbtcg"
target_size = (1024, 1536)

# Desired uniform padding for all 6 templates:
# Inset graphic by 35 pixels horizontally and 30 pixels vertically inside 1024x1536 canvas
pad_x = 35
pad_y = 30
inner_size = (target_size[0] - 2 * pad_x, target_size[1] - 2 * pad_y) # (954, 1476)

all_templates = [
    "template_red.png",
    "template_beam.png",
    "template_blue.png",
    "template_green.png",
    "template_roxo.png",
    "template_leader.png"
]

for t in all_templates:
    p = os.path.join(cards_dir, t)
    if os.path.exists(p):
        img = Image.open(p)
        alpha = img.split()[-1]
        bbox = alpha.getbbox()
        
        # Crop graphic content to its bbox
        cropped = img.crop(bbox)
        
        # Resize cropped graphic to the target inner size
        resized_inner = cropped.resize(inner_size, Image.Resampling.LANCZOS)
        
        # Create a new transparent RGBA canvas of size (1024, 1536)
        new_canvas = Image.new("RGBA", target_size, (0, 0, 0, 0))
        
        # Paste the resized inner graphic at (pad_x, pad_y)
        new_canvas.paste(resized_inner, (pad_x, pad_y), resized_inner)
        
        new_canvas.save(p, "PNG")
        print(f"Standardized {t}: inner graphic at ({pad_x}, {pad_y}) size {inner_size}")

print("\nVerifying all template bounding boxes:")
for t in all_templates:
    p = os.path.join(cards_dir, t)
    if os.path.exists(p):
        img = Image.open(p)
        alpha = img.split()[-1]
        print(f"{t}: size={img.size}, alpha_bbox={alpha.getbbox()}")
