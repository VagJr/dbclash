import urllib.request
import os

os.makedirs("assets/animations/characters", exist_ok=True)
os.makedirs("assets/animations/attacks", exist_ok=True)

# Direct Spriters Resource Media URLs (Official game rips & community edits)
SPRITERS_RESOURCE_ASSETS = {
    # Character Sprites (PNGs and GIFs from Legendary Super Warriors / DBZ Customs)
    "goku": "https://www.spriters-resource.com/media/asset_icons/146/149535.gif",
    "goku_alt": "https://www.spriters-resource.com/media/asset_icons/153/156253.png",
    "vegeta": "https://www.spriters-resource.com/media/asset_icons/482/483584.png",
    "gohan": "https://www.spriters-resource.com/media/asset_icons/153/156223.png",
    "frieza": "https://www.spriters-resource.com/media/asset_icons/153/156219.png",
    "piccolo": "https://www.spriters-resource.com/media/asset_icons/153/156226.png",
    "trunks": "https://www.spriters-resource.com/media/asset_icons/153/156225.png",
}

# Verified high quality DBZ attack GIFs from public raw GitHub archives
DIRECT_DBZ_ATTACK_GIFS = {
    "kamehameha": "https://raw.githubusercontent.com/iwanni/useless-inventions-window-interaction/main/assets/kamehameha.gif",
    "vegeta_blast": "https://raw.githubusercontent.com/arpan-52/Finalflash/master/vegeta.gif",
    "goku_strike": "https://raw.githubusercontent.com/CodewithEvilxd/codewithEvilxd/main/goku.gif",
    "goku_aura": "https://raw.githubusercontent.com/HeyBoY-ops/HeyBoY-ops/main/goku.gif",
}

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def download(url, path):
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp, open(path, 'wb') as f:
            f.write(resp.read())
        print(f"Downloaded {path} ({os.path.getsize(path)} bytes)")
        return True
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return False

print("Downloading authentic DBZ Spriters Resource & authentic anime GIFs...")
for name, url in SPRITERS_RESOURCE_ASSETS.items():
    ext = "gif" if url.endswith(".gif") else "png"
    download(url, f"assets/animations/characters/{name}_raw.{ext}")

for name, url in DIRECT_DBZ_ATTACK_GIFS.items():
    download(url, f"assets/animations/attacks/{name}.gif")
