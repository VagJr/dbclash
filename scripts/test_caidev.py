import urllib.request

urls = [
    "https://raw.githubusercontent.com/caidevOficial/Python_Mini_DBZ_Game/main/assets/goku.gif",
    "https://raw.githubusercontent.com/caidevOficial/Python_Mini_DBZ_Game/main/assets/vegeta.gif",
    "https://raw.githubusercontent.com/caidevOficial/Python_Mini_DBZ_Game/main/assets/frieza.gif",
    "https://raw.githubusercontent.com/caidevOficial/Python_Mini_DBZ_Game/main/assets/gohan.gif",
    "https://raw.githubusercontent.com/caidevOficial/Python_Mini_DBZ_Game/main/assets/piccolo.gif",
    "https://raw.githubusercontent.com/caidevOficial/Python_Mini_DBZ_Game/main/assets/trunks.gif",
    "https://raw.githubusercontent.com/caidevOficial/Python_Mini_DBZ_Game/main/assets/kamehameha.gif",
    "https://raw.githubusercontent.com/caidevOficial/Python_Mini_DBZ_Game/main/assets/ki.gif",
    "https://raw.githubusercontent.com/caidevOficial/Python_Mini_DBZ_Game/main/assets/punch.gif",
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
