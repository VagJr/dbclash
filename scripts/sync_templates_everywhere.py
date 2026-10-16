import os
import shutil

src_dir = r"C:\dbtcg"
dest_dirs = [
    r"C:\dbtcg\dbtcg-render-server",
    r"C:\dbtcg\assets\templates",
    r"C:\dbtcg\dbtcg-render-server\assets\templates"
]

templates = [
    "template_red.png",
    "template_beam.png",
    "template_blue.png",
    "template_green.png",
    "template_roxo.png",
    "template_leader.png"
]

for d in dest_dirs:
    os.makedirs(d, exist_ok=True)
    for t in templates:
        src = os.path.join(src_dir, t)
        dst = os.path.join(d, t)
        if os.path.exists(src):
            shutil.copy2(src, dst)
            print(f"Copied {t} -> {dst}")
