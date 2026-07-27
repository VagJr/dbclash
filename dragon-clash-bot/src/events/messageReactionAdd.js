const ROLE_MAP = {
  "🔴": "🔴 Goku",
  "🟠": "🟠 Vegeta",
  "🟣": "🟣 Gohan",
  "⚪": "⚪ Frieza",
  "🟢": "🟢 Piccolo",
  "🔵": "🔵 Future Trunks",
};

export default {
  name: "messageReactionAdd",
  async execute(reaction, user) {
    if (user.bot) return;

    const channel = reaction.message.channel;
    if (channel.name !== "cargos") return;

    const emoji = reaction.emoji.name;
    const roleName = ROLE_MAP[emoji];
    if (!roleName) return;

    const member = await reaction.message.guild.members.fetch(user.id);
    const role = reaction.message.guild.roles.cache.find(
      (r) => r.name === roleName
    );
    if (!role) return;

    try {
      await member.roles.add(role);
    } catch (err) {
      console.error(`Erro ao adicionar cargo para ${user.tag}:`, err);
    }
  },
};
