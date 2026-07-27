import urllib.request
import os

urls = {
    "goku.gif": "https://raw.githubusercontent.com/Fabian-Martinez-Rincon/Fabian-Martinez-Rincon/main/goku.gif",
    "goku_ssj.gif": "https://raw.githubusercontent.com/Fabian-Martinez-Rincon/Fabian-Martinez-Rincon/main/assets/goku.gif",
    "vegeta.gif": "https://raw.githubusercontent.com/arpan-52/Finalflash/master/vegeta.gif",
    "kamehameha.gif": "https://raw.githubusercontent.com/iwanni/useless-inventions-window-interaction/main/assets/kamehameha.gif",
    "gohan.gif": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/1.gif",
}

for name, url in urls.items():
    print(f"Fetching {name} from {url}...")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
            print(f"  -> SUCCESS ({len(data)} bytes)")
    except Exception as e:
        print(f"  -> FAILED: {e}")
