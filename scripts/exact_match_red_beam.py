import os
from PIL import Image

cards_dir = r"C:\dbtcg"
target_size = (1024, 1536)

# Use template_blue.png's bounding box as the master standard for all 6 templates!
blue_p = os.path.join(cards_dir, "template_blue.png")
blue_img = Image.open(blue_p)
master_bbox = blue_img.split()[-1].getbbox()
print(f"Master bounding box from template_blue: {master_bbox}")

# Target inner box size: (master_bbox[2] - master_bbox[0], master_bbox[3] - master_bbox[1])
master_w = master_bbox[2] - master_bbox[0]
master_h = master_bbox[3] - master_bbox[1]
master_pos = (master_bbox[0], master_bbox[1])

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
        
        # Resize cropped graphic to exact master_w, master_h
        resized_inner = cropped.resize((master_w, master_h), Image.Resampling.LANCZOS)
        
        # Create a new transparent RGBA canvas of size (1024, 1536)
        new_canvas = Image.new("RGBA", target_size, (0, 0, 0, 0))
        
        # Paste resized inner graphic at master_pos
        new_canvas.paste(resized_inner, master_pos, resized_inner)
        
        new_canvas.save(p, "PNG")

print("\nVerifying all template bounding boxes after exact match:")
for t in all_templates:
    p = os.path.join(cards_dir, t)
    if os.path.exists(p):
        img = Image.open(p)
        alpha = img.split()[-1]
        print(f"{t}: size={img.size}, alpha_bbox={alpha.getbbox()}")
