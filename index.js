// index.js — r6TrackerBot (összefoglaló + top op képpel + playlist választó)

import 'dotenv/config';
import fs from 'fs';
import {
  Client, GatewayIntentBits, Partials, REST, Routes,
  SlashCommandBuilder, EmbedBuilder
} from 'discord.js';
import { fetchStats, fetchChallenges } from './r6_api.js';
import { getOperatorImage } from './operator_images.js';

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error('Hiányzik a DISCORD_TOKEN (.env vagy Render/Railway env)!');

// users.json / user.json beolvasás (bármelyik jó)
let users = {};
try {
  const file = fs.existsSync('./users.json')
    ? './users.json'
    : (fs.existsSync('./user.json') ? './user.json' : null);
  if (file) users = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch { users = {}; }

// ---- Slash commandok ----
const commands = [
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('R6 statok lekérése (PSN / XBOX / PC).')
    .addStringOption(o =>
      o.setName('name')
        .setDescription('Felhasználónév (PSN / XBL / Uplay)')
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName('platform')
        .setDescription('Platform')
        .addChoices(
          { name: 'PlayStation', value: 'psn' },
          { name: 'Xbox', value: 'xbl' },
          { name: 'PC (Uplay)', value: 'uplay' }
        )
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName('playlist')
        .setDescription('Játékmód / lejátszási lista')
        .addChoices(
          { name: 'All Playlists', value: 'all' },
          { name: 'Ranked', value: 'ranked' },
          { name: 'Unranked', value: 'unranked' },
          { name: 'Quick Match', value: 'quick' },
          { name: 'Dual Front', value: 'dualfront' },
          { name: 'Siege Cup', value: 'siegecup' },
          { name: 'Arcade', value: 'arcade' }
        )
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('challenges')
    .setDescription('Aktuális heti R6 kihívások megjelenítése.')
].map(c => c.toJSON());

// ---- Slash regisztráció ----
async function registerCommands(clientId) {
  const rest = new REST({ version: '10' }).setToken(token);
  const guildId = process.env.GUILD_ID;
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('✔ Slash parancsok (guild) regisztrálva.');
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('✔ Slash parancsok (globális) regisztrálva.');
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

client.once('ready', async () => {
  console.log(`Bejelentkezve mint ${client.user.tag}`);
  try { await registerCommands(client.user.id); } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ----- /stats -----
  if (interaction.commandName === 'stats') {
    const nameParam = interaction.options.getString('name');
    const platformParam = interaction.options.getString('platform');   // psn|xbl|uplay
    const playlistParam = interaction.options.getString('playlist');   // all|ranked|unranked|quick|dualfront|siegecup|arcade

    const mapped = users[interaction.user.id]?.[0];
    const usernameInput = nameParam || mapped;
    const platform = (platformParam || process.env.PLATFORM || 'psn').toLowerCase();
    const playlist = (playlistParam || 'all').toLowerCase();

    if (!usernameInput) {
      return interaction.reply({
        content: 'Nem találtam nevet. Add meg: `/stats name:<felhasználónév>` vagy add hozzá a `users.json`/`user.json`-hoz.',
        ephemeral: true
      });
    }

    const prettyTitle = ({
      all: 'All Playlists',
      ranked: 'Ranked',
      unranked: 'Unranked',
      quick: 'Quick Match',
      dualfront: 'Dual Front',
      siegecup: 'Siege Cup',
      arcade: 'Arcade'
    })[playlist] || 'All Playlists';

    await interaction.deferReply();
    try {
      const data = await fetchStats(usernameInput, platform, playlist);

      const embed = new EmbedBuilder()
        .setColor(0xf0b232)
        .setAuthor({ name: 'SiegeBot' })
        .setTitle(`R6 — ${data.username || usernameInput} (${platform.toUpperCase()} • ${prettyTitle})`)
        .setDescription('Összefoglaló statok + top operátorok (attacker/defender).')
        .addFields(
          { name: 'Username', value: String(data.username ?? usernameInput), inline: true },
          { name: 'Time Played', value: String(data.timePlayed ?? 'N/A'), inline: true },
          { name: '\u200B', value: '\u200B', inline: true },

          { name: 'Kills', value: String(data.kills ?? 'N/A'), inline: true },
          { name: 'Deaths', value: String(data.deaths ?? 'N/A'), inline: true },
          { name: 'K/D Ratio', value: String(data.kd ?? 'N/A'), inline: true },

          ...(Number(data.trnElo) ? [{ name: 'TRN Elo', value: String(data.trnElo), inline: true }] : []),
          { name: 'W/L %', value: String(data.wl ?? 'N/A'), inline: true },
          { name: '\u200B', value: '\u200B', inline: true },

          { name: 'Current Rank', value: data.currentRankText ?? 'N/A', inline: true },
          { name: 'Peak Rank', value: data.peakRankText ?? 'N/A', inline: true }
        )
        .setFooter({ text: 'r6TrackerBot' });

      // Top operátorok + képek a saját GitHub CDN-ről (operator_images.js)
      const atkName = data.topAttackerName;
      const defName = data.topDefenderName;

      if (atkName) {
        const img = getOperatorImage(atkName);
        embed.addFields({
          name: 'Top Operator (Attacker)',
          value: data.topAttackerLine || atkName,
          inline: false,
        });
        if (img?.iconUrl) embed.setThumbnail(img.iconUrl);
      }

      if (defName) {
        const img = getOperatorImage(defName);
        embed.addFields({
          name: 'Top Operator (Defender)',
          value: data.topDefenderLine || defName,
          inline: false,
        });
        if (img?.figureUrl) embed.setImage(img.figureUrl);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err?.response?.data || err);
      await interaction.editReply('❌ API hiba: ellenőrizd a TRN_API_KEY-t, a felhasználónevet, a platformot **és a playlistet**.');
    }
  }

  // ----- /challenges -----
  if (interaction.commandName === 'challenges') {
    await interaction.deferReply();
    try {
      const data = await fetchChallenges();
      const items = Array.isArray(data.items) ? data.items : [];

      const embed = new EmbedBuilder()
        .setColor(0xf0b232)
        .setTitle('This Week’s Challenges')
        .setDescription(
          items.length
            ? items.map(i => `**${i.title || 'Cím nélkül'}**\n${i.description || ''}`).join('\n\n')
            : 'Most nem találtam heti kihívásokat.'
        )
        .setFooter({ text: 'r6TrackerBot' });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err?.response?.data || err);
      await interaction.editReply('❌ Nem sikerült lekérni a kihívásokat.');
    }
  }
});

client.login(token);
