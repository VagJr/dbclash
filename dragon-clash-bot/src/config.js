export const COLORS = {
  VERMELHO: 0xE53935,
  LARANJA: 0xFB8C00,
  AMARELO: 0xFFD600,
  VERDE: 0x43A047,
  AZUL: 0x1E88E5,
  ROXO: 0x8E24AA,
  ROSA: 0xEC407A,
  CIANO: 0x00ACC1,
  BRANCO: 0xFFFFFF,
  PRETO: 0x212121,
  DOURADO: 0xFFD700,
  PRATA: 0xC0C0C0,
};

export const SERVER_CONFIG = {
  name: "Dragon Ball Clash — TCG Action",
  description: "Servidor oficial do Dragon Ball Clash Action TCG. Entre no Torneio do Poder, monte seu baralho e dispute batalhas em tempo real!",

  categories: [
    {
      name: "📢 INFORMAÇÕES",
      position: 0,
      channels: [
        { name: "regras", type: "text", description: "Regras do servidor e do jogo" },
        { name: "anuncios", type: "text", description: "Novidades e atualizações do jogo" },
        { name: "boas-vindas", type: "text", description: "Apresente-se para a comunidade" },
        { name: "cargos", type: "text", description: "Escolha seus cargos aqui" },
        { name: "status-do-jogo", type: "text", description: "Status dos servidores e manutenções" },
      ],
    },
    {
      name: "🛡️ COMUNIDADE",
      position: 1,
      channels: [
        { name: "chat-geral", type: "text", description: "Converse sobre o jogo e outros assuntos" },
        { name: "apresentacoes", type: "text", description: "Conte-nos sobre você, guerreiro!" },
        { name: "fan-art", type: "text", description: "Compartilhe suas artes do Dragon Ball" },
        { name: "sugestoes", type: "text", description: "Mande suas ideias para o jogo" },
        { name: "reportar-bugs", type: "text", description: "Reporte bugs que encontrar" },
      ],
    },
    {
      name: "⚔️ COMBATE & ESTRATÉGIA",
      position: 2,
      channels: [
        { name: "estrategias-decks", type: "text", description: "Compartilhe estratégias de baralho" },
        { name: "dicas-de-combate", type: "text", description: "Dicas de Z-Vanish, beam dispute e mais" },
        { name: "replays-batalhas", type: "text", description: "Poste seus replays e melhores momentos" },
        { name: "buscar-duelos", type: "text", description: "Encontre oponentes para batalhar" },
      ],
    },
    {
      name: "🎴 COLECIONÁVEIS",
      position: 3,
      channels: [
        { name: "colecao-cartas", type: "text", description: "Mostre sua coleção de cartas" },
        { name: "negociacoes", type: "text", description: "Negocie cartas com outros jogadores" },
        { name: "pacotes-booster", type: "text", description: "Resultados dos seus pacotes booster" },
        { name: "decks", type: "text", description: "Compartilhe listas de baralho completas" },
      ],
    },
    {
      name: "🏯 DOJOS (CLÃS)",
      position: 4,
      channels: [
        { name: "chat-dojos", type: "text", description: "Converse sobre clãs e alianças" },
        { name: "recrutamento", type: "text", description: "Recrute membros para seu Dojo" },
        { name: "ranking-dojos", type: "text", description: "Ranking dos melhores Dojos" },
      ],
    },
    {
      name: "🏆 RANQUEADO & TORNEIOS",
      position: 5,
      channels: [
        { name: "leaderboard", type: "text", description: "Classificação dos melhores jogadores" },
        { name: "torneios", type: "text", description: "Informações sobre torneios" },
        { name: "resultados", type: "text", description: "Resultados de partidas ranqueadas" },
      ],
    },
    {
      name: "📜 MISSÕES & EVENTOS",
      position: 6,
      channels: [
        { name: "missoes-diarias", type: "text", description: "Missões e desafios diários" },
        { name: "eventos", type: "text", description: "Eventos especiais do jogo" },
        { name: "recompensas", type: "text", description: "Resgate suas recompensas" },
      ],
    },
    {
      name: "🔊 CANAIS DE VOZ",
      position: 7,
      channels: [
        { name: "Geral", type: "voice" },
        { name: "Batalhas", type: "voice" },
        { name: "Estratégia", type: "voice" },
        { name: "Música", type: "voice" },
      ],
    },
  ],

  roles: [
    {
      name: "👑 Dono",
      color: COLORS.DOURADO,
      hoist: true,
      mentionable: true,
      priority: 1,
      permissions: "ADMINISTRATOR",
    },
    {
      name: "🔧 Admin",
      color: COLORS.VERMELHO,
      hoist: true,
      mentionable: true,
      priority: 2,
      permissions: "ADMINISTRATOR",
    },
    {
      name: "🛡️ Mod",
      color: COLORS.LARANJA,
      hoist: true,
      mentionable: true,
      priority: 3,
      permissions: [
        "KickMembers",
        "BanMembers",
        "MuteMembers",
        "DeafenMembers",
        "MoveMembers",
        "ManageMessages",
        "ManageNicknames",
      ],
    },
    {
      name: "🌟 Deus da Destruição",
      color: COLORS.ROXO,
      hoist: true,
      mentionable: true,
      priority: 4,
      permissions: ["PrioritySpeaker"],
    },
    {
      name: "🔥 Supremo",
      color: COLORS.VERMELHO,
      hoist: true,
      priority: 5,
    },
    {
      name: "⚡ Avançado",
      color: COLORS.LARANJA,
      hoist: true,
      priority: 6,
    },
    {
      name: "🟢 Guerreiro",
      color: COLORS.VERDE,
      hoist: true,
      priority: 7,
    },
    {
      name: "⚪ Iniciante",
      color: COLORS.BRANCO,
      hoist: true,
      priority: 8,
    },
    {
      name: "🎮 Jogador",
      color: COLORS.AZUL,
      hoist: false,
      priority: 9,
    },
    {
      name: "🔴 Goku",
      color: COLORS.VERMELHO,
      priority: 10,
    },
    {
      name: "🟠 Vegeta",
      color: COLORS.LARANJA,
      priority: 11,
    },
    {
      name: "🟣 Gohan",
      color: COLORS.ROXO,
      priority: 12,
    },
    {
      name: "⚪ Frieza",
      color: COLORS.BRANCO,
      priority: 13,
    },
    {
      name: "🟢 Piccolo",
      color: COLORS.VERDE,
      priority: 14,
    },
    {
      name: "🔵 Future Trunks",
      color: COLORS.CIANO,
      priority: 15,
    },
    {
      name: "🎤 Eventos",
      color: COLORS.ROSA,
      hoist: true,
      priority: 16,
    },
    {
      name: "🤖 Bot",
      color: COLORS.AZUL,
      hoist: false,
      priority: 99,
    },
  ],

  rulesEmbed: {
    title: "📜 Regras do Dragon Ball Clash",
    description: "Bem-vindo ao Torneio do Poder! Siga as regras abaixo para manter a harmonia.",
    fields: [
      { name: "1. Respeito acima de tudo", value: "Trate todos com respeito. Ofensas, discriminação ou assédio não serão tolerados." },
      { name: "2. Sem spam", value: "Evite flood, mensagens repetitivas ou divulgação não autorizada." },
      { name: "3. Canais corretos", value: "Mantenha cada conversa no canal apropriado." },
      { name: "4. Sem cheats/hacks", value: "Discussão ou promoção de trapaças resultará em banimento imediato." },
      { name: "5. Conteúdo +18", value: "Proibido conteúdo adulto ou inapropriado." },
      { name: "6. Siga os ToS do Discord", value: "Termos de Serviço do Discord devem ser seguidos." },
      { name: "7. Divirta-se!", value: "No final, o importante é se divertir e fazer amigos! 🐉" },
    ],
    footer: "Dragon Ball Clash Action TCG — DBTCG Studios",
  },
};

export const EMOJIS = {
  zeni: "<:zeni:>",
  ki: "<:ki:>",
  goku: "<:goku:>",
  vegeta: "<:vegeta:>",
  gohan: "<:gohan:>",
  frieza: "<:frieza:>",
  piccolo: "<:piccolo:>",
  trunks: "<:trunks:>",
};
