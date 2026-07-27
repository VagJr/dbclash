import { AttachmentBuilder } from "discord.js";
import { readFileSync } from "fs";

export default {
  name: "guildMemberAdd",
  async execute(member) {
    const roleName = "🎮 Jogador";
    const role = member.guild.roles.cache.find((r) => r.name === roleName);
    if (role) {
      await member.roles.add(role).catch(() => {});
    }

    const channel = member.guild.channels.cache.find(
      (ch) => ch.name === "boas-vindas"
    );
    if (!channel) return;

    try {
      const imageBuffer = readFileSync("C:\\dbtcg\\imagens\\logo.png");
      const attachment = new AttachmentBuilder(imageBuffer, { name: "logo.png" });

      await channel.send({
        content: `🐉 Bem-vindo(a) ao **Torneio do Poder**, ${member}!`,
        files: [attachment],
      });
    } catch {
      await channel.send({
        embeds: [
          {
            color: 0xFFD700,
            title: "🐉 Bem-vindo ao Torneio do Poder!",
            description: `**${member.displayName}** acabou de entrar na arena!\n\nCarregue seu Ki, prepare seu baralho e desafie os maiores guerreiros!`,
            thumbnail: { url: member.user.displayAvatarURL() },
            footer: { text: "Dragon Ball Clash Action TCG" },
            timestamp: new Date(),
          },
        ],
      });
    }
  },
};
