import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("divulgar")
    .setDescription("Envia uma divulgação do jogo no canal atual")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const serverUrl = "https://dragonclash.vercel.app/";

    await interaction.reply({
      embeds: [
        {
          color: 0xE53935,
          title: "⚔️ DRAGON BALL CLASH — ACTION TCG",
          description:
            "**O Torneio do Poder chegou ao Discord!**\n\n" +
            "Entre em batalhas em tempo real, monte seu baralho com 20 cartas, " +
            "domine o Z-Vanish e dispute o Rank Deus da Destruição!\n\n" +
            "🔥 **Características:**\n" +
            "• Combates em tempo real com sistema de turnos\n" +
            "• 6 lutadores jogáveis: Goku, Vegeta, Gohan, Frieza, Piccolo e Future Trunks\n" +
            "• Sistema de Beam Dispute\n" +
            "• Modo Ranqueado com elos\n" +
            "• Dojos (Clãs) e ranking\n" +
            "• Coleção de cartas TCG com pacotes booster\n" +
            "• Desperte seus personagens com a forma Awakened!\n\n" +
            `👉 **Jogue agora:** ${serverUrl}`,
          image: {
            url: `${serverUrl}assets/leaders/vegeta.png`,
          },
          footer: { text: "Dragon Ball Clash Action TCG — DBTCG Studios" },
          timestamp: new Date(),
        },
      ],
    });
  },
};
