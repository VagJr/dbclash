import os
import re
from PIL import Image, ImageDraw, ImageFont

# Canvas size
W, H = 700, 980

# Load card database text
with open(r'c:\dbtcg\js\card-database.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Parse card objects from JS array
card_blocks = re.findall(r'\{\s*id:\s*\'([^\']+)\'.*?descPt:\s*\'([^\']+)\'', text, re.DOTALL)

# Also get general properties per card
def parse_cards():
    cards = []
    # Simple regex block parser
    raw_objs = re.findall(r'\{([^{}]+)\}', text, re.DOTALL)
    for raw in raw_objs:
        if 'id:' not in raw or 'name:' not in raw:
            continue
        id_m = re.search(r'id:\s*\'([^\']+)\'', raw)
        name_m = re.search(r'name:\s*\'([^\']+)\'', raw)
        type_m = re.search(r'type:\s*\'([^\']+)\'', raw)
        cost_m = re.search(r'cost:\s*(\d+)', raw)
        power_m = re.search(r'power:\s*(\d+)', raw)
        block_m = re.search(r'block:\s*(\d+)', raw)
        beam_m = re.search(r'isBeam:\s*(true|false)', raw)
        desc_m = re.search(r'descPt:\s*\'([^\']+)\'', raw)

        if id_m and name_m:
            cards.append({
                'id': id_m.group(1),
                'name': name_m.group(1),
                'type': type_m.group(1) if type_m else 'attack',
                'cost': int(cost_m.group(1)) if cost_m else 0,
                'power': int(power_m.group(1)) if power_m else 0,
                'block': int(block_m.group(1)) if block_m else 0,
                'isBeam': beam_m.group(1) == 'true' if beam_m else False,
                'descPt': desc_m.group(1) if desc_m else ''
            })
    return cards

cards = parse_cards()
print(f"Parsed {len(cards)} card definitions.")

output_dir = r'c:\dbtcg\assets\compiled_cards'
os.makedirs(output_dir, exist_ok=True)

# Templates map
templates = {
    'attack': Image.open(r'c:\dbtcg\template_red.png').convert('RGBA').resize((W, H), Image.Resampling.LANCZOS),
    'defense': Image.open(r'c:\dbtcg\template_blue.png').convert('RGBA').resize((W, H), Image.Resampling.LANCZOS),
    'evade': Image.open(r'c:\dbtcg\template_roxo.png').convert('RGBA').resize((W, H), Image.Resampling.LANCZOS),
    'support': Image.open(r'c:\dbtcg\template_green.png').convert('RGBA').resize((W, H), Image.Resampling.LANCZOS)
}

# Try loading system font or PIL default font
try:
    font_title = ImageFont.truetype("arialbd.ttf", 26)
    font_cost = ImageFont.truetype("arialbd.ttf", 36)
    font_power = ImageFont.truetype("arialbd.ttf", 30)
    font_desc = ImageFont.truetype("arial.ttf", 20)
except Exception:
    font_title = ImageFont.load_default()
    font_cost = ImageFont.load_default()
    font_power = ImageFont.load_default()
    font_desc = ImageFont.load_default()

for c in cards:
    card_id = c['id']
    card_type = c['type']
    card_name = c['name'].upper()
    cost_str = str(c['cost'])
    stat_str = f"{c['power']} ATK" if c['power'] > 0 else (f"{c['block']} DEF" if c['block'] > 0 else "")
    desc = c['descPt'].replace('\\n', '\n')

    # Create 700x980 Canvas
    canvas = Image.new('RGBA', (W, H), (5, 8, 17, 255))
    
    # 1. Art Image
    art_path = os.path.join(r'c:\dbtcg\assets\cards', f"{card_id}.png")
    if not os.path.exists(art_path):
        art_path = os.path.join(r'c:\dbtcg\assets\cards_raw_backup', f"{card_id}.png")

    if os.path.exists(art_path):
        try:
            art_img = Image.open(art_path).convert('RGBA')
            art_img = art_img.resize((640, 488), Image.Resampling.LANCZOS)
            canvas.paste(art_img, (30, 104), art_img)
        except Exception:
            pass

    # 2. Template Frame
    tpl = templates.get(card_type, templates['attack'])
    canvas.paste(tpl, (0, 0), tpl)

    # 3. Text Overlay
    draw = ImageDraw.Draw(canvas)

    # Ki Cost Sphere (X=10, Y=10, R=30)
    draw.ellipse([10, 10, 70, 70], fill=(245, 158, 11, 255), outline=(255, 255, 255, 255), width=4)
    draw.text((40, 40), cost_str, fill=(0, 0, 0, 255), font=font_cost, anchor='mm')

    # Title Text
    # Black stroke for legibility
    for offset in [(-2,-2), (2,-2), (-2,2), (2,2), (0,-2), (0,2), (-2,0), (2,0)]:
        draw.text((85 + offset[0], 40 + offset[1]), card_name, fill=(0, 0, 0, 255), font=font_title, anchor='lm')
    draw.text((85, 40), card_name, fill=(255, 255, 255, 255), font=font_title, anchor='lm')

    # Power Stat
    if stat_str:
        for offset in [(-2,-2), (2,-2), (-2,2), (2,2)]:
            draw.text((670 + offset[0], 40 + offset[1]), stat_str, fill=(0, 0, 0, 255), font=font_power, anchor='rm')
        draw.text((670, 40), stat_str, fill=(255, 215, 0, 255), font=font_power, anchor='rm')

    # Description Box (X=14, Y=272, W=672, H=108)
    draw.rounded_rectangle([14, 272, 686, 380], radius=12, fill=(8, 12, 24, 235), outline=(255, 255, 255, 60), width=2)
    
    lines = desc.split('\n')
    line_y = 285
    for line in lines:
        if line_y < 370:
            draw.text((28, line_y), line, fill=(226, 232, 240, 255), font=font_desc)
            line_y += 26

    # Save to assets/compiled_cards/
    save_path = os.path.join(output_dir, f"{card_id}.png")
    canvas.save(save_path, 'PNG')

print(f"✅ Generated {len(cards)} high-definition 700x980 vector compiled card snapshots!")
