import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} from "@discordjs/voice";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const queues = new Map();

function getQueue(guildId) {
  if (!queues.has(guildId)) queues.set(guildId, { player: createAudioPlayer(), songs: [], connection: null });
  return queues.get(guildId);
}

export default {
  data: new SlashCommandBuilder()
    .setName("musica")
    .setDescription("Comandos de música")
    .addSubcommand((sub) =>
      sub
        .setName("tocar")
        .setDescription("Toca uma música do YouTube")
        .addStringOption((opt) =>
          opt.setName("musica").setDescription("Nome ou URL da música").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("pular").setDescription("Pula para a próxima música")
    )
    .addSubcommand((sub) =>
      sub.setName("parar").setDescription("Para a música e sai do canal")
    )
    .addSubcommand((sub) =>
      sub.setName("fila").setDescription("Mostra a fila de músicas")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { guild, member } = interaction;
    const voiceChannel = member.voice.channel;

    if (sub === "tocar") {
      if (!voiceChannel) {
        return interaction.reply({ content: "❌ Você precisa estar em um canal de voz!", ephemeral: true });
      }

      await interaction.deferReply();

      const query = interaction.options.getString("musica");
      const queue = getQueue(guild.id);

      try {
        const { play } = await import("play-dl");
        const searchResult = await play(query, { limit: 1 }).catch(() => null);

        if (!searchResult || searchResult.length === 0) {
          return interaction.editReply({ content: "❌ Música não encontrada." });
        }

        const song = searchResult[0];
        queue.songs.push({
          title: song.title || query,
          url: song.url || query,
          duration: song.durationRaw || "?",
          requestedBy: interaction.user.tag,
        });

        if (queue.songs.length === 1) {
          if (!queue.connection) {
            queue.connection = joinVoiceChannel({
              channelId: voiceChannel.id,
              guildId: guild.id,
              adapterCreator: guild.voiceAdapterCreator,
            });

            queue.connection.on(VoiceConnectionStatus.Disconnected, async () => {
              try {
                await entersState(queue.connection, VoiceConnectionStatus.Connecting, 5000);
              } catch {
                queue.connection.destroy();
                queues.delete(guild.id);
              }
            });
          }

          playSong(guild.id, queue);
        }

        await interaction.editReply({
          embeds: [{
            color: 0x1DB954,
            title: "🎵 Adicionado à Fila",
            description: `**${song.title}**\n\nDuração: ${song.duration || "?"}\nSolicitado por: ${interaction.user}`,
            footer: { text: `Posição: ${queue.songs.length}` },
          }],
        });
      } catch (err) {
        console.error(err);
        await interaction.editReply({ content: "❌ Erro ao tocar música. Certifique-se de que o YouTube está acessível." });
      }
    }

    if (sub === "pular") {
      const queue = getQueue(guild.id);
      if (!queue.player || !queue.songs.length) {
        return interaction.reply({ content: "❌ Nenhuma música tocando.", ephemeral: true });
      }
      queue.player.stop();
      await interaction.reply({ content: "⏭️ Música pulada!" });
    }

    if (sub === "parar") {
      const queue = getQueue(guild.id);
      if (queue.connection) {
        queue.player.stop();
        queue.songs = [];
        queue.connection.destroy();
        queues.delete(guild.id);
      }
      await interaction.reply({ content: "⏹️ Música parada e bot saiu do canal." });
    }

    if (sub === "fila") {
      const queue = getQueue(guild.id);
      if (!queue.songs.length) {
        return interaction.reply({ content: "📭 Fila vazia.", ephemeral: true });
      }

      const lines = queue.songs.map((s, i) =>
        `${i === 0 ? "▶️" : `${i + 1}.`} **${s.title}** — ${s.duration} (${s.requestedBy})`
      );

      await interaction.reply({
        embeds: [{
          color: 0x1DB954,
          title: "📋 Fila de Músicas",
          description: lines.slice(0, 15).join("\n") || "Nenhuma",
          footer: { text: `${queue.songs.length} música(s) na fila` },
        }],
      });
    }
  },
};

async function playSong(guildId, queue) {
  if (!queue.songs.length) {
    if (queue.connection) {
      queue.connection.destroy();
      queues.delete(guildId);
    }
    return;
  }

  const song = queue.songs[0];

  try {
    const { stream } = await import("play-dl");
    const audioStream = await stream(song.url, { quality: 2 });

    const resource = createAudioResource(audioStream.stream, {
      inputType: audioStream.type,
    });

    queue.player.play(resource);
    queue.connection.subscribe(queue.player);

    queue.player.once(AudioPlayerStatus.Idle, () => {
      queue.songs.shift();
      playSong(guildId, queue);
    });

    queue.player.once("error", () => {
      queue.songs.shift();
      playSong(guildId, queue);
    });
  } catch {
    queue.songs.shift();
    playSong(guildId, queue);
  }
}
