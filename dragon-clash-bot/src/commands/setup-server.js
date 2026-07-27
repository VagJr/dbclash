import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import { SERVER_CONFIG } from "../config.js";

export default {
  data: new SlashCommandBuilder()
    .setName("setup-server")
    .setDescription("Constrói todo o servidor Discord do Dragon Ball Clash")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption((opt) =>
      opt
        .setName("regras")
        .setDescription("Enviar embed de regras no #regras")
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const { guild } = interaction;
    const sendRules = interaction.options.getBoolean("regras") ?? true;

    const report = {
      categories: 0,
      channels: 0,
      roles: 0,
    };

    try {
      // 1. CRIAR CARGOS na ordem de prioridade
      const sortedRoles = [...SERVER_CONFIG.roles].sort(
        (a, b) => a.priority - b.priority
      );

      for (const roleConfig of sortedRoles) {
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

        report.roles++;
      }

      // 2. CRIAR CATEGORIAS E CANAIS
      const existingCategories = guild.channels.cache.filter(
        (ch) => ch.type === ChannelType.GuildCategory
      );

      for (const catConfig of SERVER_CONFIG.categories) {
        let category = existingCategories.find((c) => c.name === catConfig.name);

        if (!category) {
          category = await guild.channels.create({
            name: catConfig.name,
            type: ChannelType.GuildCategory,
            position: catConfig.position,
          });
          report.categories++;
        }

        for (const chConfig of catConfig.channels) {
          const exists = guild.channels.cache.find(
            (ch) => ch.name === chConfig.name && ch.parentId === category.id
          );
          if (exists) continue;

          const type =
            chConfig.type === "voice"
              ? ChannelType.GuildVoice
              : ChannelType.GuildText;

          await guild.channels.create({
            name: chConfig.name,
            type,
            parent: category.id,
            topic: chConfig.description || undefined,
          });

          report.channels++;
        }
      }

      // 3. ENVIAR REGRAS (se solicitado)
      if (sendRules) {
        const rulesChannel = guild.channels.cache.find(
          (ch) => ch.name === "regras" && ch.type === ChannelType.GuildText
        );
        if (rulesChannel) {
          const existing = (await rulesChannel.messages.fetch({ limit: 10 }))
            .filter((m) => m.author.id === interaction.client.user.id)
            .first();

          if (!existing) {
            await rulesChannel.send({
              embeds: [
                {
                  color: 0xE53935,
                  title: SERVER_CONFIG.rulesEmbed.title,
                  description: SERVER_CONFIG.rulesEmbed.description,
                  fields: SERVER_CONFIG.rulesEmbed.fields,
                  footer: {
                    text: SERVER_CONFIG.rulesEmbed.footer,
                  },
                  thumbnail: {
                    url: guild.iconURL() || undefined,
                  },
                  timestamp: new Date(),
                },
              ],
            });
          }
        }
      }

      // 4. Configurar canal de boas-vindas (enviar mensagem inicial)
      const welcomeChannel = guild.channels.cache.find(
        (ch) => ch.name === "boas-vindas" && ch.type === ChannelType.GuildText
      );
      if (welcomeChannel) {
        const existing = (await welcomeChannel.messages.fetch({ limit: 10 }))
          .filter((m) => m.author.id === interaction.client.user.id)
          .first();

        if (!existing) {
          await welcomeChannel.send({
            embeds: [
              {
                color: 0xFFD700,
                title: "🐉 Dragon Ball Clash — Action TCG",
                description:
                  "Bem-vindo ao servidor oficial!\n\n" +
                  "**⚔️ O Torneio do Poder começou!**\n" +
                  "Carregue seu Ki, domine o Z-Vanish e destrua seus oponentes.\n\n" +
                  "📌 Leia as <#" +
                  (guild.channels.cache.find((c) => c.name === "regras")?.id ||
                    "") +
                  "> para começar.\n" +
                  "🎮 Escolha seus cargos em <#" +
                  (guild.channels.cache.find((c) => c.name === "cargos")
                    ?.id || "") +
                  ">.\n\n" +
                  "🔗 **Jogue agora:** https://dragonclash.vercel.app/",
                image: {
                  url: "https://dragonclash.vercel.app/assets/leaders/goku.png",
                },
                footer: { text: "Dragon Ball Clash Action TCG — DBTCG Studios" },
                timestamp: new Date(),
              },
            ],
          });
        }
      }

      // 5. Enviar mensagem no canal de cargos
      const cargosChannel = guild.channels.cache.find(
        (ch) => ch.name === "cargos" && ch.type === ChannelType.GuildText
      );
      if (cargosChannel) {
        const existing = (await cargosChannel.messages.fetch({ limit: 10 }))
          .filter((m) => m.author.id === interaction.client.user.id)
          .first();

        if (!existing) {
          const personagens = SERVER_CONFIG.roles
            .filter(
              (r) =>
                ["Goku", "Vegeta", "Gohan", "Frieza", "Piccolo", "Future Trunks"].includes(
                  r.name.replace(/[^\w\s]/g, "").trim()
                )
            )
            .map((r) => `🟢 Reaja com ${r.name}`)
            .join("\n");

          const cargosMsg = await cargosChannel.send({
            embeds: [
              {
                color: 0x1E88E5,
                title: "🎭 Escolha seus Cargos",
                description:
                  "Selecione seu personagem favorito reagindo abaixo!\n\n" +
                  personagens,
                footer: { text: "Os cargos serão atribuídos automaticamente" },
              },
            ],
          });

          const emojis = ["🔴", "🟠", "🟣", "⚪", "🟢", "🔵"];
          for (const emoji of emojis) {
            await cargosMsg.react(emoji).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error(err);
      return interaction.editReply({
        content: `❌ Erro durante a configuração: \`${err.message}\``,
      });
    }

    await interaction.editReply({
      embeds: [
        {
          color: 0x43A047,
          title: "✅ Servidor Configurado com Sucesso!",
          description:
            "O Dragon Ball Clash foi montado na arena!\n\n" +
            `📁 **${report.categories}** categorias criadas\n` +
            `💬 **${report.channels}** canais criados\n` +
            `👑 **${report.roles}** cargos criados\n\n` +
            `Canais já existentes foram preservados.`,
          footer: {
            text: "Use /painel para ver os comandos disponíveis",
          },
          timestamp: new Date(),
        },
      ],
    });
  },
};
