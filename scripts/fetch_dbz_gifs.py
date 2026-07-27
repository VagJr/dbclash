import os
import math
from PIL import Image, ImageDraw, ImageFilter

# Create directories
os.makedirs("assets/animations/attacks", exist_ok=True)
os.makedirs("assets/animations/characters", exist_ok=True)

def create_gif(filename, frames, duration=80):
    filepath = os.path.join("assets/animations", filename)
    frames[0].save(
        filepath,
        save_all=True,
        append_images=frames[1:],
        optimize=False,
        duration=duration,
        loop=0
    )
    print(f"Created GIF: {filepath} ({len(frames)} frames)")

# -----------------------------------------------------------------------------
# 1. PUNCH / PHYSICAL ATTACK GIF (Impact spark + shockwave)
# -----------------------------------------------------------------------------
def make_punch_gif():
    frames = []
    w, h = 250, 250
    for i in range(12):
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        cx, cy = w // 2, h // 2
        r = 10 + i * 9
        
        # Outer shockwave ring
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 215, 0, max(0, 255 - i * 20)), width=4)
        
        # Starburst impact lines
        num_lines = 12
        for k in range(num_lines):
            angle = k * (2 * math.pi / num_lines) + (i * 0.1)
            x1 = cx + math.cos(angle) * (r * 0.4)
            y1 = cy + math.sin(angle) * (r * 0.4)
            x2 = cx + math.cos(angle) * (r * 1.2)
            y2 = cy + math.sin(angle) * (r * 1.2)
            draw.line([x1, y1, x2, y2], fill=(255, 60, 0, max(0, 255 - i * 18)), width=3)
            
        # Core bright flash
        cr = max(4, 40 - i * 3)
        draw.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=(255, 255, 220, max(0, 255 - i * 15)))
        frames.append(img)
    create_gif("attacks/punch.gif", frames, duration=60)

# -----------------------------------------------------------------------------
# 2. KI BLAST GIF (Pulsing energy sphere + trail)
# -----------------------------------------------------------------------------
def make_ki_blast_gif():
    frames = []
    w, h = 250, 250
    for i in range(14):
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        cx = 50 + i * 12
        cy = 125 + int(math.sin(i * 0.5) * 15)
        
        # Outer cyan glow
        for g in range(3, 0, -1):
            gr = 25 + g * 6
            draw.ellipse([cx - gr, cy - gr, cx + gr, cy + gr], fill=(0, 200, 255, 40))
        
        # Tail particles
        for t in range(5):
            tx = cx - (t * 15)
            ty = cy + int(math.sin((i - t) * 0.5) * 8)
            tr = 14 - t * 2
            if tr > 0:
                draw.ellipse([tx - tr, ty - tr, tx + tr, ty + tr], fill=(0, 242, 254, max(0, 180 - t * 35)))
                
        # Main core
        draw.ellipse([cx - 20, cy - 20, cx + 20, cy + 20], fill=(220, 250, 255, 255))
        frames.append(img)
    create_gif("attacks/ki_blast.gif", frames, duration=50)

# -----------------------------------------------------------------------------
# 3. GENKI DAMA GIF (Massive cyan/blue spirit orb with floating energy wisps)
# -----------------------------------------------------------------------------
def make_genkidama_gif():
    frames = []
    w, h = 280, 280
    for i in range(16):
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        cx, cy = w // 2, h // 2
        
        # Swirling energy particles gathering into core
        for p in range(20):
            angle = p * (2 * math.pi / 20) + (i * 0.15)
            dist = 110 - ((i * 5 + p * 4) % 90)
            px = cx + math.cos(angle) * dist
            py = cy + math.sin(angle) * dist
            draw.ellipse([px - 3, py - 3, px + 3, py + 3], fill=(0, 242, 254, 200))
            
        # Outer aura rings
        pulse = int(math.sin(i * 0.4) * 8)
        r1 = 70 + pulse
        draw.ellipse([cx - r1, cy - r1, cx + r1, cy + r1], fill=(0, 180, 255, 60))
        
        r2 = 50 + pulse // 2
        draw.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], fill=(150, 230, 255, 160))
        
        r3 = 30
        draw.ellipse([cx - r3, cy - r3, cx + r3, cy + r3], fill=(255, 255, 255, 240))
        frames.append(img)
    create_gif("attacks/genkidama.gif", frames, duration=70)

