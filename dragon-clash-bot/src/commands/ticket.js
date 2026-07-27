import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "..", "..", "data", "tickets.json");

if (!existsSync(join(__dirname, "..", "..", "data"))) mkdirSync(join(__dirname, "..", "..", "data"), { recursive: true });
if (!existsSync(DATA_PATH)) writeFileSync(DATA_PATH, "[]");

function getTickets() {
  return JSON.parse(readFileSync(DATA_PATH, "utf-8"));
}

function saveTickets(data) {
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

export default {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Sistema de tickets de suporte")
    .addSubcommand((sub) =>
      sub
        .setName("criar")
        .setDescription("Cria o painel de tickets no canal atual")
    )
    .addSubcommand((sub) =>
      sub
        .setName("configurar")
        .setDescription("Define o canal de tickets")
        .addChannelOption((opt) =>
          opt
            .setName("canal")
            .setDescription("Canal onde o painel será enviado")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("fechar")
        .setDescription("Fecha o ticket atual")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "configurar") {
      const channel = interaction.options.getChannel("canal");
      const configPath = join(dirname(DATA_PATH), "ticket-config.json");
      const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf-8")) : {};
      config[interaction.guild.id] = channel.id;
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      await interaction.reply({
        content: `✅ Painel de tickets configurado em ${channel}`,
        ephemeral: true,
      });

      const openBtn = new ButtonBuilder()
        .setCustomId("ticket_open")
        .setLabel("🎫 Abrir Ticket")
        .setStyle(ButtonStyle.Primary);

      await channel.send({
        embeds: [
          {
            color: 0x1E88E5,
            title: "🎫 Suporte Dragon Ball Clash",
            description:
              "Precisa de ajuda? Abra um ticket clicando no botão abaixo!\n\n" +
              "**Motivos comuns:**\n" +
              "• Reportar um jogador\n" +
              "• Dúvidas sobre o jogo\n" +
              "• Problemas técnicos\n" +
              "• Sugestões",
            footer: { text: "Nossa equipe responderá em breve" },
          },
        ],
        components: [new ActionRowBuilder().addComponents(openBtn)],
      });
    }

    if (sub === "criar") {
      const configPath = join(dirname(DATA_PATH), "ticket-config.json");
      const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf-8")) : {};

      const channelId = config[interaction.guild.id];
      const channel = channelId
        ? interaction.guild.channels.cache.get(channelId)
        : interaction.channel;

      if (!channel) {
        return interaction.reply({ content: "❌ Configure um canal primeiro com `/ticket configurar`", ephemeral: true });
      }

      const openBtn = new ButtonBuilder()
        .setCustomId("ticket_open")
        .setLabel("🎫 Abrir Ticket")
        .setStyle(ButtonStyle.Primary);

      await channel.send({
        embeds: [
          {
            color: 0x1E88E5,
            title: "🎫 Suporte Dragon Ball Clash",
            description: "Precisa de ajuda? Abra um ticket clicando no botão abaixo!",
            footer: { text: "Nossa equipe responderá em breve" },
          },
        ],
        components: [new ActionRowBuilder().addComponents(openBtn)],
      });

      await interaction.reply({ content: `✅ Painel enviado em ${channel}`, ephemeral: true });
    }

    if (sub === "fechar") {
      const tickets = getTickets();
      const ticket = tickets.find((t) => t.channelId === interaction.channelId);
      if (!ticket) {
        return interaction.reply({ content: "❌ Este não é um canal de ticket.", ephemeral: true });
      }

      await interaction.reply({ content: "🔒 Fechando ticket em 5 segundos...", ephemeral: false });
      setTimeout(async () => {
        try {
          await interaction.channel.delete();
          const updated = tickets.filter((t) => t.channelId !== interaction.channelId);
          saveTickets(updated);
        } catch {}
      }, 5000);
    }
  },
};
