// index.js — r6TrackerBot (összefoglaló + top op képpel)
import 'dotenv/config';
import fs from 'fs';
import {
  Client, GatewayIntentBits, Partials, REST, Routes,
  SlashCommandBuilder, EmbedBuilder
} from 'discord.js';
import { fetchStats, fetchChallenges } from './r6_api.js';
import { getOperatorImage } from './operator_images.js';

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error('Hiányzik a DISCORD_TOKEN (.env vagy Railway env)!');

const users = fs.existsSync('./users.json')
  ? JSON.parse(fs.readFileSync('./users.json', 'utf8'))
  : {};

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
        .setRequired(true) // kérted, hogy kötelező legyen választani
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

  if (interaction.commandName === 'stats') {
    const nameParam = interaction.options.getString('name');
    const platformParam = interaction.options.getString('platform');

    const mapped = users[interaction.user.id]?.[0];
    const username = nameParam || mapped;
    const platform = (platformParam || process.env.PLATFORM || 'psn').toLowerCase();

    if (!username) {
      return interaction.reply({ content: 'Adj meg egy nevet: `/stats name:<felhasználónév>`', ephemeral: true });
    }

    await interaction.deferReply();
    try {
      const data = await fetchStats(username, platform); // lásd r6_api.js

      const embed = new EmbedBuilder()
        .setColor(0xf0b232)
        .setAuthor({ name: 'SiegeBot' })
        .setTitle(`R6 — ${data.username || username} (${platform.toUpperCase()} • Player overview)`)
        .setDescription('Összefoglaló statok + top operátorok (attacker/defender).')
        .addFields(
          { name: 'Username', value: String(data.username ?? username), inline: true },
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
      content: 'Nem találtam nevet. Add meg: `/stats name:<felhasználónév>` vagy add hozzá a `users.json`-hoz.',
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

        {
          name: 'Current Rank',
          value:
            (data.currentRankName && data.currentRP != null)
              ? `${data.currentRankName} — ${Number(data.currentRP).toLocaleString('en-US')} RP`
              : (data.currentRankName || 'N/A'),
          inline: true,
        },
        {
          name: 'Peak Rank',
          value:
            (data.peakRankName && data.peakRP != null)
              ? `${data.peakRankName} — ${Number(data.peakRP).toLocaleString('en-US')} RP`
              : (data.peakRankName || 'N/A'),
          inline: true,
        },
        { name: '\u200B', value: '\u200B', inline: true },
      )
      .setFooter({ text: 'r6TrackerBot' });

    // top operátorok (ahogy eddig)
    const atk = data.topAttacker;
    const def = data.topDefender;
    if (atk) {
      embed.addFields({
        name: 'Top Operator (Attacker)',
        value: `${atk.name} — W: ${atk.wins} / L: ${atk.losses} — K/D: ${atk.kd}` + (atk.topPercent != null ? ` — Top ${atk.topPercent}%` : ''),
        inline: false,
      });
      if (atk.iconUrl) embed.setThumbnail(atk.iconUrl);
    }
    if (def) {
      embed.addFields({
        name: 'Top Operator (Defender)',
        value: `${def.name} — W: ${def.wins} / L: ${def.losses} — K/D: ${def.kd}` + (def.topPercent != null ? ` — Top ${def.topPercent}%` : ''),
        inline: false,
      });
      if (def.figureUrl) embed.setImage(def.figureUrl);
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error(err?.response?.data || err);
    await interaction.editReply('❌ API hiba: ellenőrizd a TRN_API_KEY-et, a felhasználónevet, a platformot **és a playlistet**.');
  }
}