# -----------------------------------------------------------------------------
# 4. KI CHARGE GIF (Super Saiyan Golden Aura flaring upward)
# -----------------------------------------------------------------------------
def make_ki_charge_gif():
    frames = []
    w, h = 250, 250
    for i in range(14):
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        cx, cy = w // 2, h // 2 + 20
        
        # Flame spikes shooting up
        num_flames = 10
        for f in range(num_flames):
            fx = cx + (f - 5) * 16 + int(math.sin(i + f) * 6)
            fh = 80 + int(math.sin(i * 0.6 + f) * 30)
            fy = cy - fh
            draw.polygon([
                (fx - 12, cy),
                (fx, fy),
                (fx + 12, cy)
            ], fill=(255, 215, 0, 120))
            
            # Inner white flame core
            draw.polygon([
                (fx - 6, cy),
                (fx, fy + 20),
                (fx + 6, cy)
            ], fill=(255, 255, 200, 180))
            
        # Ground energy ring
        gr = 60 + int(math.sin(i * 0.5) * 10)
        draw.ellipse([cx - gr, cy - 15, cx + gr, cy + 15], outline=(255, 140, 0, 200), width=3)
        frames.append(img)
    create_gif("attacks/ki_charge.gif", frames, duration=60)

# -----------------------------------------------------------------------------
# 5. COUNTER GIF (Z-Counter spark + cross cut line)
# -----------------------------------------------------------------------------
def make_counter_gif():
    frames = []
    w, h = 250, 250
    for i in range(12):
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        cx, cy = w // 2, h // 2
        
        # Slash line across screen
        progress = i / 11.0
        x1 = cx - 100 + progress * 200
        y1 = cy - 80 + progress * 160
        draw.line([cx - 100, cy - 80, x1, y1], fill=(255, 215, 0, 255), width=6)
        
        # Purple counter spark
        if i > 2:
            r = (i - 2) * 12
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(167, 139, 250, max(0, 255 - i * 20)), width=4)
        frames.append(img)
    create_gif("attacks/counter.gif", frames, duration=50)

# -----------------------------------------------------------------------------
# 6. DEFENSE BARRIER GIF (Glowing Cyan Dome Shield)
# -----------------------------------------------------------------------------
def make_defense_barrier_gif():
    frames = []
    w, h = 250, 250
    for i in range(14):
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        cx, cy = w // 2, h // 2
        
        pulse = int(math.sin(i * 0.5) * 6)
        r = 80 + pulse
        
        # Hexagonal grid outline / dome
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(34, 211, 238, 40), outline=(34, 211, 238, 220), width=4)
        draw.ellipse([cx - r + 10, cy - r + 10, cx + r - 10, cy + r - 10], outline=(255, 255, 255, 120), width=2)
        frames.append(img)
    create_gif("attacks/defense_barrier.gif", frames, duration=70)

# -----------------------------------------------------------------------------
# 7. Z-VANISH GIF (Speed lines + afterimage silhouette vanish)
# -----------------------------------------------------------------------------
def make_zvanish_gif():
    frames = []
    w, h = 250, 250
    for i in range(10):
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        cx, cy = w // 2, h // 2
        
        # Horizontal speed streaks
        for s in range(8):
            sy = cy - 60 + s * 18
            sx1 = 10 + (i * 20 + s * 15) % 180
            sx2 = sx1 + 60
            draw.line([sx1, sy, sx2, sy], fill=(45, 212, 191, max(0, 220 - i * 20)), width=3)
            
        frames.append(img)
    create_gif("attacks/zvanish.gif", frames, duration=45)

# -----------------------------------------------------------------------------
# 8. KAIOKEN GIF (Crimson aura burst)
# -----------------------------------------------------------------------------
def make_kaioken_gif():
    frames = []
    w, h = 250, 250
    for i in range(12):
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        cx, cy = w // 2, h // 2
        
        r = 30 + i * 8
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(239, 68, 68, max(0, 100 - i * 6)), outline=(255, 50, 50, max(0, 255 - i * 18)), width=5)
        frames.append(img)
    create_gif("attacks/kaioken.gif", frames, duration=60)

