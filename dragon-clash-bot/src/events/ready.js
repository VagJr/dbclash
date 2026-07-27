import { ActivityType } from "discord.js";
import { registerLogs } from "../utils/logs.js";

export default {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(`✅ Bot logado como ${client.user.tag}`);

    registerLogs(client);

    client.user.setPresence({
      activities: [
        {
          name: "Dragon Ball Clash Action TCG",
          type: ActivityType.Playing,
        },
      ],
      status: "idle",
    });

    const guildId = process.env.GUILD_ID;
    if (!guildId) {
      console.warn("⚠️  GUILD_ID não definida no .env");
      return;
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.warn(`⚠️  Guild ${guildId} não encontrada`);
      return;
    }

    const commands = [];
    const commandFiles = client.commands;

    for (const [, cmd] of commandFiles) {
      if (cmd.data) commands.push(cmd.data.toJSON());
    }

    try {
      await guild.commands.set(commands);
      console.log(`✅ ${commands.length} comandos registrados em ${guild.name}`);
    } catch (err) {
      console.error("❌ Erro ao registrar comandos:", err);
    }
  },
};
