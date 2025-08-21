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

// ---- Slash parancsok ----
const commands = [
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('R6 statok lekérése (PSN / XBOX / PC).')
    .addStringOption(o =>
      o.setName('name').setDescription('Felhasználónév (PSN / XBL / Uplay)').setRequired(false)
    )
    .addStringOption(o =>
      o.setName('platform').setDescription('Platform').addChoices(
        { name: 'PlayStation', value: 'psn' },
        { name: 'Xbox', value: 'xbl' },
        { name: 'PC (Uplay)', value: 'uplay' }
      ).setRequired(false)
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

      // Top operátor képek + sorok
      if (data.topAttackerName) {
        const icon = getOperatorImage(data.topAttackerName);
        if (icon) embed.setThumbnail(icon);
        embed.addFields({
          name: 'Top Operator (Attacker)',
          value: data.topAttackerLine || data.topAttackerName,
          inline: false
        });
      }
      if (data.topDefenderName) {
        const fig = getOperatorImage(data.topDefenderName);
        if (fig) embed.setImage(fig);
        embed.addFields({
          name: 'Top Operator (Defender)',
          value: data.topDefenderLine || data.topDefenderName,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err?.response?.data || err);
      await interaction.editReply('❌ API hiba: ellenőrizd a TRN_API_KEY-et, a nevet és a platformot.');
    }
  }

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
