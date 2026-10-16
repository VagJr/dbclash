import os
from PIL import Image, ImageEnhance, ImageOps

base_red_path = r"C:\dbtcg\template_red.png"
base_green_path = r"C:\dbtcg\template_green.png"
out_beam_path = r"C:\dbtcg\template_beam.png"
out_leader_path = r"C:\dbtcg\template_leader.png"

# Load base 1024x1536 templates
img_red = Image.open(base_red_path).convert("RGBA")
img_green = Image.open(base_green_path).convert("RGBA")

# 1. Create template_beam.png (Golden/Yellow Solar Ki Beam Theme)
# Convert red hues to brilliant solar yellow/orange (#fbbf24, #f59e0b)
r, g, b, a = img_red.split()

# Color shift Red to Golden/Yellow
# Yellow has high R and G
g_beam = ImageEnhance.Brightness(r).enhance(0.85)
b_beam = ImageEnhance.Brightness(b).enhance(0.4)

beam_img = Image.merge("RGBA", (r, g_beam, b_beam, a))
beam_enhancer = ImageEnhance.Color(beam_img)
beam_img = beam_enhancer.enhance(1.4)
beam_contrast = ImageEnhance.Contrast(beam_img)
beam_img = beam_contrast.enhance(1.1)

beam_img.save(out_beam_path, "PNG")
print(f"Successfully generated 1024x1536 {out_beam_path}")

# 2. Create template_leader.png (Royal Gold & Platinum Crown Theme)
# Color shift Green/Red to Royal Imperial Gold & Silver Accent
r_l, g_l, b_l, a_l = img_green.split()
g_leader = ImageEnhance.Brightness(g_l).enhance(0.9)
b_leader = ImageEnhance.Brightness(r_l).enhance(0.3)

leader_img = Image.merge("RGBA", (r_l, g_leader, b_leader, a_l))
leader_enhancer = ImageEnhance.Color(leader_img)
leader_img = leader_enhancer.enhance(1.5)

leader_img.save(out_leader_path, "PNG")
print(f"Successfully generated 1024x1536 {out_leader_path}")
