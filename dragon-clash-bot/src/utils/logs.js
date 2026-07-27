import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "..", "..", "data");
const CONFIG_PATH = join(DATA_PATH, "log-config.json");

if (!existsSync(DATA_PATH)) mkdirSync(DATA_PATH, { recursive: true });
if (!existsSync(CONFIG_PATH)) writeFileSync(CONFIG_PATH, "{}");

function getConfig(guildId) {
  const data = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  return data[guildId] || null;
}

export function getLogChannel(guild) {
  if (!guild) return null;
  const channelId = getConfig(guild.id);
  if (channelId) return guild.channels.cache.get(channelId);
  return guild.channels.cache.find((ch) => ch.name === "logs" && ch.type === 0);
}

export function registerLogs(client) {
  client.on("guildMemberAdd", async (member) => {
    const log = getLogChannel(member.guild);
    if (!log) return;
    log.send({
      embeds: [{
        color: 0x43A047,
        title: "✅ Membro Entrou",
        description: `${member.user.tag} (<@${member.id}>)`,
        fields: [
          { name: "Conta criada", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
          { name: "Membros agora", value: `${member.guild.memberCount}`, inline: true },
        ],
        thumbnail: { url: member.user.displayAvatarURL() },
        timestamp: new Date(),
      }],
    }).catch(() => {});
  });

  client.on("guildMemberRemove", async (member) => {
    const log = getLogChannel(member.guild);
    if (!log) return;
    log.send({
      embeds: [{
        color: 0xE53935,
        title: "❌ Membro Saiu",
        description: `${member.user.tag} (<@${member.id}>)`,
        fields: [{ name: "Membros agora", value: `${member.guild.memberCount}`, inline: true }],
        thumbnail: { url: member.user.displayAvatarURL() },
        timestamp: new Date(),
      }],
    }).catch(() => {});
  });

  client.on("messageDelete", async (message) => {
    if (message.author?.bot || !message.content) return;
    const log = getLogChannel(message.guild);
    if (!log) return;
    log.send({
      embeds: [{
        color: 0xFB8C00,
        title: "🗑️ Mensagem Deletada",
        description: `**Autor:** ${message.author.tag}\n**Canal:** ${message.channel}\n**Conteúdo:** ${message.content.slice(0, 1000)}`,
        timestamp: new Date(),
      }],
    }).catch(() => {});
  });

  client.on("messageUpdate", async (oldMsg, newMsg) => {
    if (oldMsg.author?.bot || !oldMsg.content || oldMsg.content === newMsg.content) return;
    const log = getLogChannel(oldMsg.guild);
    if (!log) return;
    log.send({
      embeds: [{
        color: 0x1E88E5,
        title: "✏️ Mensagem Editada",
        description: `**Autor:** ${oldMsg.author.tag}\n**Canal:** ${oldMsg.channel}\n**Antes:** ${oldMsg.content.slice(0, 500)}\n**Depois:** ${newMsg.content.slice(0, 500)}`,
        timestamp: new Date(),
      }],
    }).catch(() => {});
  });
}
