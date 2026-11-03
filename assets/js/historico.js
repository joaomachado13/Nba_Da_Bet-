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
  const predictionsCache = new Map();
  let requestSequence = 0;
  let dateDrag = null;
  let ignoreDateClick = false;
  dateStrip?.addEventListener("wheel", event => {
    if (dateStrip.scrollWidth <= dateStrip.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const max = dateStrip.scrollWidth - dateStrip.clientWidth;
    const next = Math.max(0, Math.min(max, dateStrip.scrollLeft + event.deltaY));
    if (Math.abs(next - dateStrip.scrollLeft) > .5) { event.preventDefault(); dateStrip.scrollLeft = next; }
  }, { passive: false });
  dateStrip?.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button === 0) dateDrag = { x: event.clientX, scroll: dateStrip.scrollLeft, moved: false };
  });
  dateStrip?.addEventListener("pointermove", event => {
    if (!dateDrag) return;
    const dx = event.clientX - dateDrag.x;
    if (Math.abs(dx) > 5) { dateDrag.moved = true; dateStrip.scrollLeft = dateDrag.scroll - dx; }
  });
  dateStrip?.addEventListener("pointerup", () => {
    if (dateDrag?.moved) { ignoreDateClick = true; setTimeout(() => { ignoreDateClick = false; }, 0); }
    dateDrag = null;
  });
  dateStrip?.addEventListener("pointercancel", () => { dateDrag = null; });

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
      day: "numeric",
      month: "long"
    }).format(date);
  }

  function formatWeekday(key) {
    const value = new Intl.DateTimeFormat("pt-BR", {weekday:"short", timeZone:"UTC"}).format(new Date(`${key}T12:00:00Z`));
    return value.replace(".", "").replace(/^./, c => c.toUpperCase());
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
      logo: window.NBA_TEAMS?.logoUrl?.(code) || "",
      color: /^#[0-9a-f]{6}$/i.test(cfg.color || "") ? cfg.color : "#927b43"
    };
  }

  function statusIsFinal(game) { return String(game.status || "").toLowerCase() === "final"; }

  function finalScore(game) {
    const final = String(game.status || "").toLowerCase() === "final";
    if (!final) return "Jogo encerrado? aguardando resultado";
    return `${game.away_score ?? "—"} × ${game.home_score ?? "—"}`;
  }

  function voterMarkup(list) {
    if (!list.length) return '<span class="history-voter history-voter--empty">Ninguém</span>';

    return [...list]
      .sort((a, b) => {
        if (a.user_id === currentUser.id) return -1;
        if (b.user_id === currentUser.id) return 1;
        const nameA = profilesById[a.user_id] || "Jogador";
        const nameB = profilesById[b.user_id] || "Jogador";
        return nameA.localeCompare(nameB, "pt-BR");
      })
      .map(pick => {
        const isYou = pick.user_id === currentUser.id;
        const name = profilesById[pick.user_id] || "Jogador";
        const short = name.trim().split(/\\s+/);
        const display = short.length > 1 ? `${short[0]} ${short[1][0]}.` : short[0];
        return `<span class="history-voter ${isYou ? "is-you" : ""}" title="${escapeHtml(name)}">${escapeHtml(display)}${isYou ? " · você" : ""}</span>`;
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
        <small>${escapeHtml(formatWeekday(round.date))}</small><span>${escapeHtml(formatShortDate(round.date))}</span>
        <small class="history-date-chip__games">${round.games.length} ${round.games.length === 1 ? "jogo" : "jogos"}</small>
      </button>
    `).join("");

    dateStrip.querySelectorAll("[data-round-index]").forEach(button => {
      button.addEventListener("click", () => {
        if (ignoreDateClick) return;
        selectedIndex = Number(button.dataset.roundIndex);
        loadSelectedRound();
      });
    });

    const active = dateStrip.querySelector(".history-date-chip.is-active");
    if (active) dateStrip.scrollTo({ left: active.offsetLeft - dateStrip.offsetLeft - (dateStrip.clientWidth - active.offsetWidth) / 2, behavior: "smooth" });
  }

  function setBrowserState(round, picks) {
    const uniquePlayers = new Set((picks || []).map(pick => pick.user_id));
    dateTitle.textContent = formatLongDate(round.date);
    dateMeta.textContent = `${round.games.length} ${round.games.length === 1 ? "jogo" : "jogos"} · rodada fechada`;
    gamesCount.textContent = round.games.length;
    picksCount.textContent = picks.length;
    const byGame = new Map((picks || []).map(pick => [String(pick.game_id) + ":" + pick.user_id, pick.picked_team_code]));
    const finalGames = round.games.filter(game => statusIsFinal(game) && Number.isFinite(Number(game.away_score)) && Number.isFinite(Number(game.home_score)) && Number(game.away_score) !== Number(game.home_score));
    const correct = finalGames.filter(game => {
      const winner = Number(game.away_score) > Number(game.home_score) ? game.away_team_code : game.home_team_code;
      return byGame.get(String(game.id) + ":" + currentUser.id) === winner;
    }).length;
    playersCount.textContent = `${correct}/${finalGames.length}`;
    playersCount.parentElement.style.setProperty("--accuracy", `${finalGames.length ? correct * 100 / finalGames.length : 0}%`);
    newerButton.title = selectedIndex >= rounds.length - 1 ? "Sem rodada mais recente" : "Ver rodada mais recente";
    newerButton.setAttribute("aria-label", newerButton.title);

    olderButton.disabled = selectedIndex <= 0;
    newerButton.disabled = selectedIndex >= rounds.length - 1;
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
      const awayWon = statusIsFinal(game) && Number(game.away_score) > Number(game.home_score);
      const homeWon = statusIsFinal(game) && Number(game.home_score) > Number(game.away_score);
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

      const final = status === "final";
      const validResult = final && Number.isFinite(Number(game.away_score)) && Number.isFinite(Number(game.home_score)) && Number(game.away_score) !== Number(game.home_score);
      const result = !myPick ? "missing" : validResult ? (myPick.picked_team_code === (awayWon ? away.code : home.code) ? "correct" : "wrong") : "pending";
      const totalVotes = awayPicks.length + homePicks.length;
      const awayPercent = totalVotes ? Math.round(awayPicks.length * 100 / totalVotes) : 50;
      const homePercent = totalVotes ? 100 - awayPercent : 50;
      const avatars = gamePicks.slice(0, 5).map(pick => {
        const name = profilesById[pick.user_id] || "Jogador";
        const initials = name.trim().slice(0, 2).toUpperCase();
        const hue = [...String(pick.user_id)].reduce((hash, char) => ((hash * 31 + char.charCodeAt(0)) >>> 0), 17) % 360;
        const avatarResult = validResult ? (pick.picked_team_code === (awayWon ? away.code : home.code) ? "correct" : "wrong") : "pending";
        return `<span class="history-avatar history-avatar--${avatarResult}" style="--avatar-hue:${hue}" title="${escapeHtml(name)}">${escapeHtml(initials)}${avatarResult === "correct" ? '<em>✓</em>' : avatarResult === "wrong" ? '<em>×</em>' : ""}</span>`;
      }).join("");
      return `
        <article class="history-game history-game--${result}">
          <header class="history-game__head">
            <span>${final ? "Final" : escapeHtml(status || "Programado")}</span>

          </header>
          <div class="history-game__compact">
            <div class="history-game__compact-team ${awayWon ? "is-winner" : homeWon ? "is-loser" : ""}">
              ${away.logo ? `<img src="${escapeHtml(away.logo)}" alt="" loading="lazy">` : ""}
              <span>${escapeHtml(away.name)}</span>
            </div>
            <div class="history-game__central-score" aria-label="${escapeHtml(scoreText)}">
              ${final ? `<strong class="${awayWon ? "is-winner" : "is-loser"}">${escapeHtml(game.away_score ?? "—")}</strong><span>×</span><strong class="${homeWon ? "is-winner" : "is-loser"}">${escapeHtml(game.home_score ?? "—")}</strong>` : `<small>${escapeHtml(formatGameTime(game.start_at))}</small>`}
            </div>
            <div class="history-game__compact-team ${homeWon ? "is-winner" : awayWon ? "is-loser" : ""}">
              <span>${escapeHtml(home.name)}</span>
              ${home.logo ? `<img src="${escapeHtml(home.logo)}" alt="" loading="lazy">` : ""}
            </div>
          </div>
          <div class="history-vote-breakdown">
            <div class="history-vote-labels"><span><i style="background:${escapeHtml(away.color)}"></i><strong>${awayPicks.length} ${awayPicks.length === 1 ? "voto" : "votos"}</strong> · ${awayPercent}%</span><span>${homePercent}% · <strong>${homePicks.length} ${homePicks.length === 1 ? "voto" : "votos"}</strong><i style="background:${escapeHtml(home.color)}"></i></span></div>
            <div class="history-vote-bar" style="--away-vote-color:${escapeHtml(away.color)};--home-vote-color:${escapeHtml(home.color)}" role="img" aria-label="${awayPercent}% dos votos no ${escapeHtml(away.name)} e ${homePercent}% no ${escapeHtml(home.name)}">
              <span style="width:${awayPercent}%"></span><span style="width:${homePercent}%"></span>
            </div>
          </div>
          <details class="history-game__details history-game__details--full">
            <summary aria-label="Expandir ou recolher votos desta partida">
              <span class="history-my-pick ${myPick ? "" : "is-empty"}">
                <span>Seu palpite: <strong>${myPick ? escapeHtml(myPickName) : "Não registrado"}</strong></span>
                ${result === "correct" ? '<b class="history-result-badge is-correct">✓ Acertou</b>' : result === "wrong" ? '<b class="history-result-badge is-wrong">✕ Errou</b>' : result === "missing" ? '<b class="history-result-badge is-missing">Sem palpite</b>' : ""}
              </span>
              <span class="history-avatars" aria-hidden="true">${avatars}</span>
              <span class="history-chevron" aria-hidden="true">⌄</span>
            </summary>
            <div class="history-matchup">
              ${teamBlock(away, awayPicks, awayWon, "VISITANTE")}
              <div class="history-versus">VS</div>
              ${teamBlock(home, homePicks, homeWon, "CASA")}
            </div>
          </details>
        </article>
      `;
    }).join("");
  }

  async function loadSelectedRound() {
    const round = rounds[selectedIndex];
    if (!round) return;
    const sequence = ++requestSequence;
    renderDateStrip();
    const cached = predictionsCache.get(round.date);
    if (cached) {
      setBrowserState(round, cached);
      renderGames(round, cached);
      return;
    }
    gamesHost.innerHTML = '<div class="history-loading">Carregando palpites da rodada…</div>';
    const { data, error } = await supabase.from("predictions")
      .select("user_id,game_id,picked_team_code")
      .in("game_id", round.games.map(game => String(game.id)));
    if (sequence !== requestSequence) return;
    if (error) {
      console.error("[Bolão] Histórico de palpites:", error);
      gamesHost.innerHTML = '<div class="history-empty">Não foi possível carregar os palpites desta rodada.</div>';
      showToast("Falha ao carregar a rodada.");
      return;
    }
    const predictions = data || [];
    predictionsCache.set(round.date, predictions);
    setBrowserState(round, predictions);
    renderGames(round, predictions);
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
    if (selectedIndex > 0) {
      selectedIndex -= 1;
      loadSelectedRound();
    }
  });

  newerButton.addEventListener("click", () => {
    if (selectedIndex < rounds.length - 1) {
      selectedIndex += 1;
      loadSelectedRound();
    }
  });

  try {
    const [{ data: games, error: gamesError }, { data: profiles, error: profilesError }] = await Promise.all([
      supabase
        .from("games")
        .select("id,round_date,start_at,status,away_team_code,away_team_name,home_team_code,home_team_name,away_score,home_score")
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
      .sort((a, b) => a.date.localeCompare(b.date));

    selectedIndex = rounds.length - 1;

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
