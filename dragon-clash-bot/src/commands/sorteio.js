import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("sorteio")
    .setDescription("Cria um sorteio no servidor")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption((opt) =>
      opt.setName("premio").setDescription("Prêmio do sorteio").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("descricao").setDescription("Descrição do sorteio").setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt.setName("duracao").setDescription("Duração em minutos (padrão: 60)").setRequired(false)
    ),

  async execute(interaction) {
    const prize = interaction.options.getString("premio");
    const desc = interaction.options.getString("descricao") || "Participe para ganhar!";
    const duration = (interaction.options.getInteger("duracao") || 60) * 60 * 1000;
    const endAt = Date.now() + duration;

    const enterBtn = new ButtonBuilder()
      .setCustomId("giveaway_enter")
      .setLabel("🎉 Participar")
      .setStyle(ButtonStyle.Success);

    const msg = await interaction.reply({
      embeds: [{
        color: 0xE91E63,
        title: "🎉 SORTEIO",
        description: `**Prêmio:** ${prize}\n\n${desc}\n\n⏱️ Termina: <t:${Math.floor(endAt / 1000)}:R>`,
        footer: { text: "Clique em Participar para concorrer!" },
        timestamp: new Date(),
      }],
      components: [new ActionRowBuilder().addComponents(enterBtn)],
      fetchReply: true,
    });

    const participants = new Set();

    const filter = (btnInt) => btnInt.customId === "giveaway_enter" && btnInt.message.id === msg.id;
    const collector = interaction.channel.createMessageComponentCollector({
      filter,
      time: duration,
    });

    collector.on("collect", async (btnInt) => {
      if (participants.has(btnInt.user.id)) {
        participants.delete(btnInt.user.id);
        await btnInt.reply({ content: "❌ Você saiu do sorteio.", ephemeral: true });
      } else {
        participants.add(btnInt.user.id);
        await btnInt.reply({ content: "✅ Você entrou no sorteio!", ephemeral: true });
      }
    });

    collector.on("end", async () => {
      const disableBtn = ButtonBuilder.from(enterBtn).setDisabled(true);
      await msg.edit({ components: [new ActionRowBuilder().addComponents(disableBtn)] });

      if (participants.size === 0) {
        return msg.reply({ content: "❌ Ninguém participou do sorteio." });
      }

      const winnerId = [...participants][Math.floor(Math.random() * participants.size)];
      const winner = await interaction.client.users.fetch(winnerId);

      await msg.reply({
        content: `🎉 **Parabéns ${winner}!** Você ganhou **${prize}**!`,
      });
    });
  },
};
