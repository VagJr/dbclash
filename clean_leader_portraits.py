import os
import shutil
from PIL import Image

leaders_dir = 'c:/dbtcg/assets/leaders'
scratch_dir = 'C:/Users/vagmi/.gemini/antigravity-ide/brain/07a7fd72-44dd-4117-9527-46683382e456/scratch/test_arte33'

if not os.path.exists(leaders_dir):
    os.makedirs(leaders_dir)

# Check if clean leader tiles exist in scratch
leaders = ['goku', 'vegeta', 'gohan', 'frieza', 'piccolo', 'trunks']
for l in leaders:
    base_src = os.path.join(scratch_dir, f'{l}.png')
    awk_src = os.path.join(scratch_dir, f'{l}_awaken.png')
    
    base_dst = os.path.join(leaders_dir, f'{l}.png')
    awk_dst = os.path.join(leaders_dir, f'{l}_awk.png')

    if os.path.exists(base_src):
        shutil.copy(base_src, base_dst)
    if os.path.exists(awk_src):
        shutil.copy(awk_src, awk_dst)

print('Updated clean leader portraits in assets/leaders/!')