# -----------------------------------------------------------------------------
# 9. PIXEL ART DBZ CHARACTER SPRITES (Goku, Vegeta, Gohan, Frieza, Piccolo, Trunks)
# -----------------------------------------------------------------------------
def make_pixel_art_character(name, primary_color, gi_color, hair_color):
    frames = []
    w, h = 96, 96
    
    for frame_idx in range(6):
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Bobbing height for breathing / stance animation
        bob = int(math.sin(frame_idx * (2 * math.pi / 6)) * 3)
        bx = w // 2
        by = h // 2 + 10 + bob
        
        # Aura feet glow
        draw.ellipse([bx - 22, by + 18, bx + 22, by + 28], fill=(*primary_color, 80))
        
        # Legs
        draw.rectangle([bx - 12, by + 4, bx - 3, by + 22], fill=gi_color)
        draw.rectangle([bx + 3, by + 4, bx + 12, by + 22], fill=gi_color)
        # Boots
        draw.rectangle([bx - 14, by + 18, bx - 2, by + 24], fill=(30, 30, 40, 255))
        draw.rectangle([bx + 2, by + 18, bx + 14, by + 24], fill=(30, 30, 40, 255))
        
        # Torso / Gi
        draw.rectangle([bx - 16, by - 18, bx + 16, by + 6], fill=gi_color)
        # Belt / Sash
        draw.rectangle([bx - 16, by + 2, bx + 16, by + 6], fill=primary_color)
        
        # Arms / Stance
        draw.rectangle([bx - 24, by - 14, bx - 14, by + 2], fill=(240, 180, 130, 255))
        draw.rectangle([bx + 14, by - 14, bx + 24, by + 2], fill=(240, 180, 130, 255))
        
        # Head / Face
        draw.rectangle([bx - 12, by - 36, bx + 12, by - 18], fill=(245, 195, 145, 255))
        # Eyes (Determined fighter look)
        draw.rectangle([bx - 8, by - 28, bx - 3, by - 24], fill=(255, 255, 255, 255))
        draw.rectangle([bx + 3, by - 28, bx + 8, by - 24], fill=(255, 255, 255, 255))
        draw.rectangle([bx - 6, by - 27, bx - 4, by - 25], fill=(0, 0, 0, 255))
        draw.rectangle([bx + 5, by - 27, bx + 7, by - 25], fill=(0, 0, 0, 255))
        
        # Hair (Spiky DBZ Hair Silhouette)
        hair_points = [
            (bx - 16, by - 34),
            (bx - 22, by - 44),
            (bx - 10, by - 48),
            (bx, by - 56),
            (bx + 10, by - 48),
            (bx + 22, by - 44),
            (bx + 16, by - 34)
        ]
        draw.polygon(hair_points, fill=hair_color)
        
        # Scale 2x for crisp retro pixel art style
        scaled = img.resize((128, 128), resample=Image.NEAREST)
        frames.append(scaled)
        
    create_gif(f"characters/{name}_idle.gif", frames, duration=110)

def main():
    print("Generating DBZ Animation Assets...")
    make_punch_gif()
    make_ki_blast_gif()
    make_genkidama_gif()
    make_ki_charge_gif()
    make_counter_gif()
    make_defense_barrier_gif()
    make_zvanish_gif()
    make_kaioken_gif()
    
    # DBZ Character Pixel Art Sprites
    make_pixel_art_character("goku", (255, 140, 0), (255, 100, 0), (20, 20, 20)) # Goku: Orange Gi, Black Hair
    make_pixel_art_character("vegeta", (0, 100, 220), (30, 40, 80), (20, 20, 20)) # Vegeta: Blue suit, Armor
    make_pixel_art_character("gohan", (140, 50, 200), (120, 40, 180), (20, 20, 20)) # Gohan: Purple Gi
    make_pixel_art_character("frieza", (180, 50, 220), (240, 240, 250), (160, 40, 200)) # Frieza: White/Purple
    make_pixel_art_character("piccolo", (40, 180, 100), (100, 40, 160), (240, 240, 240)) # Piccolo: Green/Purple/Turban
    make_pixel_art_character("trunks", (30, 140, 240), (40, 50, 70), (170, 130, 230)) # Trunks: Jacket/Purple Hair
    print("All DBZ GIF assets generated successfully!")

if __name__ == "__main__":
    main()
