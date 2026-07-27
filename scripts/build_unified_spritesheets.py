import os
import math
from PIL import Image, ImageDraw

os.makedirs("assets/spritesheets/characters", exist_ok=True)
os.makedirs("assets/spritesheets/fx", exist_ok=True)

FRAME_SIZE = 64 # 64x64 pixel art frame grid for unified scaling

def create_spritesheet(output_path, num_frames, draw_frame_func):
    """Creates a horizontal grid sprite sheet PNG of num_frames x FRAME_SIZE."""
    sheet_w = num_frames * FRAME_SIZE
    sheet_h = FRAME_SIZE
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    
    for i in range(num_frames):
        frame_img = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        draw = ImageDraw.Draw(frame_img)
        draw_frame_func(draw, i, num_frames)
        sheet.paste(frame_img, (i * FRAME_SIZE, 0))
        
    sheet.save(output_path)
    print(f"Generated SpriteSheet: {output_path} ({sheet_w}x{sheet_h} px)")

# =============================================================================
# 1. UNIFIED CHARACTER SPRITESHEETS (Goku, Vegeta, Gohan, Frieza, Piccolo, Trunks)
# Each sheet contains 12 frames: 4 Idle, 3 Charge, 3 Lunge Attack, 2 Hit Recoil
# =============================================================================

def draw_character_frame(draw, i, num_frames, main_color, secondary_color, hair_color):
    cx, cy = 32, 38
    
    # Action states based on frame index
    if i < 4:
        # State: IDLE (Breathing stance)
        bob = int(math.sin(i * (math.pi / 2)) * 2)
        cy += bob
        # Legs
        draw.rectangle([cx - 8, cy + 6, cx - 2, cy + 18], fill=secondary_color)
        draw.rectangle([cx + 2, cy + 6, cx + 8, cy + 18], fill=secondary_color)
        # Torso
        draw.rectangle([cx - 10, cy - 10, cx + 10, cy + 6], fill=main_color)
        # Arms
        draw.rectangle([cx - 14, cy - 8, cx - 8, cy + 4], fill=(240, 195, 150, 255))
        draw.rectangle([cx + 8, cy - 8, cx + 14, cy + 4], fill=(240, 195, 150, 255))
        # Head
        draw.rectangle([cx - 7, cy - 22, cx + 7, cy - 10], fill=(245, 200, 155, 255))
        # Hair
        draw.polygon([(cx - 10, cy - 20), (cx - 12, cy - 30), (cx, cy - 34), (cx + 12, cy - 30), (cx + 10, cy - 20)], fill=hair_color)
    elif i < 7:
        # State: CHARGE (Aura flare up)
        sub = i - 4
        cy -= 2
        # Flame Aura
        draw.polygon([(cx - 18, cy + 10), (cx - 8, cy - 32 - sub * 4), (cx + 8, cy - 32 - sub * 4), (cx + 18, cy + 10)], fill=(255, 215, 0, 120))
        # Legs wide
        draw.rectangle([cx - 12, cy + 6, cx - 4, cy + 18], fill=secondary_color)
        draw.rectangle([cx + 4, cy + 6, cx + 12, cy + 18], fill=secondary_color)
        # Torso
        draw.rectangle([cx - 10, cy - 10, cx + 10, cy + 6], fill=main_color)
        # Arms flexed up
        draw.rectangle([cx - 16, cy - 16, cx - 8, cy - 4], fill=(240, 195, 150, 255))
        draw.rectangle([cx + 8, cy - 16, cx + 16, cy - 4], fill=(240, 195, 150, 255))
        # Head
        draw.rectangle([cx - 7, cy - 22, cx + 7, cy - 10], fill=(245, 200, 155, 255))
        draw.polygon([(cx - 12, cy - 20), (cx - 16, cy - 32), (cx, cy - 36), (cx + 16, cy - 32), (cx + 12, cy - 20)], fill=(255, 215, 0, 255))
    elif i < 10:
        # State: ATTACK LUNGE (Punch strike forward)
        sub = i - 7
        cx += sub * 6
        # Legs lunging
        draw.rectangle([cx - 14, cy + 6, cx - 6, cy + 16], fill=secondary_color)
        draw.rectangle([cx, cy + 8, cx + 12, cy + 18], fill=secondary_color)
        # Torso angled forward
        draw.rectangle([cx - 8, cy - 10, cx + 10, cy + 6], fill=main_color)
        # Extended punch arm
        draw.rectangle([cx + 8, cy - 8, cx + 24, cy - 2], fill=(240, 195, 150, 255))
        draw.ellipse([cx + 20, cy - 10, cx + 28, cy], fill=(255, 255, 255, 255))
        # Head
        draw.rectangle([cx - 5, cy - 22, cx + 8, cy - 10], fill=(245, 200, 155, 255))
        draw.polygon([(cx - 8, cy - 20), (cx - 10, cy - 30), (cx + 2, cy - 34), (cx + 14, cy - 30), (cx + 10, cy - 20)], fill=hair_color)
    else:
        # State: HIT RECOIL (Damage shock)
        cx -= 6
        # Flash / Shock
        draw.ellipse([cx - 18, cy - 20, cx + 18, cy + 16], outline=(239, 68, 68, 200), width=2)
        draw.rectangle([cx - 10, cy - 10, cx + 10, cy + 6], fill=main_color)
        draw.rectangle([cx - 7, cy - 22, cx + 7, cy - 10], fill=(255, 120, 120, 255))

