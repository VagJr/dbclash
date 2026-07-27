import urllib.request
import os

os.makedirs("assets/spritesheets/lsw", exist_ok=True)

urls = [
    "https://www.spriters-resource.com/resources/sheets/98/98136.png",
    "https://www.spriters-resource.com/media/assets/98/98136.png",
    "https://www.spriters-resource.com/resources/sheets/156/156253.png",
    "https://www.spriters-resource.com/resources/sheets/156/156223.png",
    "https://www.spriters-resource.com/resources/sheets/156/156219.png",
    "https://www.spriters-resource.com/resources/sheets/156/156226.png",
    "https://www.spriters-resource.com/resources/sheets/156/156225.png",
]

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

for url in urls:
    filename = url.split("/")[-1]
    target = os.path.join("assets/spritesheets/lsw", filename)
    print(f"Downloading {url}...")
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp, open(target, "wb") as f:
            f.write(resp.read())
        print(f"  -> SUCCESS: {target} ({os.path.getsize(target)} bytes)")
    except Exception as e:
        print(f"  -> FAILED: {e}")
