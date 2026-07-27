import os
import math

base_dir = r"c:\dbtcg\assets\animations"
subdirs = ["vfx", "attacks", "characters", "life"]

for sd in subdirs:
    os.makedirs(os.path.join(base_dir, sd), exist_ok=True)

# Generate an SVG particle flash for Hit Spark
hit_spark_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <radialGradient id="sparkGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="30%" stop-color="#ffea00" stop-opacity="0.9"/>
      <stop offset="70%" stop-color="#ff3300" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="100" cy="100" r="90" fill="url(#sparkGrad)" />
  <path d="M100 0 L115 85 L200 100 L115 115 L100 200 L85 115 L0 100 L85 85 Z" fill="#ffffff" opacity="0.9"/>
  <path d="M100 20 L110 90 L180 100 L110 110 L100 180 L90 110 L20 100 L90 90 Z" fill="#ffee55" opacity="0.8"/>
  <path d="M30 30 L90 90 L170 30 L110 90 L170 170 L90 110 L30 170 L90 90 Z" stroke="#ff9900" stroke-width="4" opacity="0.7"/>
</svg>'''

with open(os.path.join(base_dir, "vfx", "hit_spark.svg"), "w", encoding="utf-8") as f:
    f.write(hit_spark_svg)

# Generate Ki Blast SVG
ki_blast_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
  <defs>
    <radialGradient id="kiGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="25%" stop-color="#00ffff" stop-opacity="0.95"/>
      <stop offset="60%" stop-color="#0066ff" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#000033" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="150" cy="150" r="130" fill="url(#kiGrad)" />
  <circle cx="150" cy="150" r="60" fill="#ffffff" filter="blur(2px)"/>
  <!-- Energy Rays -->
  <g stroke="#88ffff" stroke-width="3" opacity="0.8">
    <line x1="150" y1="10" x2="150" y2="290"/>
    <line x1="10" y1="150" x2="290" y2="150"/>
    <line x1="51" y1="51" x2="249" y2="249"/>
    <line x1="51" y1="249" x2="249" y2="51"/>
  </g>
</svg>'''

with open(os.path.join(base_dir, "vfx", "ki_blast.svg"), "w", encoding="utf-8") as f:
    f.write(ki_blast_svg)

# Generate Kamehameha Beam SVG
kamehameha_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="600" height="200">
  <defs>
    <linearGradient id="beamGrad" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="15%" stop-color="#73e6ff" stop-opacity="0.95"/>
      <stop offset="50%" stop-color="#00aaff" stop-opacity="0.9"/>
      <stop offset="85%" stop-color="#0055ff" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#001155" stop-opacity="0.3"/>
    </linearGradient>
    <radialGradient id="headGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="50%" stop-color="#00d2ff"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>
  <!-- Outer Beam Core -->
  <ellipse cx="300" cy="100" rx="280" ry="70" fill="url(#beamGrad)" />
  <!-- Inner White Hot Core -->
  <ellipse cx="300" cy="100" rx="260" ry="30" fill="#ffffff" opacity="0.95"/>
  <!-- Front Blast Wave -->
  <ellipse cx="540" cy="100" rx="50" ry="90" fill="url(#headGrad)"/>
</svg>'''

with open(os.path.join(base_dir, "vfx", "kamehameha_beam.svg"), "w", encoding="utf-8") as f:
    f.write(kamehameha_svg)

# Generate Genki Dama SVG
genkidama_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <radialGradient id="genkiGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="20%" stop-color="#a6ffcb" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="#12d8fa" stop-opacity="0.85"/>
      <stop offset="85%" stop-color="#1fa2ff" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>
  <circle cx="200" cy="200" r="180" fill="url(#genkiGrad)"/>
  <circle cx="200" cy="200" r="90" fill="#ffffff" opacity="0.9"/>
  <!-- Energy Filaments -->
  <g stroke="#ffffff" stroke-width="2" opacity="0.8">
    <circle cx="200" cy="200" r="140" stroke-dasharray="10 15" fill="none"/>
    <circle cx="200" cy="200" r="160" stroke-dasharray="20 20" fill="none"/>
  </g>
</svg>'''

with open(os.path.join(base_dir, "vfx", "genkidama.svg"), "w", encoding="utf-8") as f:
    f.write(genkidama_svg)

# Generate Life Shatter SVG
life_shatter_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
  <defs>
    <radialGradient id="redFlash" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="40%" stop-color="#ff0033" stop-opacity="0.9"/>
      <stop offset="80%" stop-color="#990011" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>
  <circle cx="150" cy="150" r="140" fill="url(#redFlash)"/>
  <polygon points="150,20 180,120 280,150 180,180 150,280 120,180 20,150 120,120" fill="#ffffff" opacity="0.9"/>
  <polygon points="150,50 170,130 250,150 170,170 150,250 130,170 50,150 130,130" fill="#ffdd22" opacity="0.8"/>
</svg>'''

with open(os.path.join(base_dir, "life", "life_shatter.svg"), "w", encoding="utf-8") as f:
    f.write(life_shatter_svg)

print("Animation SVG assets generated successfully.")
