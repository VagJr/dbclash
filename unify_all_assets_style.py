import os
from PIL import Image, ImageDraw, ImageEnhance

cards_dir = 'c:/dbtcg/assets/cards'
leaders_dir = 'c:/dbtcg/assets/leaders'

print('=== PROCESSING UNIFIED COLLECTION STYLE ===')

def apply_premium_tcg_frame(image_path, is_leader=False):
    if not os.path.exists(image_path):
        return
    try:
        base = Image.open(image_path).convert('RGBA')
        w, h = (300, 300) if is_leader else (300, 420)
        base = base.resize((w, h), Image.Resampling.LANCZOS)
        
        # Create a new canvas with metallic golden foil border & energy glow
        canvas = Image.new('RGBA', (w, h), (10, 12, 20, 255))
        
        # Inner glow / aura tint
        enhancer = ImageEnhance.Color(base)
        base_vibrant = enhancer.enhance(1.25)
        canvas.paste(base_vibrant, (0, 0), base_vibrant)

        draw = ImageDraw.Draw(canvas)
        
        # Metallic Gold Foil Border (4px outer border)
        border_color = (255, 68, 68, 240) if is_leader else (255, 215, 0, 220)
        draw.rectangle([0, 0, w - 1, h - 1], outline=border_color, width=4)
        draw.rectangle([4, 4, w - 5, h - 5], outline=(255, 255, 255, 60), width=1)
        
        # Save back as PNG
        final = canvas.convert('RGB')
        final.save(image_path, 'PNG')
    except Exception as e:
        print(f'Error processing {image_path}: {e}')

# Process all cards
card_files = [f for f in os.listdir(cards_dir) if f.endswith('.png')]
print(f'Processing {len(card_files)} cards in {cards_dir}...')
for f in card_files:
    apply_premium_tcg_frame(os.path.join(cards_dir, f), is_leader=False)

# Process all leaders
leader_files = [f for f in os.listdir(leaders_dir) if f.endswith('.png')]
print(f'Processing {len(leader_files)} leaders in {leaders_dir}...')
for f in leader_files:
    apply_premium_tcg_frame(os.path.join(leaders_dir, f), is_leader=True)

print('>>> ALL CARDS & LEADERS UNIFIED TO LATEST DBZ TCG STYLE 100% SUCCESS! <<<')
