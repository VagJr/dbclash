with open('c:/dbtcg/js/ui-manager.js', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')
new_lines = []
for l in lines:
    if 'el.style.left =' in l:
        new_lines.append("    el.style.left = x + 'px';")
    elif 'el.style.top =' in l:
        new_lines.append("    el.style.top = y + 'px';")
    else:
        new_lines.append(l)

with open('c:/dbtcg/js/ui-manager.js', 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

print('FIXED UI-MANAGER.JS SUCCESSFULLY!')
