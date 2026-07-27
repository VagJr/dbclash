import { SlashCommandBuilder } from "discord.js";
import { getUserLevel } from "../utils/levels.js";

export default {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Mostra seu nível e XP no servidor")
    .addUserOption((opt) =>
      opt.setName("usuario").setDescription("Usuário para ver o rank").setRequired(false)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser("usuario") || interaction.user;
    const data = getUserLevel(user.id);
    const needed = data.level * 100;

    const progress = Math.min(data.xp / needed, 1);
    const barSize = 10;
    const filled = Math.round(progress * barSize);
    const bar = "█".repeat(filled) + "░".repeat(barSize - filled);

    const levelNames = [
      { min: 1, name: "Iniciante", color: 0x9E9E9E },
      { min: 5, name: "Guerreiro", color: 0x4CAF50 },
      { min: 10, name: "Lutador Z", color: 0x2196F3 },
      { min: 15, name: "Supremo", color: 0xFF9800 },
      { min: 20, name: "Super Saiyajin", color: 0xFFD700 },
      { min: 30, name: "Deus da Destruição", color: 0x9C27B0 },
    ];

    let title = levelNames[0].name;
    let color = levelNames[0].color;
    for (const l of levelNames) {
      if (data.level >= l.min) { title = l.name; color = l.color; }
    }

    await interaction.reply({
      embeds: [{
        color,
        title: `📊 ${user.displayName}`,
        fields: [
          { name: "Nível", value: `${data.level} — ${title}`, inline: true },
          { name: "XP", value: `${data.xp}/${needed}`, inline: true },
          { name: "Progresso", value: bar, inline: false },
        ],
        thumbnail: { url: user.displayAvatarURL() },
        footer: { text: "Dragon Ball Clash — Sistema de Níveis" },
        timestamp: new Date(),
      }],
    });
  },
};
