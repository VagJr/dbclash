import urllib.request
import os
import json

urls = [
    "https://raw.githubusercontent.com/arpan-52/Finalflash/master/vegeta.gif",
    "https://raw.githubusercontent.com/Ashfak-Kausik/Kamehameha/main/kamehameha.gif",
    "https://raw.githubusercontent.com/MitchStreet/2D-Dragonball-Game/master/Assets/Goku/Idle.gif",
    "https://raw.githubusercontent.com/MitchStreet/2D-Dragonball-Game/master/Assets/Goku/goku.png",
    "https://raw.githubusercontent.com/MitchStreet/2D-Dragonball-Game/master/Assets/Vegeta/vegeta.png",
    "https://raw.githubusercontent.com/Mostafa-M-Hussein/zsh-theme-supersaiyan/master/goku.gif",
]

for url in urls:
    name = url.split('/')[-1]
    print(f"Testing {url}...")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
            print(f"  -> SUCCESS ({len(data)} bytes)")
    except Exception as e:
        print(f"  -> FAILED: {e}")
