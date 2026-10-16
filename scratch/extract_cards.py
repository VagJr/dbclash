import re
import json

with open(r'c:\dbtcg\js\card-database.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Match card objects
pattern = r"{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*type:\s*'([^']+)',\s*cost:\s*(\d+),\s*power:\s*(\d+)"
matches = re.findall(pattern, content)
print(f"Extracted {len(matches)} cards!")
for m in matches[:10]:
    print(m)
