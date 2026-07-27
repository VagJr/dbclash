# Dragon Ball Clash — Bot Discord

Bot oficial do **Dragon Ball Clash Action TCG** para configurar e gerenciar seu servidor Discord.

## Funcionalidades

### 🛠️ Administração
- **`/setup-server`** — Constrói o servidor completo (categorias, canais, cargos, regras)
- **`/criar-cargo`** — Cria cargos personalizados
- **`/sync-cargos`** — Restaura cargos deletados
- **`/limpar`** — Limpa mensagens do chat
- **`/config-log`** — Define o canal de logs do servidor

### 🎫 Comunidade & Suporte
- **`/ticket`** — Sistema de tickets (abrir/fechar/configurar painel)
- **`/sorteio`** — Cria sorteios no servidor
- **`/painel`** — Painel informativo do jogo
- **`/divulgar`** — Divulga o Dragon Ball Clash no chat

### 📊 Experiência & Ranking
- **`/rank`** — Mostra seu nível e XP
- **`/leaderboard`** — Ranking de níveis do servidor
- **`/dashboard`** — Status do jogo e do servidor

### 🎵 Música
- **`/musica tocar`** — Toca música do YouTube
- **`/musica pular`** — Pula a música atual
- **`/musica parar`** — Para a música e sai do canal
- **`/musica fila`** — Mostra a fila de músicas

### 🤖 Automático
- **Boas-vindas com imagem** — Imagem personalizada ao entrar
- **Cargos por reação** no #cargos
- **Sistema de XP** — Ganhe XP conversando, suba de nível
- **Logs automáticos** — Entradas/saídas, mensagens deletadas/editadas

## Estrutura do Servidor

O comando `/setup-server` cria automaticamente:

### Categorias e Canais
| Categoria | Canais |
|-----------|--------|
| 📢 INFORMAÇÕES | #regras, #anuncios, #boas-vindas, #cargos, #status-do-jogo |
| 🛡️ COMUNIDADE | #chat-geral, #apresentacoes, #fan-art, #sugestoes, #reportar-bugs |
| ⚔️ COMBATE & ESTRATÉGIA | #estrategias-decks, #dicas-de-combate, #replays-batalhas, #buscar-duelos |
| 🎴 COLECIONÁVEIS | #colecao-cartas, #negociacoes, #pacotes-booster, #decks |
| 🏯 DOJOS (CLÃS) | #chat-dojos, #recrutamento, #ranking-dojos |
| 🏆 RANQUEADO & TORNEIOS | #leaderboard, #torneios, #resultados |
| 📜 MISSÕES & EVENTOS | #missoes-diarias, #eventos, #recompensas |
| 🔊 CANAIS DE VOZ | Geral, Batalhas, Estratégia, Música |

### Cargos
- 👑 Dono, 🔧 Admin, 🛡️ Mod
- Ranks: 🌟 Deus da Destruição, 🔥 Supremo, ⚡ Avançado, 🟢 Guerreiro, ⚪ Iniciante
- Personagens: 🔴 Goku, 🟠 Vegeta, 🟣 Gohan, ⚪ Frieza, 🟢 Piccolo, 🔵 Future Trunks
- 🎤 Eventos, 🤖 Bot, 🎮 Jogador

## Como Usar

### 1. Crie o bot no Discord Developer Portal
1. Acesse https://discord.com/developers/applications
2. Crie uma **New Application** com nome "Dragon Ball Clash"
3. Vá em **Bot** > **Add Bot**
4. Em **Token**, clique em **Reset Token** e copie o token
5. Em **Privileged Gateway Intents**, ative:
   - `SERVER MEMBERS INTENT`
   - `MESSAGE CONTENT INTENT`

### 2. Convide o bot para seu servidor
1. Vá em **OAuth2** > **URL Generator**
2. Marque `bot` e `applications.commands`
3. Marque permissões: `Administrator`
4. Copie a URL gerada e abra no navegador

### 3. Configure o bot
```bash
# Clone ou copie os arquivos do bot
cd dragon-clash-bot

# Instale as dependências
npm install

# Configure o .env
cp .env.example .env
```

Edite o arquivo `.env`:
```env
DISCORD_TOKEN=seu_token_aqui
GUILD_ID=id_do_seu_servidor
```

### 4. Inicie o bot
```bash
npm start
```

### 5. Configure o servidor
No Discord, use o comando:
```
/setup-server regras:true
```

O bot criará todas as categorias, canais e cargos automaticamente!

## Adicionar Emojis Personalizados

Para os emojis de Zeni e Ki funcionarem, adicione-os no servidor:
- Vá em **Server Settings** > **Emoji**
- Faça upload dos emojis com os nomes: `zeni`, `ki`, `goku`, `vegeta`, `gohan`, `frieza`, `piccolo`, `trunks`

## Tecnologia

- **discord.js v14** — Biblioteca oficial do Discord
- **Node.js 18+** — Runtime JavaScript
