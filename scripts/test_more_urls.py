import urllib.request

urls = [
    "https://raw.githubusercontent.com/CodewithEvilxd/codewithEvilxd/main/goku.gif",
    "https://raw.githubusercontent.com/IureRosa/IureRosa/main/goku.gif",
    "https://raw.githubusercontent.com/HeyBoY-ops/HeyBoY-ops/main/goku.gif",
    "https://raw.githubusercontent.com/svict4/emojis/main/goku.gif",
    "https://raw.githubusercontent.com/CodewithEvilxd/codewithEvilxd/master/goku.gif",
    "https://raw.githubusercontent.com/IureRosa/IureRosa/master/goku.gif",
]

for url in urls:
    print(f"Testing {url}...")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
            print(f"  -> SUCCESS ({len(data)} bytes)")
    except Exception as e:
        print(f"  -> FAILED: {e}")
