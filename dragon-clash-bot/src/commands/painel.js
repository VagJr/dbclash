import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("painel")
    .setDescription("Mostra o painel de informações do Dragon Ball Clash"),

  async execute(interaction) {
    const serverUrl = "https://dragonclash.vercel.app/";

    await interaction.reply({
      embeds: [
        {
          color: 0xFFD700,
          title: "🐉 Dragon Ball Clash — Action TCG",
          description:
            "O Torneio do Poder começou! Entre na arena e prove seu valor.",
          fields: [
            {
              name: "🎮 Jogar Agora",
              value: `[Clique aqui](${serverUrl}) para entrar no jogo`,
              inline: true,
            },
            {
              name: "📊 Status",
              value: "✅ Online",
              inline: true,
            },
            {
              name: "👥 Jogadores Online",
              value: `${interaction.guild.memberCount}`,
              inline: true,
            },
            {
              name: "🤖 Comandos do Bot",
              value:
                "`/setup-server` — Configurar o servidor\n" +
                "`/criar-cargo` — Criar cargo personalizado\n" +
                "`/painel` — Mostrar este painel\n" +
                "`/divulgar` — Divulgar o jogo",
            },
          ],
          thumbnail: {
            url: interaction.guild.iconURL() || undefined,
          },
          image: {
            url: `${serverUrl}assets/leaders/goku.png`,
          },
          footer: { text: "Dragon Ball Clash Action TCG — DBTCG Studios" },
          timestamp: new Date(),
        },
      ],
    });
  },
};
