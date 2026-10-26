(async function () {
  const supabase = window.APP_SUPABASE;
  const gamesHost = document.getElementById("historyGames");
  const dateStrip = document.getElementById("historyDateStrip");
  const olderButton = document.getElementById("olderRoundButton");
  const newerButton = document.getElementById("newerRoundButton");
  const dateTitle = document.getElementById("historyDateTitle");
  const dateMeta = document.getElementById("historyDateMeta");
  const gamesCount = document.getElementById("historyGamesCount");
  const picksCount = document.getElementById("historyPicksCount");
  const playersCount = document.getElementById("historyPlayersCount");
  const toast = document.getElementById("toast");

  let currentUser = null;
  let profilesById = {};
  let rounds = [];
  let selectedIndex = 0;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function formatLongDate(key) {
    const date = new Date(`${key}T12:00:00Z`);
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long"
    }).format(date);
  }

  function formatShortDate(key) {
    const date = new Date(`${key}T12:00:00Z`);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit"
    }).format(date);
  }

  function formatGameTime(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: window.APP_CONFIG?.TIME_ZONE || "America/Sao_Paulo"
    }).format(new Date(value));
  }

  function roundIsLocked(games) {
    const starts = games
      .map(game => new Date(game.start_at).getTime())
      .filter(Number.isFinite);
    return starts.length > 0 && Date.now() >= Math.min(...starts);
  }

  function teamInfo(code, fallbackName) {
    const cfg = window.NBA_TEAMS?.get?.(code) || {};
    return {
      code: String(code || ""),
      name: fallbackName || cfg.name || code || "Time",
      logo: window.NBA_TEAMS?.logoUrl?.(code) || ""
    };
  }

  function finalScore(game) {
    const final = String(game.status || "").toLowerCase() === "final";
    if (!final) return "Jogo encerrado? aguardando resultado";
    return `${game.away_score ?? "—"} × ${game.home_score ?? "—"}`;
  }

  function voterMarkup(list) {
    if (!list.length) return '<span class="history-voter history-voter--empty">Ninguém</span>';

    return list
      .sort((a, b) => {
        const nameA = profilesById[a.user_id] || "Jogador";
        const nameB = profilesById[b.user_id] || "Jogador";
        return nameA.localeCompare(nameB, "pt-BR");
      })
      .map(pick => {
        const isYou = pick.user_id === currentUser.id;
        const name = profilesById[pick.user_id] || "Jogador";
        return `<span class="history-voter ${isYou ? "is-you" : ""}">${escapeHtml(name)}${isYou ? " · você" : ""}</span>`;
      })
      .join("");
  }

  function renderDateStrip() {
    if (!dateStrip) return;

    dateStrip.innerHTML = rounds.map((round, index) => `
      <button
        type="button"
        class="history-date-chip ${index === selectedIndex ? "is-active" : ""}"
        data-round-index="${index}"
        aria-pressed="${index === selectedIndex ? "true" : "false"}"
      >
        <span>${escapeHtml(formatShortDate(round.date))}</span>
        <small>${round.games.length}j</small>
      </button>
    `).join("");

    dateStrip.querySelectorAll("[data-round-index]").forEach(button => {
      button.addEventListener("click", () => {
        selectedIndex = Number(button.dataset.roundIndex);
        loadSelectedRound();
      });
    });

    const active = dateStrip.querySelector(".history-date-chip.is-active");
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }

  function setBrowserState(round, picks) {
    const uniquePlayers = new Set((picks || []).map(pick => pick.user_id));
    dateTitle.textContent = formatLongDate(round.date);
    dateMeta.textContent = `${round.games.length} ${round.games.length === 1 ? "jogo" : "jogos"} · rodada fechada`;
    gamesCount.textContent = round.games.length;
    picksCount.textContent = picks.length;
    playersCount.textContent = uniquePlayers.size;

    olderButton.disabled = selectedIndex >= rounds.length - 1;
    newerButton.disabled = selectedIndex <= 0;
  }

  function renderGames(round, predictions) {
    const picksByGame = new Map();
    for (const pick of predictions || []) {
      const id = String(pick.game_id);
      if (!picksByGame.has(id)) picksByGame.set(id, []);
      picksByGame.get(id).push(pick);
    }

    gamesHost.innerHTML = round.games.map(game => {
      const gamePicks = picksByGame.get(String(game.id)) || [];
      const awayPicks = gamePicks.filter(pick => pick.picked_team_code === game.away_team_code);
      const homePicks = gamePicks.filter(pick => pick.picked_team_code === game.home_team_code);
      const myPick = gamePicks.find(pick => pick.user_id === currentUser.id);
      const away = teamInfo(game.away_team_code, game.away_team_name);
      const home = teamInfo(game.home_team_code, game.home_team_name);
      const awayWon = game.winner_team_code === game.away_team_code;
      const homeWon = game.winner_team_code === game.home_team_code;
      const status = String(game.status || "").toLowerCase();
      const scoreText = status === "final"
        ? `${game.away_score ?? "—"} × ${game.home_score ?? "—"}`
        : formatGameTime(game.start_at);
      const myPickName = myPick
        ? (myPick.picked_team_code === away.code ? away.name : home.name)
        : "";

      const teamBlock = (team, teamPicks, isWinner, side) => `
        <section class="history-team ${isWinner ? "is-winner" : ""} ${myPick?.picked_team_code === team.code ? "is-my-pick" : ""}">
          <div class="history-team__head">
            <div class="history-team__identity">
              ${team.logo ? `<img src="${escapeHtml(team.logo)}" alt="" loading="lazy">` : ""}
              <div>
                <small>${side}</small>
                <strong>${escapeHtml(team.name)}</strong>
                <span>${escapeHtml(team.code)}</span>
              </div>
            </div>
            <div class="history-team__count">
              <strong>${teamPicks.length}</strong>
              <span>${teamPicks.length === 1 ? "palpite" : "palpites"}</span>
            </div>
          </div>
          <div class="history-voters">${voterMarkup(teamPicks)}</div>
          ${isWinner ? '<span class="history-winner-badge">✓ vencedor</span>' : ""}
        </section>
      `;

      return `
        <article class="history-game">
          <header class="history-game__head">
            <div>
              <span>JOGO</span>
              <strong>${escapeHtml(away.code)} @ ${escapeHtml(home.code)}</strong>
            </div>
            <div class="history-game__score">
              <strong>${escapeHtml(scoreText)}</strong>
              <span>${status === "final" ? "Final" : escapeHtml(status || "encerrado")}</span>
            </div>
          </header>

          <div class="history-matchup">
            ${teamBlock(away, awayPicks, awayWon, "VISITANTE")}
            <div class="history-versus">VS</div>
            ${teamBlock(home, homePicks, homeWon, "CASA")}
          </div>

          <footer class="history-my-pick ${myPick ? "" : "is-empty"}">
            <span>Seu palpite</span>
            <strong>${myPick ? escapeHtml(myPickName) : "Você não registrou palpite neste jogo"}</strong>
          </footer>
        </article>
      `;
    }).join("");
  }

  async function loadSelectedRound() {
    const round = rounds[selectedIndex];
    if (!round) return;

    renderDateStrip();
    gamesHost.innerHTML = '<div class="history-loading">Carregando palpites da rodada…</div>';

    const gameIds = round.games.map(game => String(game.id));
    const { data: predictions, error } = await supabase
      .from("predictions")
      .select("user_id,game_id,picked_team_code,points")
      .in("game_id", gameIds);

    if (error) {
      console.error("[Bolão] Histórico de palpites:", error);
      gamesHost.innerHTML = '<div class="history-empty">Não foi possível carregar os palpites desta rodada.</div>';
      showToast("Falha ao carregar a rodada.");
      return;
    }

    setBrowserState(round, predictions || []);
    renderGames(round, predictions || []);
  }

  if (!supabase) {
    gamesHost.innerHTML = '<div class="history-empty">Não foi possível conectar ao bolão.</div>';
    return;
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user || session.user.is_anonymous) {
    location.replace("login.html");
    return;
  }

  currentUser = session.user;

  olderButton.addEventListener("click", () => {
    if (selectedIndex < rounds.length - 1) {
      selectedIndex += 1;
      loadSelectedRound();
    }
  });

  newerButton.addEventListener("click", () => {
    if (selectedIndex > 0) {
      selectedIndex -= 1;
      loadSelectedRound();
    }
  });

  try {
    const [{ data: games, error: gamesError }, { data: profiles, error: profilesError }] = await Promise.all([
      supabase
        .from("games")
        .select("id,round_date,start_at,status,away_team_code,away_team_name,home_team_code,home_team_name,away_score,home_score,winner_team_code")
        .neq("status", "cancelled")
        .not("round_date", "is", null)
        .order("round_date", { ascending: false })
        .order("start_at", { ascending: true })
        .limit(500),
      supabase
        .from("profiles")
        .select("id,display_name")
    ]);

    if (gamesError || profilesError) throw gamesError || profilesError;

    profilesById = Object.fromEntries((profiles || []).map(profile => [
      profile.id,
      profile.display_name || "Jogador"
    ]));

    const map = new Map();
    for (const game of games || []) {
      const key = game.round_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(game);
    }

    rounds = [...map.entries()]
      .filter(([, roundGames]) => roundIsLocked(roundGames))
      .map(([date, roundGames]) => ({
        date,
        games: roundGames.sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    if (!rounds.length) {
      dateTitle.textContent = "Nenhuma rodada fechada";
      dateMeta.textContent = "Assim que a primeira rodada fechar, o histórico aparece aqui.";
      dateStrip.innerHTML = "";
      gamesHost.innerHTML = '<div class="history-empty">Ainda não há rodadas anteriores para consultar.</div>';
      olderButton.disabled = true;
      newerButton.disabled = true;
      return;
    }

    await loadSelectedRound();
  } catch (error) {
    console.error("[Bolão] Histórico:", error);
    gamesHost.innerHTML = '<div class="history-empty">Não foi possível carregar o histórico agora.</div>';
    showToast("Falha ao carregar o histórico.");
  }
})();
