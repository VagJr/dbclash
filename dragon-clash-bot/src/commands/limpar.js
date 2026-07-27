import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("limpar")
    .setDescription("Limpa mensagens do canal")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((opt) =>
      opt
        .setName("quantidade")
        .setDescription("Número de mensagens para limpar (1-100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  async execute(interaction) {
    const amount = interaction.options.getInteger("quantidade");

    await interaction.deferReply({ ephemeral: true });

    const messages = await interaction.channel.bulkDelete(amount, true);
    await interaction.editReply({
      content: `✅ **${messages.size}** mensagens apagadas.`,
    });
  },
};
