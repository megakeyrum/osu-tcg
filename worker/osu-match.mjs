// Fetches a stable-style osu! multiplayer match (mp link) and normalizes its games and scores.
// Uses the osu! API v2 client-credentials flow with the existing OSU_CLIENT_ID / OSU_CLIENT_SECRET.

const API = 'https://osu.ppy.sh/api/v2';
const TOKEN_URL = 'https://osu.ppy.sh/oauth/token';
const MAX_PAGES = 20;

export class MatchError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

let cached = null;
async function appToken(env) {
  if (cached && cached.exp > Date.now() + 60000) return cached.value;
  if (!env.OSU_CLIENT_ID || !env.OSU_CLIENT_SECRET) throw new MatchError('osu! API credentials are not configured.', 503);
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: Number(env.OSU_CLIENT_ID), client_secret: env.OSU_CLIENT_SECRET, grant_type: 'client_credentials', scope: 'public' })
  });
  if (!r.ok) throw new MatchError('Could not authenticate with the osu! API.', 502);
  const d = await r.json();
  cached = { value: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 };
  return cached.value;
}

// Accepts "12345678", "mp_12345678", or "https://osu.ppy.sh/community/matches/12345678".
export function parseMatchId(input) {
  const m = String(input ?? '').trim().match(/(\d{3,})\/?$/);
  return m ? m[1] : null;
}

async function getPage(env, id, params) {
  const q = new URLSearchParams({ limit: '100', ...params });
  const r = await fetch(`${API}/matches/${id}?${q}`, { headers: { Authorization: `Bearer ${await appToken(env)}`, Accept: 'application/json' } });
  if (r.status === 404) throw new MatchError('Match not found. Check the mp link.', 404);
  if (!r.ok) throw new MatchError('The osu! API request failed. Try again shortly.', 502);
  return r.json();
}

// Collects every event of the match (the API pages by event id).
export async function fetchMatch(env, id) {
  let data = await getPage(env, id, {});
  const events = new Map();
  const users = new Map();
  const absorb = d => {
    for (const e of d.events || []) events.set(e.id, e);
    for (const u of d.users || []) users.set(u.id, u.username);
  };
  absorb(data);
  const name = data.match?.name ?? '';
  for (let i = 0; i < MAX_PAGES; i++) {
    const ids = [...events.keys()];
    if (!ids.length || data.first_event_id == null || Math.min(...ids) <= data.first_event_id) break;
    const before = Math.min(...ids);
    data = await getPage(env, id, { before: String(before) });
    const sizeBefore = events.size;
    absorb(data);
    if (events.size === sizeBefore) break;
  }
  return { name, events: [...events.values()], users };
}

const ratio = a => (a == null ? null : a > 1 ? a / 100 : a); // accept 0-1 or 0-100

// Turns raw events into finished games with normalized scores.
// opts.warmups: first N finished games are marked as warmups. opts.exclude: game ids to skip entirely.
export function normalizeGames(events, users, players = [], opts = {}) {
  const warmups = Math.max(0, Number(opts.warmups) || 0);
  const exclude = new Set((opts.exclude || []).map(String));
  const byOsuId = new Map(players.map(p => [String(p.id), p]));
  const finished = events
    .filter(e => e.game && e.game.end_time && Array.isArray(e.game.scores) && e.game.scores.length)
    .filter(e => !exclude.has(String(e.game.id)))
    .sort((a, b) => a.game.id - b.game.id);
  return finished.map((e, i) => {
    const g = e.game;
    return {
      gameId: g.id,
      order: i + 1,
      warmup: i < warmups,
      beatmapId: g.beatmap?.id ?? g.beatmap_id ?? null,
      beatmap: g.beatmap?.beatmapset?.title ? `${g.beatmap.beatmapset.title} [${g.beatmap.version ?? ''}]` : null,
      endedAt: g.end_time,
      scores: g.scores.map(s => {
        const p = byOsuId.get(String(s.user_id));
        return {
          osuId: s.user_id,
          osuName: users.get(s.user_id) ?? null,
          playerId: p ? p.id : null,
          playerName: p ? p.name ?? p.username ?? null : null,
          score: s.score ?? 0,
          accuracy: ratio(s.accuracy),
          passed: s.passed ?? s.match?.pass ?? null,
          mods: s.mods ?? []
        };
      })
    };
  });
}

// Used by the /api/match route. Returns games ready for a referee to review.
export async function loadMatch(env, params, players) {
  const id = parseMatchId(params.get('id'));
  if (!id) throw new MatchError('Enter a match link or ID.');
  const warmups = Number(params.get('warmups') ?? 0);
  if (!Number.isInteger(warmups) || warmups < 0 || warmups > 20) throw new MatchError('Warmups must be a whole number from 0 to 20.');
  const exclude = (params.get('exclude') || '').split(',').map(s => s.trim()).filter(Boolean);
  const { name, events, users } = await fetchMatch(env, id);
  const games = normalizeGames(events, users, players, { warmups, exclude });
  return { matchId: id, name, games };
}
