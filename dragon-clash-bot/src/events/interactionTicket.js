import {
  ChannelType,
  ButtonStyle,
  ButtonBuilder,
  ActionRowBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "..", "..", "data", "tickets.json");

if (!existsSync(join(__dirname, "..", "..", "data"))) mkdirSync(join(__dirname, "..", "..", "data"), { recursive: true });
if (!existsSync(DATA_PATH)) writeFileSync(DATA_PATH, "[]");

function getTickets() { return JSON.parse(readFileSync(DATA_PATH, "utf-8")); }
function saveTickets(data) { writeFileSync(DATA_PATH, JSON.stringify(data, null, 2)); }

export default {
  name: "interactionCreate",
  async execute(interaction) {
    if (!interaction.isButton()) return;

    if (interaction.customId === "ticket_open") {
      const existing = getTickets().find((t) => t.userId === interaction.user.id && t.guildId === interaction.guild.id);
      if (existing) {
        return interaction.reply({
          content: `❌ Você já tem um ticket aberto: <#${existing.channelId}>`,
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const ticketId = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now() % 10000}`;
      const everyoneRole = interaction.guild.roles.everyone;

      const channel = await interaction.guild.channels.create({
        name: ticketId,
        type: ChannelType.GuildText,
        parent: interaction.channel.parentId || undefined,
        permissionOverwrites: [
          { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
        ],
      });

      const modRole = interaction.guild.roles.cache.find((r) => r.name.includes("Mod") || r.name.includes("Admin"));
      if (modRole) {
        await channel.permissionOverwrites.create(modRole, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
      }

      const tickets = getTickets();
      tickets.push({ userId: interaction.user.id, channelId: channel.id, guildId: interaction.guild.id, createdAt: Date.now() });
      saveTickets(tickets);

      const closeBtn = new ButtonBuilder().setCustomId("ticket_close").setLabel("🔒 Fechar Ticket").setStyle(ButtonStyle.Danger);
      await channel.send({
        content: `<@${interaction.user.id}> ${modRole ? `<@&${modRole.id}>` : ""}`,
        embeds: [{
          color: 0x43A047,
          title: "🎫 Ticket Criado",
          description: `Bem-vindo ao seu ticket, ${interaction.user.displayName}!\n\nDescreva seu problema que nossa equipe irá atender.`,
          footer: { text: "Clique no botão abaixo para fechar o ticket" },
          timestamp: new Date(),
        }],
        components: [new ActionRowBuilder().addComponents(closeBtn)],
      });

      return interaction.editReply({ content: `✅ Ticket criado: ${channel}` });
    }

    if (interaction.customId === "ticket_close") {
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
