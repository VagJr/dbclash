import { SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("Mostra o status do jogo Dragon Ball Clash"),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const start = Date.now();
      const res = await fetch("https://dragonclash.vercel.app/", { method: "HEAD", signal: AbortSignal.timeout(5000) });
      const ping = Date.now() - start;

      await interaction.editReply({
        embeds: [{
          color: 0x43A047,
          title: "📊 Dragon Ball Clash — Dashboard",
          description: "Status do jogo e do servidor Discord",
          fields: [
            { name: "🌐 Site do Jogo", value: res.ok ? "✅ Online" : "⚠️ Instável", inline: true },
            { name: "📡 Ping", value: `${ping}ms`, inline: true },
            { name: "👥 Membros", value: `${interaction.guild.memberCount}`, inline: true },
            { name: "💬 Canais", value: `${interaction.guild.channels.cache.size}`, inline: true },
            { name: "👑 Cargos", value: `${interaction.guild.roles.cache.size}`, inline: true },
            { name: "🤖 Bot", value: `${interaction.client.user.tag}`, inline: true },
            { name: "🔗 Jogar", value: "https://dragonclash.vercel.app/", inline: false },
          ],
          thumbnail: { url: interaction.guild.iconURL() || undefined },
          footer: { text: "Dragon Ball Clash Action TCG" },
          timestamp: new Date(),
        }],
      });
    } catch {
      await interaction.editReply({
        embeds: [{
          color: 0xE53935,
          title: "📊 Dashboard",
          description: "O site do jogo parece estar offline no momento.",
          fields: [
            { name: "👥 Membros", value: `${interaction.guild.memberCount}`, inline: true },
            { name: "🤖 Bot", value: `${interaction.client.user.tag}`, inline: true },
          ],
          footer: { text: "Dragon Ball Clash Action TCG" },
          timestamp: new Date(),
        }],
      });
    }
  },
};
