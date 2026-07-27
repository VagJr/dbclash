import { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } from "discord.js";
import { readFileSync } from "fs";

export default {
  data: new SlashCommandBuilder()
    .setName("boas-vindas")
    .setDescription("Reenvia a mensagem de boas-vindas com a logo")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.guild.channels.cache.find(
      (ch) => ch.name === "boas-vindas"
    );

    if (!channel) {
      return interaction.editReply({ content: "❌ Canal #boas-vindas não encontrado." });
    }

    try {
      const imageBuffer = readFileSync("C:\\dbtcg\\imagens\\logo.png");
      const attachment = new AttachmentBuilder(imageBuffer, { name: "logo.png" });

      await channel.send({
        content: "🐉 **Bem-vindo ao Dragon Ball Clash — Action TCG!**\n\n⚔️ O Torneio do Poder começou! Carregue seu Ki, monte seu baralho e desafie os maiores guerreiros do universo.\n\n📌 Leia as regras e escolha seus cargos para começar.\n🔗 **Jogue agora:** https://dragonclash.vercel.app/",
        files: [attachment],
      });

      await interaction.editReply({ content: "✅ Mensagem de boas-vindas reenviada!" });
    } catch (err) {
      await interaction.editReply({ content: `❌ Erro: ${err.message}` });
    }
  },
};
