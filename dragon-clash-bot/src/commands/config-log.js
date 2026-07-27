import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "..", "..", "data", "log-config.json");

if (!existsSync(join(__dirname, "..", "..", "data"))) mkdirSync(join(__dirname, "..", "..", "data"), { recursive: true });
if (!existsSync(CONFIG_PATH)) writeFileSync(CONFIG_PATH, "{}");

export default {
  data: new SlashCommandBuilder()
    .setName("config-log")
    .setDescription("Define o canal de logs do servidor")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt
        .setName("canal")
        .setDescription("Canal onde os logs serão enviados")
        .setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel("canal");

    const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    config[interaction.guild.id] = channel.id;
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

    await interaction.reply({
      content: `✅ Logs configurados em ${channel}`,
      ephemeral: true,
    });
  },
};
