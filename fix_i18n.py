with open('c:/dbtcg/js/i18n.js', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')
new_lines = []
for l in lines:
    if 'opponentTurnBanner:' in l and 'PREPARE' in l:
        if 'TURNO DO OPONENTE' in l:
            new_lines.append("    opponentTurnBanner: '🛡️ TURNO DO OPONENTE (PENSANDO JOGADA...)',")
        else:
            new_lines.append("    opponentTurnBanner: '🛡️ OPPONENT TURN (THINKING MOVE...)',")
    else:
        new_lines.append(l)

with open('c:/dbtcg/js/i18n.js', 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

print('FIXED I18N.JS SUCCESSFULLY!')
