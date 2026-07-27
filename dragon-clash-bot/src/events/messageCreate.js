import { addXp } from "../utils/levels.js";

const IGNORED_CHANNELS = ["cargos", "regras", "boas-vindas"];

export default {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;
    if (IGNORED_CHANNELS.includes(message.channel.name)) return;

    const newLevel = addXp(message.author.id);
    if (newLevel) {
      try {
        await message.channel.send({
          embeds: [
            {
              color: 0xFFD700,
              description: `🌟 **${message.author.displayName}** subiu para o nível **${newLevel}**!`,
            },
          ],
        });
      } catch {}
    }
  },
};
