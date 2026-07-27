import urllib.request
import os

url = "https://www.spriters-resource.com/media/assets/95/98136.png"
target = "assets/spritesheets/lsw/goku_sheet_98136.png"
os.makedirs("assets/spritesheets/lsw", exist_ok=True)

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

print(f"Downloading {url}...")
try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp, open(target, "wb") as f:
        f.write(resp.read())
    print(f"SUCCESS! Downloaded {target} ({os.path.getsize(target)} bytes)")
except Exception as e:
    print(f"FAILED: {e}")
