(async function () {
  const supabase = window.APP_SUPABASE;

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showToast(message) {
    const toast = document.querySelector("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function formatRoundDate(key) {
    const date = new Date(`${key}T12:00:00Z`);
    return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })
      .format(date)
      .replaceAll(".", "");
  }

  function isRoundLocked(games) {
    const starts = games.map(game => new Date(game.start_at).getTime()).filter(Number.isFinite);
    return starts.length > 0 && Date.now() >= Math.min(...starts);
  }

  function scoreLabel(game) {
    if (String(game.status || "").toLowerCase() !== "final") return "Aguardando";
    return `${game.away_score ?? "—"} × ${game.home_score ?? "—"}`;
  }

  function renderCommunityRounds(games, predictions, profiles, currentUserId) {
    const host = document.getElementById("communityRounds");
    if (!host) return;

    const names = Object.fromEntries((profiles || []).map(profile => [profile.id, profile.display_name || "Jogador"]));
    const predictionsByGame = new Map();
    for (const prediction of predictions || []) {
      const id = String(prediction.game_id);
      if (!predictionsByGame.has(id)) predictionsByGame.set(id, []);
      predictionsByGame.get(id).push(prediction);
    }

    const rounds = new Map();
    for (const game of games || []) {
      if (!rounds.has(game.round_date)) rounds.set(game.round_date, []);
      rounds.get(game.round_date).push(game);
    }

    const lockedDates = [...rounds.entries()]
      .filter(([, roundGames]) => isRoundLocked(roundGames))
      .map(([date]) => date)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 3);

    if (!lockedDates.length) {
      host.innerHTML = '<div class="community-empty">Os votos aparecem aqui depois que a primeira partida da rodada começa.</div>';
      return;
    }

    host.innerHTML = lockedDates.map(date => {
      const roundGames = rounds.get(date).sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
      return `
        <section class="community-round">
          <header class="community-round__head">
            <strong>${escapeHtml(formatRoundDate(date))}</strong>
            <span>${roundGames.length} ${roundGames.length === 1 ? "jogo" : "jogos"}</span>
          </header>
          <div class="community-games">
            ${roundGames.map(game => {
              const gamePicks = predictionsByGame.get(String(game.id)) || [];
              const away = gamePicks.filter(pick => pick.picked_team_code === game.away_team_code);
              const home = gamePicks.filter(pick => pick.picked_team_code === game.home_team_code);

              const namesMarkup = list => list.length
                ? list.map(pick => `<span class="${pick.user_id === currentUserId ? "is-you" : ""}">${escapeHtml(names[pick.user_id] || "Jogador")}</span>`).join("")
                : '<em>Ninguém</em>';

              return `
                <article class="community-game">
                  <div class="community-game__head">
                    <strong>${escapeHtml(game.away_team_code)} @ ${escapeHtml(game.home_team_code)}</strong>
                    <span>${escapeHtml(scoreLabel(game))}</span>
                  </div>
                  <div class="community-votes">
                    <div>
                      <div class="community-votes__team"><strong>${escapeHtml(game.away_team_code)}</strong><b>${away.length}</b></div>
                      <div class="community-voters">${namesMarkup(away)}</div>
                    </div>
                    <div>
                      <div class="community-votes__team"><strong>${escapeHtml(game.home_team_code)}</strong><b>${home.length}</b></div>
                      <div class="community-voters">${namesMarkup(home)}</div>
                    </div>
                  </div>
                </article>`;
            }).join("")}
          </div>
        </section>`;
    }).join("");
  }

  if (!supabase) {
    showToast("Não foi possível carregar as estatísticas.");
    return;
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  const user = session?.user;
  if (sessionError || !user || user.is_anonymous) {
    location.replace("login.html");
    return;
  }

  try {
    const [{ data: standing }, { count: submitted }, { data: ranking }, { data: allGames, error: gamesError }, { data: profiles, error: profilesError }] = await Promise.all([
      supabase.from("standings")
        .select("user_id,display_name,points,decided_picks,total_picks")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("predictions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase.from("standings")
        .select("user_id,points,display_name")
        .order("points", { ascending: false })
        .order("display_name", { ascending: true }),
      supabase.from("games")
        .select("id,round_date,start_at,status,away_team_code,home_team_code,away_score,home_score")
        .neq("status", "cancelled")
        .order("round_date", { ascending: false })
        .order("start_at", { ascending: true })
        .limit(80),
      supabase.from("profiles").select("id,display_name")
    ]);

    if (gamesError || profilesError) throw gamesError || profilesError;

    const points = Number(standing?.points || 0);
    const decided = Number(standing?.decided_picks || 0);
    const sent = Number(submitted || standing?.total_picks || 0);
    const wrong = Math.max(0, decided - points);
    const pending = Math.max(0, sent - decided);
    const accuracy = decided ? Math.round((points / decided) * 100) : 0;
    const positionIndex = (ranking || []).findIndex(row => row.user_id === user.id);
    const position = positionIndex >= 0 ? positionIndex + 1 : null;

    setText("statPosition", position ? `#${position}` : "—");
    setText("statPositionHint", position ? `${ranking.length} ${ranking.length === 1 ? "jogador" : "jogadores"} no ranking` : "Sem pontuação computada");
    setText("statPoints", points);
    setText("statAccuracy", `${accuracy}%`);
    setText("statAccuracyHint", decided ? `${points} acertos em ${decided}` : "Sem jogos decididos");
    setText("statCorrect", points);
    setText("statCorrectHint", `${decided} ${decided === 1 ? "palpite decidido" : "palpites decididos"}`);
    setText("statSubmitted", sent);
    setText("statDecided", decided);
    setText("statPending", pending);
    setText("statWrong", wrong);

    const insight = document.getElementById("statsInsight");
    if (insight && decided > 0) {
      insight.innerHTML = `
        <span aria-hidden="true">${accuracy >= 60 ? "🔥" : "🏀"}</span>
        <div>
          <strong>${accuracy >= 60 ? "Boa fase." : "Temporada em andamento."}</strong>
          <p>Você acertou ${points} de ${decided} palpites já decididos e está com ${accuracy}% de aproveitamento.</p>
        </div>`;
    }

    const roundMap = new Map();
    for (const game of allGames || []) {
      if (!roundMap.has(game.round_date)) roundMap.set(game.round_date, []);
      roundMap.get(game.round_date).push(game);
    }
    const recentLockedDates = [...roundMap.entries()]
      .filter(([, roundGames]) => isRoundLocked(roundGames))
      .map(([date]) => date)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 3);
    const detailGames = (allGames || []).filter(game => recentLockedDates.includes(game.round_date));
    const gameIds = detailGames.map(game => String(game.id));

    let communityPredictions = [];
    if (gameIds.length) {
      const { data, error } = await supabase.from("predictions")
        .select("user_id,game_id,picked_team_code")
        .in("game_id", gameIds);
      if (error) throw error;
      communityPredictions = data || [];
    }

    renderCommunityRounds(detailGames, communityPredictions, profiles || [], user.id);
  } catch (error) {
    console.error("[Bolão] Estatísticas:", error);
    showToast("Falha ao carregar as estatísticas.");
  }
})();