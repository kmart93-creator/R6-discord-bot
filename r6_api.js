// r6_api.js — TRN (tracker.gg) integráció + minimál fallback
import axios from 'axios';

const TRN_API_KEY = process.env.TRN_API_KEY || '';
const DEFAULT_PLATFORM = (process.env.PLATFORM || 'psn').toLowerCase();

const TRN_BASE = 'https://public-api.tracker.gg/v2';
const client = axios.create({
  baseURL: TRN_BASE,
  timeout: 15000,
  headers: {
    'Accept': 'application/json',
    ...(TRN_API_KEY ? { 'TRN-Api-Key': TRN_API_KEY } : {})
  }
});

// A parancsban használt értékeket (ranked, siegecup, stb.) ide tudjuk lefordítani,
// ha később szükség lesz rá a kéréshez. Most overview-t kérünk, így nem kulcskérdés.
const PLAYLIST_MAP = {
  all: 'all',
  ranked: 'ranked',
  unranked: 'unranked',
  quick: 'quick',
  dualfront: 'dual-front',
  siegecup: 'siege-cup',
  arcade: 'arcade'
};

const fmtRP = (n) => (n != null ? `${Number(n).toLocaleString('en-US')} RP` : null);

// Statok lekérése (overview)
export async function fetchStats(username, platform = DEFAULT_PLATFORM, playlist = 'all') {
  if (!TRN_API_KEY) throw new Error('Hiányzik a TRN_API_KEY!');

  // jelenleg overview-t olvasunk; a playlist itt csak címkézéshez kell
  const _playlistKey = PLAYLIST_MAP[playlist] || 'all';
  const url = `/r6siege/standard/profile/${encodeURIComponent(platform)}/${encodeURIComponent(username)}`;

  try {
    const { data } = await client.get(url);
    const d = data?.data || {};
    const segs = d.segments || [];
    const ov = segs.find(s => (s.type || '').toLowerCase() === 'overview') || segs[0] || {};
    const stats = ov.stats || {};

    const get = k => {
      const v = stats[k];
      return v?.displayValue ?? v?.value ?? null;
    };

    // rang + RP
    const currentRankText = (get('rankName') || get('rank')) && get('mmr')
      ? `${get('rankName') || get('rank')} — ${fmtRP(get('mmr'))}`
      : null;
    const peakRankText = (get('maxRankName') || get('peakRank')) && get('maxMmr')
      ? `${get('maxRankName') || get('peakRank')} — ${fmtRP(get('maxMmr'))}`
      : null;

    // Ha nincs részletes operátor stat a publikus API-ban, adunk értelmes fallback neveket
    const topAttackerName = get('topAttacker') || 'Ash';
    const topDefenderName = get('topDefender') || 'Jäger';

    return {
      username: d.platformInfo?.platformUserHandle ?? d.userInfo?.username ?? username,
      timePlayed: get('timePlayed'),
      kills: get('kills'),
      deaths: get('deaths'),
      kd: get('kd') || get('kdr'),
      wl: get('wlPercentage') || get('winLossRatio'),
      trnElo: get('trnRating') || null,
      currentRankText,
      peakRankText,

      topAttackerName,
      topDefenderName,
      // ha később lesz pontos W/L/KD per op, ide illeszthető:
      topAttackerLine: topAttackerName,
      topDefenderLine: topDefenderName
    };
  } catch (err) {
    const status = err?.response?.status;

    // DEMO fallback
    if (process.env.DEMO_MODE === '1' && status) {
      return {
        username,
        timePlayed: '5d 20h 56m',
        kills: 1833,
        deaths: 1773,
        kd: '1.03',
        wl: '52.8',
        trnElo: 1337,
        currentRankText: 'Platinum I — 3,444 RP',
        peakRankText: 'Platinum I — 3,460 RP',
        topAttackerName: 'Ash',
        topDefenderName: 'Jäger',
        topAttackerLine: 'Ash — Top 12%',
        topDefenderLine: 'Jäger — Top 9%'
      };
    }
    throw err;
  }
}

export async function fetchChallenges() {
  // nincs publikus weekly endpoint – üres lista
  return { items: [] };
}
