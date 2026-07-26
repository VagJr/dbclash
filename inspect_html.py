import sys
import re

with open('c:/dbtcg/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

sections = re.findall(r'id=["\'](tab-[^"\']+|view-[^"\']+|page-[^"\']+|sec-[^"\']+|[^"\']+-view)["\']', text)
print("Views/Sections found in HTML:")
for s in sorted(set(sections)):
    print(" -", s)

ids = re.findall(r'<section[^>]+id=["\']([^"\']+)["\']', text)
print("\nAll section IDs:")
for i in ids:
    print(" -", i)
