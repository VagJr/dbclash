import { SlashCommandBuilder } from "discord.js";
import { getLeaderboard } from "../utils/levels.js";

export default {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Mostra o ranking de níveis do servidor"),

  async execute(interaction) {
    const top = getLeaderboard();

    if (top.length === 0) {
      return interaction.reply({ content: "📊 Nenhum dado de XP ainda. Comece a conversar para ganhar XP!" });
    }

    const lines = await Promise.all(
      top.map(async (entry, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        let name = entry.id;
        try {
          const user = await interaction.client.users.fetch(entry.id);
          name = user.displayName;
        } catch {}
        return `${medal} **${name}** — Nível ${entry.level} (${entry.xp} XP)`;
      })
    );

    await interaction.reply({
      embeds: [{
        color: 0xFFD700,
        title: "🏆 Leaderboard — Dragon Ball Clash",
        description: lines.join("\n"),
        footer: { text: "Ganhe XP conversando nos canais!" },
        timestamp: new Date(),
      }],
    });
  },
};