def build_character_spritesheets():
    chars_data = {
        "goku": ((255, 100, 0), (0, 80, 200), (20, 20, 20)),
        "vegeta": ((30, 60, 180), (240, 240, 240), (20, 20, 20)),
        "gohan": ((120, 40, 180), (140, 50, 200), (20, 20, 20)),
        "frieza": ((240, 240, 250), (160, 40, 200), (160, 40, 200)),
        "piccolo": ((40, 160, 90), (100, 40, 160), (240, 240, 240)),
        "trunks": ((40, 50, 80), (240, 240, 240), (170, 130, 230))
    }
    
    for name, (mc, sc, hc) in chars_data.items():
        path = f"assets/spritesheets/characters/{name}_sheet.png"
        create_spritesheet(path, 12, lambda draw, f, nf, m=mc, s=sc, h=hc: draw_character_frame(draw, f, nf, m, s, h))

# =============================================================================
# 2. UNIFIED ATTACK FX SPRITESHEETS (Punch, Ki Blast, Kamehameha, Barrier, Vanish)
# =============================================================================

def draw_punch_fx(draw, i, total):
    cx, cy = 32, 32
    r = (i + 1) * 4
    # Impact burst
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 215, 0, max(0, 255 - i * 30)), width=3)
    num_spikes = 8
    for s in range(num_spikes):
        ang = s * (2 * math.pi / num_spikes) + (i * 0.2)
        x1 = cx + math.cos(ang) * (r * 0.3)
        y1 = cy + math.sin(ang) * (r * 0.3)
        x2 = cx + math.cos(ang) * (r * 1.3)
        y2 = cy + math.sin(ang) * (r * 1.3)
        draw.line([x1, y1, x2, y2], fill=(255, 80, 0, max(0, 255 - i * 25)), width=2)
    draw.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(255, 255, 220, 255))

def draw_kiblast_fx(draw, i, total):
    cx = 10 + i * 5
    cy = 32
    # Ki ball trail
    for t in range(4):
        tx = cx - t * 6
        if tx > 0:
            tr = 12 - t * 2.5
            draw.ellipse([tx - tr, cy - tr, tx + tr, cy + tr], fill=(0, 242, 254, max(0, 200 - t * 45)))
    draw.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=(240, 250, 255, 255))

def draw_kamehameha_fx(draw, i, total):
    cy = 32
    beam_w = (i + 1) * 8
    # Cyan energy beam segment
    draw.rectangle([0, cy - beam_w // 2, 64, cy + beam_w // 2], fill=(0, 200, 255, 120))
    draw.rectangle([0, cy - beam_w // 4, 64, cy + beam_w // 4], fill=(255, 255, 255, 230))

def draw_barrier_fx(draw, i, total):
    cx, cy = 32, 32
    r = 20 + int(math.sin(i * 0.8) * 4)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(34, 211, 238, 50), outline=(34, 211, 238, 220), width=3)
    draw.ellipse([cx - r + 4, cy - r + 4, cx + r - 4, cy + r - 4], outline=(255, 255, 255, 140), width=1)

def draw_vanish_fx(draw, i, total):
    cy = 32
    # Speed streak lines
    for line in range(5):
        ly = cy - 20 + line * 10
        lx = (i * 12 + line * 8) % 64
        draw.line([lx, ly, lx + 24, ly], fill=(45, 212, 191, max(0, 255 - i * 30)), width=2)

def build_fx_spritesheets():
    fx_dict = {
        "punch_sheet.png": (8, draw_punch_fx),
        "ki_blast_sheet.png": (10, draw_kiblast_fx),
        "kamehameha_sheet.png": (8, draw_kamehameha_fx),
        "barrier_sheet.png": (8, draw_barrier_fx),
        "vanish_sheet.png": (8, draw_vanish_fx),
    }
    for filename, (frames, func) in fx_dict.items():
        path = f"assets/spritesheets/fx/{filename}"
        create_spritesheet(path, frames, func)

def main():
    print("Building Unified 2D SpriteSheets...")
    build_character_spritesheets()
    build_fx_spritesheets()
    print("Unified SpriteSheet Pipeline Complete!")

if __name__ == "__main__":
    main()
