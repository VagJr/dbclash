import os
from PIL import Image, ImageDraw, ImageFont

output_dir = r"C:\dbtcg\assets\badges"
os.makedirs(output_dir, exist_ok=True)

def get_font(size):
    try:
        return ImageFont.truetype("arialbd.ttf", size)
    except:
        try:
            return ImageFont.truetype("arial.ttf", size)
        except:
            return ImageFont.load_default()

# 1. Generate Clean, Premium Ki Cost Spheres (0 to 12)
for cost in range(0, 13):
    size = 120
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    r = size // 2 - 3
    cx, cy = size // 2, size // 2
    
    # Base Sphere Background: Deep Vibrant Golden-Orange (#f59e0b)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(245, 158, 11, 255), outline=(255, 255, 255, 255), width=4)
    
    # Outer Gold Ring Outline
    draw.ellipse([cx - r + 2, cy - r + 2, cx + r - 2, cy + r - 2], fill=None, outline=(255, 215, 0, 255), width=2)
    
    # Inner Soft Glow (no harsh top blob!)
    draw.ellipse([cx - r + 6, cy - r + 6, cx + r - 6, cy + r - 6], fill=None, outline=(251, 191, 36, 255), width=2)

    # Cost text (Clean Bold Black with slight shadow)
    font = get_font(54)
    text = str(cost)
    bbox = font.getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    
    tx = (size - tw) // 2
    ty = (size - th) // 2 - bbox[1]
    
    draw.text((tx, ty), text, fill=(0, 0, 0, 255), font=font)
    
    filename = f"ki_cost_{cost}.png"
    img.save(os.path.join(output_dir, filename), "PNG")

print("Generated clean Ki cost sphere PNGs!")

# 2. Generate ATK and DEF Badges for all numbers
powers = set([0, 10, 12, 14, 15, 18, 20, 22, 24, 25, 26, 28, 30, 32, 34, 35, 36, 38, 40, 42, 44, 45, 46, 48, 50, 55, 56, 58, 60, 65, 68, 70, 72, 75, 78, 80, 82, 85, 90, 95, 100, 105, 110, 120])

for p in sorted(powers):
    for is_atk in [True, False]:
        w, h = 200, 68
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        bg_color = (8, 12, 24, 245)
        border_color = (239, 68, 68, 255) if is_atk else (56, 189, 248, 255)
        text_color = (255, 255, 255, 255)
        accent_color = (239, 68, 68, 255) if is_atk else (56, 189, 248, 255)
        label = f"{p} ATK" if is_atk else f"{p} DEF"
        
        # Rounded capsule
        draw.rounded_rectangle([2, 2, w - 2, h - 2], radius=14, fill=bg_color, outline=border_color, width=4)
        
        font = get_font(34)
        bbox = font.getbbox(label)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        
        tx = (w - tw) // 2
        ty = (h - th) // 2 - bbox[1]
        
        # Drop shadow for text
        draw.text((tx + 2, ty + 2), label, fill=(0, 0, 0, 220), font=font)
        draw.text((tx, ty), label, fill=text_color, font=font)
        
        suffix = "atk" if is_atk else "def"
        filename = f"power_{p}_{suffix}.png"
        img.save(os.path.join(output_dir, filename), "PNG")

print("All HUD PNG Badges re-generated clean!")
