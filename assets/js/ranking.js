(async function () {
  const host = document.querySelector("#leaderboard");
  const braveTitle = document.querySelector("#braveTitle");
  const dialog = document.querySelector("#achievementDialog");
  const dialogTitle = document.querySelector("#achievementDialogTitle");
  const dialogBody = document.querySelector("#achievementDialogBody");
  const supabase = window.APP_SUPABASE;

  function initials(name) {
    return String(name || "Jogador").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? new Date(`${value}T12:00:00Z`)
      : new Date(value);
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
  }

  function renderError(message) {
    if (!host) return;
    host.innerHTML = `
      <div class="rank-row">
        <div class="rank-position">—</div>
        <div class="rank-person">
          <div class="avatar">!</div>
          <div>
            <div class="rank-name">Ranking indisponível</div>
            <small>${escapeHtml(message)}</small>
          </div>
        </div>
        <div class="rank-points">—</div>
      </div>`;
  }

  function achievementMarkup(userId, computed) {
    const badges = computed?.byUser?.[userId] || [];
    if (!badges.length) return "";

    return `<div class="achievement-row" aria-label="Conquistas">${badges.map(badge => {
      const visibleStack = Math.min(3, Math.max(1, badge.count));
      const pile = Array.from({ length: visibleStack }, (_, index) =>
        `<i style="--stack-index:${index}">${badge.emoji}</i>`
      ).join("");
      return `
        <button class="achievement-stack" type="button" data-achievement-user="${userId}" data-achievement-key="${badge.key}" aria-label="${escapeHtml(badge.label)}, ${badge.count} vez(es)">
          <span class="achievement-pile" aria-hidden="true">${pile}</span>
          <span class="achievement-stack__copy">
            <strong>${escapeHtml(badge.label)}</strong>
            ${badge.count > 1 ? `<small>×${badge.count}</small>` : ""}
          </span>
          <span class="achievement-tooltip">${escapeHtml(badge.description)}</span>
        </button>`;
    }).join("")}</div>`;
  }

  function openAchievement(userId, key, computed, names) {
    const badge = (computed?.byUser?.[userId] || []).find(item => item.key === key);
    if (!badge || !dialog) return;

    dialogTitle.textContent = `${badge.emoji} ${badge.label}`;
    const name = names[userId] || "Jogador";
    dialogBody.innerHTML = `
      <p class="achievement-dialog__lead"><strong>${escapeHtml(name)}</strong> · ${escapeHtml(badge.description)}</p>
      <div class="achievement-history">
        ${badge.events.map(event => `
          <div class="achievement-history__item">
            <strong>${event.round_date ? formatDate(event.round_date) : "Temporada"}</strong>
            <span>${escapeHtml(event.detail || badge.description)}</span>
          </div>`).join("")}
      </div>`;
    dialog.showModal();
  }

  if (!supabase) {
    renderError("Supabase não carregou.");
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  const session = data?.session;
  if (error || !session?.user || !session?.access_token) {
    location.replace("login.html");
    return;
  }

  try {
    const [{ data: rows, error: rankingError }, { data: profiles, error: profilesError }, { data: games, error: gamesError }, { data: predictions, error: predictionsError }] = await Promise.all([
      supabase.from("standings")
        .select("user_id,display_name,points,decided_picks,total_picks")
        .order("points", { ascending: false })
        .order("display_name", { ascending: true }),
      supabase.from("profiles").select("id,display_name"),
      supabase.from("games")
        .select("id,round_date,start_at,status,away_team_code,home_team_code,away_score,home_score")
        .neq("status", "cancelled")
        .order("start_at", { ascending: true }),
      supabase.from("predictions").select("user_id,game_id,picked_team_code")
    ]);

    if (rankingError || profilesError || gamesError || predictionsError) {
      throw rankingError || profilesError || gamesError || predictionsError;
    }

    const computed = window.BolaoAchievements.compute({
      games: games || [],
      predictions: predictions || [],
      profiles: profiles || []
    });
    const names = Object.fromEntries((profiles || []).map(profile => [profile.id, profile.display_name || "Jogador"]));
    const currentUserId = session.user.id;
    const season = window.BolaoSeason.build({ games: games || [], predictions: predictions || [], profiles: profiles || [] });
    const sortedRows = (rows || []).slice().sort((a,b) => {
      const p = Number(b.points || 0) - Number(a.points || 0);
      if (p) return p;
      const w = (season.byUser[b.user_id]?.wins || 0) - (season.byUser[a.user_id]?.wins || 0);
      return w || String(a.display_name || "").localeCompare(String(b.display_name || ""), "pt-BR");
    });

    const hasDecidedGames = sortedRows.some(person => Number(person.decided_picks || 0) > 0);
    const topPoints = Number(sortedRows[0]?.points || 0);
    const topWins = season.byUser[sortedRows[0]?.user_id]?.wins || 0;
    const topTied = sortedRows.filter(person =>
      Number(person.points || 0) === topPoints &&
      (season.byUser[person.user_id]?.wins || 0) === topWins
    ).length > 1;

    host.innerHTML = sortedRows.map((person, index) => {
      const name = person.display_name || "Jogador";
      const isYou = person.user_id === currentUserId;
      const phase = season.byUser[person.user_id] || {};
      const move = Number(phase.movement || 0);
      const movement = hasDecidedGames
        ? (move > 0 ? `<span class="rank-movement up">↑${move}</span>` : move < 0 ? `<span class="rank-movement down">↓${Math.abs(move)}</span>` : '<span class="rank-movement neutral">—</span>')
        : "";

      const sameScoreBefore = sortedRows.slice(0, index).filter(other =>
        Number(other.points || 0) === Number(person.points || 0) &&
        (season.byUser[other.user_id]?.wins || 0) === (phase.wins || 0)
      ).length;
      const tiedGroupSize = sortedRows.filter(other =>
        Number(other.points || 0) === Number(person.points || 0) &&
        (season.byUser[other.user_id]?.wins || 0) === (phase.wins || 0)
      ).length;
      const position = hasDecidedGames ? (index + 1 - sameScoreBefore) : null;
      const isTied = tiedGroupSize > 1;
      const uniqueLeader = position === 1 && !topTied;
      const positionLabel = !position ? "—" : uniqueLeader ? "♛" : `${position}º`;
      const tieLabel = position && isTied ? '<span class="rank-tie">EMP.</span>' : "";

      const decidedCount = Number(person.decided_picks || 0);
      const winCount = Number(phase.wins || 0);
      const points = Number(person.points || 0);
      const decidedLabel = `${decidedCount} ${decidedCount === 1 ? "palpite decidido" : "palpites decididos"}`;
      const winsLabel = `${winCount} ${winCount === 1 ? "vitória" : "vitórias"}`;
      const pointsLabel = `${points} ${points === 1 ? "pt" : "pts"}`;

      const recentAccuracy = phase.recentTotal
        ? Math.round((phase.recentCorrect / phase.recentTotal) * 100)
        : 0;
      const moment = phase.currentStreak >= 2
        ? `🔥 ${phase.currentStreak} acertos seguidos`
        : phase.recentTotal
          ? `🎯 ${recentAccuracy}% até agora`
          : "Aguardando primeira rodada decidida";

      return `
        <article class="rank-row rank-row--achievements ${uniqueLeader ? "first" : ""} ${isYou ? "is-you" : ""}" data-user-id="${person.user_id}">
          <div class="rank-position-wrap">
            <div class="rank-position">${positionLabel}</div>
            ${tieLabel}
            ${movement}
          </div>
          <div class="rank-person">
            <div class="avatar">${escapeHtml(initials(name))}</div>
            <div class="rank-person__copy">
              <div class="rank-name">${escapeHtml(name)}${isYou ? " · você" : ""}</div>
              <small>${decidedLabel}<span class="rank-meta-dot">·</span>🏆 ${winsLabel}</small>
              <span class="rank-moment">${escapeHtml(moment)}</span>
              ${achievementMarkup(person.user_id, computed)}
            </div>
          </div>
          <div class="rank-points">${pointsLabel}</div>
        </article>`;
    }).join("") || `
      <div class="rank-row">
        <div class="rank-position">—</div>
        <div class="rank-person">
          <div class="avatar">🏀</div>
          <div>
            <div class="rank-name">O ranking começa na primeira rodada</div>
            <small>Os pontos aparecem quando os jogos forem finalizados.</small>
          </div>
        </div>
        <div class="rank-points">0 pts</div>
      </div>`;

    host.querySelectorAll("[data-achievement-user]").forEach(button => {
      button.addEventListener("click", () => openAchievement(
        button.dataset.achievementUser,
        button.dataset.achievementKey,
        computed,
        names
      ));
    });

    dialog?.querySelector(".dialog-close")?.addEventListener("click", () => dialog.close());
    dialog?.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });

    if (braveTitle) {
      const latestUnderdog = computed.allEvents
        .filter(event => event.key === "underdog")
        .sort((a, b) => new Date(b.sort_at || 0) - new Date(a.sort_at || 0))[0];

      braveTitle.textContent = latestUnderdog
        ? `${names[latestUnderdog.user_id] || "Jogador"} foi o azarão em ${latestUnderdog.detail.replace(" · único em ", " · ")} 🐺`
        : "O primeiro azarão da temporada ainda vai aparecer.";
    }
  } catch (err) {
    console.error("[Bolão] Falha ao carregar ranking:", err);
    renderError(err?.message || "Erro inesperado.");
  }
})();