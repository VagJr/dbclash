import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { COLORS } from "../config.js";

export default {
  data: new SlashCommandBuilder()
    .setName("criar-cargo")
    .setDescription("Cria um cargo personalizado no servidor")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption((opt) =>
      opt.setName("nome").setDescription("Nome do cargo").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("cor")
        .setDescription("Cor do cargo (ex: VERMELHO, AZUL, #hex)")
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt.setName("exibir").setDescription("Exibir separadamente?").setRequired(false)
    ),

  async execute(interaction) {
    const name = interaction.options.getString("nome");
    const colorInput = interaction.options.getString("cor") || "AZUL";
    const hoist = interaction.options.getBoolean("exibir") ?? false;

    const color =
      COLORS[colorInput.toUpperCase()] ||
      parseInt(colorInput.replace("#", ""), 16) ||
      COLORS.AZUL;

    const role = await interaction.guild.roles.create({
      name,
      color,
      hoist,
      reason: `Cargo criado por ${interaction.user.tag}`,
    });

    await interaction.reply({
      embeds: [
        {
          color,
          title: "✅ Cargo Criado",
          description: `Cargo **${role.name}** (${role}) criado com sucesso!`,
          footer: { text: `ID: ${role.id}` },
        },
      ],
      ephemeral: true,
    });
  },
};
