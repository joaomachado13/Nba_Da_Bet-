import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const TIME_ZONE = "America/Sao_Paulo";
const ROLLOVER_HOUR = 6;
const SCHEDULE_URLS = [
  "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json",
  "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json"
];
const SCOREBOARD_URL = "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SECRET_KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const ADMIN_KEY = SECRET_KEYS.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, ADMIN_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function localDateKey(date: Date) {
  const p = localParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function roundDateKey(value: string | Date) {
  const date = new Date(value);
  const shifted = new Date(date.getTime() - ROLLOVER_HOUR * 3600000);
  return localDateKey(shifted);
}

function dateOffsetKey(base: Date, days: number) {
  const shifted = new Date(base.getTime() + days * 86400000);
  return roundDateKey(shifted);
}

function startIso(game: any) {
  for (const value of [game?.gameDateTimeUTC, game?.gameDateTimeEst, game?.gameDate, game?.gameTimeUTC]) {
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function statusOf(game: any) {
  const text = String(game?.gameStatusText || "").toLowerCase();
  if (text.includes("postpon")) return "postponed";
  if (text.includes("cancel")) return "cancelled";
  const status = Number(game?.gameStatus);
  if (status === 3) return "final";
  if (status === 2) return "live";
  return "scheduled";
}

function recordOf(team: any) {
  if (team?.wins !== undefined && team?.losses !== undefined) {
    return `${team.wins}-${team.losses}`;
  }
  return null;
}

function scoreOf(team: any, status: string) {
  if (status === "scheduled") return null;
  const n = Number(team?.score);
  return Number.isFinite(n) ? n : null;
}

function arenaOf(game: any) {
  return game?.arenaName || game?.arena?.arenaName || null;
}

function broadcastOf(game: any) {
  const national = game?.broadcasters?.nationalTvBroadcasters;
  if (Array.isArray(national) && national.length) {
    return national.map((b: any) => b?.broadcasterDisplay || b?.broadcasterAbbreviation).filter(Boolean).join(", ") || null;
  }
  return null;
}

function normalizeGame(game: any) {
  const start_at = startIso(game);
  if (!start_at || !game?.gameId || !game?.awayTeam || !game?.homeTeam) return null;

  const status = statusOf(game);
  return {
    id: String(game.gameId),
    round_date: roundDateKey(start_at),
    start_at,
    status,
    away_team_code: game.awayTeam.teamTricode || game.awayTeam.teamCode || "---",
    away_team_name: game.awayTeam.teamName || game.awayTeam.teamTricode || "Visitante",
    away_record: recordOf(game.awayTeam),
    home_team_code: game.homeTeam.teamTricode || game.homeTeam.teamCode || "---",
    home_team_name: game.homeTeam.teamName || game.homeTeam.teamTricode || "Mandante",
    home_record: recordOf(game.homeTeam),
    away_score: scoreOf(game.awayTeam, status),
    home_score: scoreOf(game.homeTeam, status),
    arena: arenaOf(game),
    broadcast: broadcastOf(game),
    external_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      "accept": "application/json,text/plain,*/*",
      "user-agent": "Mozilla/5.0 (compatible; BolaoNBA/1.0)",
      "referer": "https://www.nba.com/",
      "origin": "https://www.nba.com"
    },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return await response.json();
}

async function fetchSchedule() {
  let lastError: unknown = null;
  for (const url of SCHEDULE_URLS) {
    try {
      const payload = await fetchJson(url);
      if (Array.isArray(payload?.leagueSchedule?.gameDates)) return payload;
      throw new Error("Formato de calendário NBA não reconhecido");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Calendário NBA indisponível");
}

async function scheduleRows() {
  const payload = await fetchSchedule();
  const rows: any[] = [];
  for (const day of payload.leagueSchedule.gameDates || []) {
    for (const game of day?.games || []) {
      const normalized = normalizeGame(game);
      if (normalized) rows.push(normalized);
    }
  }
  return rows;
}

async function scoreboardRows() {
  const payload = await fetchJson(SCOREBOARD_URL);
  const games = payload?.scoreboard?.games || payload?.games || [];
  return games.map(normalizeGame).filter(Boolean);
}

async function mergeExisting(rows: any[]) {
  if (!rows.length) return rows;
  const ids = rows.map(row => row.id);
  const { data: existing, error } = await admin
    .from("games")
    .select("id,status,away_record,home_record,away_form,home_form,away_score,home_score,arena,broadcast")
    .in("id", ids);

  if (error) throw error;
  const byId = new Map((existing || []).map((row: any) => [String(row.id), row]));

  return rows.map(row => {
    const old: any = byId.get(String(row.id)) || {};
    const status = old.status === "final" && row.status === "scheduled" ? "final" : row.status;
    return {
      ...row,
      status,
      away_record: row.away_record || old.away_record || "0-0",
      home_record: row.home_record || old.home_record || "0-0",
      away_form: old.away_form || [],
      home_form: old.home_form || [],
      away_score: row.away_score ?? old.away_score ?? null,
      home_score: row.home_score ?? old.home_score ?? null,
      arena: row.arena || old.arena || null,
      broadcast: row.broadcast || old.broadcast || null
    };
  });
}

async function upsertRows(rows: any[]) {
  if (!rows.length) return 0;
  const merged = await mergeExisting(rows);
  const { error } = await admin.from("games").upsert(merged, { onConflict: "id" });
  if (error) throw error;
  return merged.length;
}

async function sync(mode: "fast" | "full") {
  const now = new Date();
  const currentRound = roundDateKey(now);
  let source = "";
  let rows: any[] = [];

  if (mode === "full") {
    const all = await scheduleRows();
    const minKey = dateOffsetKey(now, -1);
    const maxKey = dateOffsetKey(now, 10);
    rows = all.filter(row => row.round_date >= minKey && row.round_date <= maxKey);
    source = "nba-schedule";
    console.log("NBA full sync window", {
      all: all.length,
      selected: rows.length,
      minKey,
      maxKey,
      first: rows[0]?.round_date || null,
      last: rows.at(-1)?.round_date || null
    });
  } else {
    try {
      rows = await scoreboardRows();
      source = "nba-scoreboard";
    } catch (scoreError) {
      console.warn("Scoreboard indisponível; usando calendário:", scoreError);
      const all = await scheduleRows();
      rows = all.filter(row => row.round_date === currentRound);
      source = "nba-schedule-fallback";
    }

    const localHour = Number(localParts(now).hour || 12);
    if (localHour < 6) {
      try {
        const all = await scheduleRows();
        const carry = all.filter(row => row.round_date === currentRound);
        const map = new Map(rows.map(row => [row.id, row]));
        for (const row of carry) map.set(row.id, { ...(map.get(row.id) || {}), ...row });
        rows = [...map.values()];
        source += "+carry";
      } catch (error) {
        console.warn("Falha ao buscar carry-over do calendário:", error);
      }
    }
  }

  const roundDates = rows.map(row => row.round_date).sort();
  return {
    count: await upsertRows(rows),
    source,
    first_round: roundDates[0] || null,
    last_round: roundDates.at(-1) || null
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });

  let mode: "fast" | "full" = "fast";
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.mode === "full") mode = "full";
  } catch {}

  const minIntervalMs = mode === "fast" ? 120000 : 3600000;
  const { data: lastRun } = await admin
    .from("nba_sync_runs")
    .select("finished_at,status")
    .eq("mode", mode)
    .eq("status", "success")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastRun?.finished_at && (Date.now() - new Date(lastRun.finished_at).getTime()) < minIntervalMs) {
    return Response.json({ ok: true, mode, skipped: true, reason: "recent-sync" }, { status: 202 });
  }

  const { data: run, error: runError } = await admin
    .from("nba_sync_runs")
    .insert({ mode, status: "running" })
    .select("id")
    .single();

  if (runError) {
    console.error("Não foi possível registrar sync:", runError);
  }

  try {
    const result = await sync(mode);

    if (run?.id) {
      await admin.from("nba_sync_runs").update({
        finished_at: new Date().toISOString(),
        status: "success",
        games_upserted: result.count,
        source: result.source
      }).eq("id", run.id);
    }

    return Response.json({ ok: true, mode, ...result, at: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("NBA sync failed:", error);

    if (run?.id) {
      await admin.from("nba_sync_runs").update({
        finished_at: new Date().toISOString(),
        status: "error",
        error_message: message
      }).eq("id", run.id);
    }

    return Response.json({ ok: false, mode, error: message }, { status: 500 });
  }
});
