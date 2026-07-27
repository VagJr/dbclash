import urllib.request
import os

urls = [
    "https://www.spriters-resource.com/media/assets/153/156224.png",
    "https://www.spriters-resource.com/media/assets/153/156222.png",
]

headers = {"User-Agent": "Mozilla/5.0"}

for url in urls:
    filename = url.split('/')[-1]
    target = f"assets/spritesheets/lsw/vegeta_{filename}"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp, open(target, 'wb') as f:
            f.write(resp.read())
        print(f"Downloaded {target} ({os.path.getsize(target)} bytes)")
    except Exception as e:
        print(f"Failed {url}: {e}")
