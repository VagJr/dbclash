import urllib.request
import os

os.makedirs("assets/spritesheets/lsw", exist_ok=True)

sheets = {
    "goku_sheet.png": "https://www.spriters-resource.com/media/assets/95/98136.png",
    "gohan_sheet.png": "https://www.spriters-resource.com/media/assets/153/156223.png",
    "trunks_sheet.png": "https://www.spriters-resource.com/media/assets/153/156225.png",
    "frieza_sheet.png": "https://www.spriters-resource.com/media/assets/153/156219.png",
    "piccolo_sheet.png": "https://www.spriters-resource.com/media/assets/153/156226.png",
    "cell_sheet.png": "https://www.spriters-resource.com/media/assets/153/156239.png",
    "buu_sheet.png": "https://www.spriters-resource.com/media/assets/153/156238.png",
}

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

for filename, url in sheets.items():
    target = os.path.join("assets/spritesheets/lsw", filename)
    print(f"Downloading {filename} from {url}...")
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp, open(target, "wb") as f:
            f.write(resp.read())
        print(f"  -> SUCCESS! ({os.path.getsize(target)} bytes)")
    except Exception as e:
        print(f"  -> FAILED: {e}")
