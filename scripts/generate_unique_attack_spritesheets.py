import os
from PIL import Image, ImageDraw, ImageFilter
import math

os.makedirs("assets/spritesheets/fx", exist_ok=True)

FRAME_SIZE = 64
TOTAL_FRAMES = 10

def create_fx_sheet(filename, draw_frame_func):
    sheet = Image.new("RGBA", (TOTAL_FRAMES * FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    for i in range(TOTAL_FRAMES):
        frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        t = i / (TOTAL_FRAMES - 1)
        draw_frame_func(frame, t, i)
        sheet.paste(frame, (i * FRAME_SIZE, 0))
    filepath = os.path.join("assets/spritesheets/fx", filename)
    sheet.save(filepath)
    print(f"Generated {filepath} ({os.path.getsize(filepath)} bytes)")

# 1. Final Flash Sheet (Golden electric beam with yellow/orange rings)
def draw_final_flash(frame, t, i):
    draw = ImageDraw.Draw(frame)
    cx, cy = 32, 32
    # Outer golden aura glow
    r_outer = int(12 + t * 18)
    draw.ellipse([cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer], fill=(255, 140, 0, 180))
    # Inner golden core
    r_inner = int(6 + t * 12)
    draw.ellipse([cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner], fill=(255, 215, 0, 240))
    # White center
    r_core = int(3 + t * 6)
    draw.ellipse([cx - r_core, cy - r_core, cx + r_core, cy + r_core], fill=(255, 255, 255, 255))
    # Electric lightning sparks around
    for a in [0, 72, 144, 216, 288]:
        rad = math.radians(a + i * 36)
        x2 = cx + math.cos(rad) * (r_outer + 6)
        y2 = cy + math.sin(rad) * (r_outer + 6)
        draw.line([cx, cy, x2, y2], fill=(255, 255, 255, 220), width=2)

create_fx_sheet("final_flash_sheet.png", draw_final_flash)

# 2. Genki Dama Sheet (Expanding spirit bomb sphere with cyan wisps)
def draw_genki_dama(frame, t, i):
    draw = ImageDraw.Draw(frame)
    cx, cy = 32, 32
    # Spirit orb radius grows from small to field-filling
    r_outer = int(8 + t * 22)
    draw.ellipse([cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer], fill=(31, 162, 255, 160))
    r_mid = int(6 + t * 16)
    draw.ellipse([cx - r_mid, cy - r_mid, cx + r_mid, cy + r_mid], fill=(0, 242, 254, 210))
    r_core = int(3 + t * 10)
    draw.ellipse([cx - r_core, cy - r_core, cx + r_core, cy + r_core], fill=(255, 255, 255, 255))

create_fx_sheet("genki_dama_sheet.png", draw_genki_dama)

# 3. Death Beam Sheet (Crimson/violet laser thread)
def draw_death_beam(frame, t, i):
    draw = ImageDraw.Draw(frame)
    cy = 32
    # Horizontal laser line extending
    w = int(t * 64)
    draw.line([0, cy, w, cy], fill=(255, 0, 85, 220), width=10)
    draw.line([0, cy, w, cy], fill=(168, 85, 247, 240), width=6)
    draw.line([0, cy, w, cy], fill=(255, 255, 255, 255), width=2)
    if w > 10:
        draw.ellipse([w - 8, cy - 8, w + 8, cy + 8], fill=(255, 0, 85, 255))

create_fx_sheet("death_beam_sheet.png", draw_death_beam)

# 4. Special Beam Cannon Sheet (Makankosappo double-helix drill)
def draw_special_beam(frame, t, i):
    draw = ImageDraw.Draw(frame)
    cx, cy = 32, 32
    r_core = int(4 + t * 10)
    draw.ellipse([cx - r_core, cy - r_core, cx + r_core, cy + r_core], fill=(168, 85, 247, 220))
    draw.ellipse([cx - r_core//2, cy - r_core//2, cx + r_core//2, cy + r_core//2], fill=(255, 255, 255, 255))
    # Spiral drill arcs
    for step in range(12):
        angle = step * 0.5 + i * 0.6
        dist = 8 + step * 1.8
        px = cx + math.cos(angle) * dist
        py = cy + math.sin(angle) * dist
        draw.ellipse([px - 2, py - 2, px + 2, py + 2], fill=(255, 215, 0, 240))

create_fx_sheet("special_beam_sheet.png", draw_special_beam)

# 5. Masenko Sheet (Amber/orange blast wave)
def draw_masenko(frame, t, i):
    draw = ImageDraw.Draw(frame)
    cx, cy = 32, 32
    r = int(6 + t * 20)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 140, 0, 180))
    draw.ellipse([cx - r*0.7, cy - r*0.7, cx + r*0.7, cy + r*0.7], fill=(255, 215, 0, 230))
    draw.ellipse([cx - r*0.3, cy - r*0.3, cx + r*0.3, cy + r*0.3], fill=(255, 255, 255, 255))

create_fx_sheet("masenko_sheet.png", draw_masenko)

# 6. Big Bang Attack Sheet (Royal blue orb blast)
def draw_big_bang(frame, t, i):
    draw = ImageDraw.Draw(frame)
    cx, cy = 32, 32
    r = int(8 + t * 18)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(0, 200, 255, 190))
    draw.ellipse([cx - r*0.6, cy - r*0.6, cx + r*0.6, cy + r*0.6], fill=(59, 130, 246, 240))
    draw.ellipse([cx - r*0.3, cy - r*0.3, cx + r*0.3, cy + r*0.3], fill=(255, 255, 255, 255))

create_fx_sheet("big_bang_sheet.png", draw_big_bang)

# 7. Burning Attack Sheet (Fiery red/orange blast)
def draw_burning_attack(frame, t, i):
    draw = ImageDraw.Draw(frame)
    cx, cy = 32, 32
    r = int(6 + t * 20)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 87, 34, 190))
    draw.ellipse([cx - r*0.65, cy - r*0.65, cx + r*0.65, cy + r*0.65], fill=(255, 215, 0, 230))
    draw.ellipse([cx - r*0.3, cy - r*0.3, cx + r*0.3, cy + r*0.3], fill=(255, 255, 255, 255))

create_fx_sheet("burning_attack_sheet.png", draw_burning_attack)

print("All Unique FX Sprite Sheets Generated Successfully!")
