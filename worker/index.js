const TIME_ZONE = "America/Sao_Paulo";
const NBA_SCHEDULE_URLS = [
  "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json",
  "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json"
];

const TEAM_COLORS = {
  ATL: "#E03A3E", BOS: "#007A33", BKN: "#000000", CHA: "#1D1160", CHI: "#CE1141",
  CLE: "#860038", DAL: "#00538C", DEN: "#0E2240", DET: "#C8102E", GSW: "#1D428A",
  HOU: "#CE1141", IND: "#002D62", LAC: "#C8102E", LAL: "#552583", MEM: "#5D76A9",
  MIA: "#98002E", MIL: "#00471B", MIN: "#0C2340", NOP: "#0C2340", NYK: "#006BB6",
  OKC: "#007AC1", ORL: "#0077C0", PHI: "#006BB6", PHX: "#1D1160", POR: "#E03A3E",
  SAC: "#5A2D81", SAS: "#C4CED4", TOR: "#CE1141", UTA: "#002B5C", WAS: "#002B5C"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300",
      "access-control-allow-origin": "*"
    }
  });
}

function localDateKey(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: TIME_ZONE
  }).formatToParts(new Date(date));
  const bag = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${bag.year}-${bag.month}-${bag.day}`;
}

function roundDateKey(date = new Date(), rolloverHour = 6) {
  const shifted = new Date(new Date(date).getTime() - rolloverHour * 3600000);
  return localDateKey(shifted);
}

function gameStartIso(game) {
  const candidates = [game.gameDateTimeUTC, game.gameDateTimeEst, game.gameDate];
  for (const value of candidates) {
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function gameState(game) {
  const status = Number(game.gameStatus);
  if (status === 3) return "final";
  if (status === 2) return "live";
  return "scheduled";
}

function mapTeam(team) {
  const code = team?.teamTricode || team?.teamCode || "---";
  const nbaId = team?.teamId ? String(team.teamId) : null;
  return {
    code,
    name: team?.teamName || code,
    city: team?.teamCity || "",
    color: TEAM_COLORS[code] || "#667085",
    nba_id: nbaId,
    logo_url: nbaId ? `https://cdn.nba.com/logos/nba/${nbaId}/primary/L/logo.svg` : null,
    score: team?.score ?? null
  };
}

async function fetchSchedule() {
  let lastError;
  for (const scheduleUrl of NBA_SCHEDULE_URLS) {
    try {
      const response = await fetch(scheduleUrl, {
        headers: {
          "accept": "application/json,text/plain,*/*",
          "user-agent": "Mozilla/5.0",
          "referer": "https://www.nba.com/"
        },
        cf: { cacheTtl: 300, cacheEverything: true }
      });
      if (!response.ok) throw new Error(`NBA CDN ${response.status}`);
      const data = await response.json();
      if (data?.leagueSchedule?.gameDates) return data;
      throw new Error("Formato do calendário NBA não reconhecido");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Não foi possível consultar o calendário NBA");
}

function scheduleDateKey(value) {
  if (!value) return null;
  const text = String(value);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${String(us[1]).padStart(2, "0")}-${String(us[2]).padStart(2, "0")}`;
  return null;
}

async function gamesForDate(dateKey) {
  const payload = await fetchSchedule();
  const dateBlock = payload.leagueSchedule.gameDates.find(day => scheduleDateKey(day.gameDate) === dateKey);
  const rawGames = dateBlock?.games || [];

  return rawGames
    .map(game => ({ game, start_at: gameStartIso(game) }))
    .filter(item => item.start_at)
    .map(({ game, start_at }) => ({
      id: String(game.gameId),
      round_date: dateKey,
      start_at,
      status: gameState(game),
      status_text: game.gameStatusText || "",
      away: mapTeam(game.awayTeam),
      home: mapTeam(game.homeTeam)
    }))
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return json({ ok: true });
    if (url.pathname === "/health") return json({ ok: true, service: "bolao-nba" });

    if (url.pathname === "/api/nba/games") {
      const requestedDate = url.searchParams.get("date") || roundDateKey(new Date());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
        return json({ error: "date deve estar em YYYY-MM-DD" }, 400);
      }

      try {
        const games = await gamesForDate(requestedDate);
        return json({ date: requestedDate, time_zone: TIME_ZONE, source: "NBA", games });
      } catch (error) {
        return json({ error: "Falha ao consultar o calendário da NBA", detail: String(error?.message || error) }, 502);
      }
    }

    return json({ error: "Rota não encontrada" }, 404);
  }
};
