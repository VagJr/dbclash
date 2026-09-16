# Dragon Ball Clash Action TCG — RC1 Smoke Test Matrix

Execute depois de `npm run rc:check`.

## Regra de aceitação

- P0: obrigatório para lançamento.
- P1: obrigatório para promover RC1 a stable.
- Se qualquer P0/P1 falhar, registrar o fluxo exato, console do navegador e terminal do servidor.
- Não implementar feature nova durante RC.

## 1. Boot / Conta / Persistência — P0

- [ ] Abrir em aba anônima: splash → title → login/guest sem erro de console.
- [ ] Criar conta nova.
- [ ] Logout → login novamente.
- [ ] Recarregar página e confirmar sessão persistida.
- [ ] Leader, moedas, coleção, decks, RP, nível, dojo e quests permanecem corretos.
- [ ] Senha errada retorna erro e não cria sessão local falsa.

## 2. AI Match — P0

- [ ] Iniciar partida contra IA.
- [ ] Jogar Attack, Technique, Defense, Evade e Counter.
- [ ] Carregar Ki e passar turno.
- [ ] Forçar Beam Clash.
- [ ] Finalizar vitória e derrota.
- [ ] Confirmar ausência de erro de console e estado travado.

## 3. Ranked 1v1 — P0

Use dois navegadores/perfis distintos.

- [ ] Ambos entram na fila.
- [ ] Match é encontrado.
- [ ] Cada jogador vê apenas a própria mão.
- [ ] Initiative correta dos dois lados.
- [ ] Attack/reaction sincronizados.
- [ ] Technique não vira ataque fantasma.
- [ ] Beam Clash consistente.
- [ ] KO encerra uma única vez.
- [ ] Vencedor recebe +25 RP/+150 XP.
- [ ] Perdedor recebe -15 RP/+50 XP.
- [ ] Leaderboard atualiza.

## 4. Reconnect / W.O. 1v1 — P0

- [ ] Fechar conexão de um jogador por menos de 30s.
- [ ] Reabrir e confirmar resume da mesma partida.
- [ ] Desconectar por mais de 30s.
- [ ] Confirmar W.O. uma única vez.
- [ ] Desconectar os dois: partida termina sem resultado ranked duplicado.

## 5. Ranked 2v2 Tag Team — P0

Use quatro sessões.

- [ ] Quatro contas entram e formam 2 times.
- [ ] Somente lutadores ativos comandam o duelo.
- [ ] Reserva não consegue jogar carta indevidamente.
- [ ] Troca voluntária consome o turno.
- [ ] KO troca automaticamente para reserva.
- [ ] Estados individuais de HP/Ki/mão/deck são preservados.
- [ ] Time perde somente quando os dois membros caem.
- [ ] Resultado ranked é aplicado uma vez aos quatro jogadores.
- [ ] Reconexão de um membro não destrói a partida.

## 6. Private Rooms — P1

- [ ] Criar sala privada 1v1.
- [ ] Entrar usando código de 6 caracteres.
- [ ] Finalizar partida e confirmar que RP não muda.
- [ ] Criar sala privada 2v2.
- [ ] Quatro contas entram pelo código.
- [ ] Finalizar e confirmar que RP não muda.

## 7. Raid 3–4 jogadores — P0

- [ ] Entrar com 3 jogadores e aguardar janela de 5s.
- [ ] Testar entrada do quarto jogador.
- [ ] Cada jogador vê própria mão, mas não mão dos aliados.
- [ ] Attack causa dano no boss.
- [ ] Technique funciona sem ataque fantasma.
- [ ] Defense reduz próximo ataque do boss.
- [ ] Evade zera ataque preparado.
- [ ] Counter devolve dano.
- [ ] Boss muda de fase em 75/50/25%.
- [ ] Ultimate a cada terceiro round.
- [ ] Jogador derrubado não trava ordem.
- [ ] Timeout faz auto-pass.
- [ ] Reconexão em menos de 30s funciona.
- [ ] Vitória paga Zeni/XP/Troféus/Gems uma única vez.
- [ ] Derrota não paga reward de vitória.

## 8. Economia / Coleção / Decks — P0

- [ ] Abrir booster: -300 Zeni.
- [ ] Booster não injeta carta automaticamente no deck.
- [ ] Quarta cópia vira Dust.
- [ ] Craft desconta Dust.
- [ ] Não permite craft acima de 3 cópias.
- [ ] Deck aceita 10–20 cartas.
- [ ] Máximo 3 cópias por carta.
- [ ] Não permite usar mais cópias que a coleção.
- [ ] Salvar deck → reload → deck permanece.
- [ ] Desbloquear Piccolo/Trunks desconta Zeni e concede starter.

## 9. Dojos — P1

- [ ] Criar Dojo.
- [ ] Nome/TAG duplicados são rejeitados.
- [ ] Segunda conta entra.
- [ ] Ranking de Dojo reflete poder real.
- [ ] Dono sai e liderança transfere.
- [ ] Perfil persiste dojoId.

## 10. Quests diárias — P1

- [ ] Abrir booster e observar progresso.
- [ ] Jogar partida online e observar progresso.
- [ ] Vencer partida e observar progresso.
- [ ] Concluir Raid e observar progresso.
- [ ] Claim só funciona ao completar.
- [ ] Claim paga uma única vez.
- [ ] Reload não duplica recompensa.

## 11. Chat / XSS / Flood — P0

Enviar como mensagem e nome, quando possível:

`<img src=x onerror=alert(1)>`

- [ ] Aparece como texto, nunca executa.
- [ ] Mensagem >300 chars é truncada.
- [ ] Flood rápido é limitado pelo servidor.
- [ ] Chat de sala não vaza para outra sala.

## 12. PWA / Cache — P1

- [ ] Service Worker registrado.
- [ ] App instalável no navegador compatível.
- [ ] Reload normal não apaga cache inteiro.
- [ ] HTML navegação atualiza via network-first.
- [ ] Assets podem carregar do cache.
- [ ] API e Socket.io nunca são servidos do cache.
- [ ] Rotação retrato/paisagem funciona.

## 13. Mobile / Desktop QoL — P1

- [ ] 360px largura: menu navegável.
- [ ] 768px: Deck Lab utilizável.
- [ ] Desktop: arena sem overlay cortado.
- [ ] Nenhum clique força fullscreen.
- [ ] Fullscreen manual funciona via `window.dbclashRequestFullscreen()`.
- [ ] Botões têm estado disabled visível.
- [ ] Nenhum scroll/trava impede jogar carta.

## 14. Produção — P0

No ambiente de deploy:

- [ ] `NODE_ENV=production`
- [ ] `MONGODB_URI` definido.
- [ ] `AUTH_SECRET` com 32+ chars.
- [ ] `CLIENT_URL`/`ALLOWED_ORIGINS` correto.
- [ ] `npm run rc:verify:prod` retorna 0 FAIL.
- [ ] `/health` mostra DB conectado.
- [ ] Origem não autorizada é bloqueada por CORS.
- [ ] Frontend autorizado conecta Socket.io.
- [ ] Sem secrets expostos no bundle/browser.

## Critério final

Promover `1.0.0-rc.1` para `1.0.0` somente com:

- `npm run rc:check` verde;
- todos P0 e P1 verdes;
- 0 release blockers;
- 0 erros de console nos fluxos principais.
