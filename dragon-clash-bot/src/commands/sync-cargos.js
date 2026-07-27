import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { SERVER_CONFIG } from "../config.js";

export default {
  data: new SlashCommandBuilder()
    .setName("sync-cargos")
    .setDescription("Recria cargos que foram deletados acidentalmente")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const { guild } = interaction;
    let created = 0;

    for (const roleConfig of SERVER_CONFIG.roles) {
      const exists = guild.roles.cache.find((r) => r.name === roleConfig.name);
      if (exists) continue;

      const perms =
        roleConfig.permissions === "ADMINISTRATOR"
          ? [PermissionFlagsBits.Administrator]
          : Array.isArray(roleConfig.permissions)
            ? roleConfig.permissions.map(
                (p) => PermissionFlagsBits[p] ?? 0n
              )
            : [];

      await guild.roles.create({
        name: roleConfig.name,
        color: roleConfig.color,
        hoist: roleConfig.hoist ?? false,
        mentionable: roleConfig.mentionable ?? false,
        permissions: perms,
      });

      created++;
    }

    await interaction.editReply({
      content: `✅ **${created}** cargos restaurados com sucesso!`,
    });
  },
};
