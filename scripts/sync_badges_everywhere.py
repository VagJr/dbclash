import os
import shutil

src_badges = r"C:\dbtcg\assets\badges"
dest_badges = r"C:\dbtcg\dbtcg-render-server\assets\badges"

os.makedirs(dest_badges, exist_ok=True)
for f in os.listdir(src_badges):
    if f.endswith('.png'):
        shutil.copy2(os.path.join(src_badges, f), os.path.join(dest_badges, f))

print("Successfully synced all 105 badge PNGs to render server!")
