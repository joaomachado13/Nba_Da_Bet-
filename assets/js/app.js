(function () {
  const TZ = window.APP_CONFIG?.TIME_ZONE || "America/Sao_Paulo";
  const gamesList = document.querySelector("#gamesList");
  const toast = document.querySelector("#toast");
  const picksDoneEl = document.querySelector("#picksDone");
  const picksTotalEl = document.querySelector("#picksTotal");
  const picksPercentEl = document.querySelector("#picksPercent");
  const progressFill = document.querySelector("#progressFill");
  const lockTimeEl = document.querySelector("#lockTime");
  const countdownEl = document.querySelector("#roundCountdown");
  const ruleCard = document.querySelector("#ruleCard");
  const ruleTitle = document.querySelector("#ruleTitle");
  const ruleText = document.querySelector("#ruleText");
  const gamesSummaryEl = document.querySelector("#gamesSummary");
  const roundGamesCountEl = document.querySelector("#roundGamesCount");
  const roundPicksStatusEl = document.querySelector("#roundPicksStatus");
  const roundStateEl = document.querySelector(".round-state");
  const miniRankingEl = document.querySelector("#miniRanking");
  const yourRankSummaryEl = document.querySelector("#yourRankSummary");
  const infoDialog = document.querySelector("#infoDialog");
  const infoDialogTitle = document.querySelector("#infoDialogTitle");
  const infoDialogBody = document.querySelector("#infoDialogBody");
  const familyRevealEl = document.querySelector("#familyReveal");
  const nextRoundTitleEl = document.querySelector("#nextRoundTitle");
  const nextRoundGamesEl = document.querySelector("#nextRoundGames");
  const nextRoundMatchEl = document.querySelector("#nextRoundMatch");

  let games = [];
  let lockAt = null;
  let picks = {};
  let revealedPicks = {};
  let revealedNames = {};
  let currentUser = null;
  let currentAccessToken = "";
  let currentProfile = null;
  let sourceName = "supabase";
  let previousLockedState = null;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2100);
  }

  function roomPassword() {
    return "BolaoNBA-1322!";
  }

  async function migrateRoomLogin() {
    if (!currentUser?.email || currentUser.user_metadata?.room_login_v2) return;

    try {
      const metadata = {
        ...(currentUser.user_metadata || {}),
        room_login_v2: true
      };

      const { data, error } = await window.APP_SUPABASE.auth.updateUser({
        password: roomPassword(),
        data: metadata
      });

      if (error) throw error;

      const signed = await window.APP_SUPABASE.auth.signInWithPassword({
        email: currentUser.email,
        password: roomPassword()
      });

      if (!signed.error && signed.data?.session) {
        currentUser = signed.data.user;
        currentAccessToken = signed.data.session.access_token;
      } else if (data?.user) {
        currentUser = data.user;
      }
    } catch (error) {
      console.warn("[Bolão] Migração do login pendente:", error);
    }
  }

  async function requireUser() {
    if (!window.APP_SUPABASE) {
      location.replace("login.html?reason=supabase");
      return false;
    }

    const { data, error } = await window.APP_SUPABASE.auth.getSession();
    const session = data?.session;

    if (error || !session?.user || !session?.access_token) {
      location.replace("login.html");
      return false;
    }

    if (session.user.is_anonymous) {
      location.replace("login.html?complete=1");
      return false;
    }

    currentUser = session.user;
    currentAccessToken = session.access_token;
    return true;
  }

  async function restRequest(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const base = window.APP_CONFIG?.SUPABASE_URL;
      const key = window.APP_CONFIG?.SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(`${base}/rest/v1/${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          apikey: key,
          Authorization: `Bearer ${currentAccessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(options.headers || {})
        }
      });

      const body = await response.text();
      const data = body ? JSON.parse(body) : null;

      if (!response.ok) {
        const message = data?.message || data?.hint || `REST ${response.status}`;
        throw new Error(message);
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function loadProfile() {
    if (!currentUser) return;

    // O nome da sala já vem no metadata; isso deixa o topo instantâneo.
    const fallbackName = currentUser.user_metadata?.display_name || "Jogador";
    const fallbackInitials = fallbackName.split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
    const nameEl = document.querySelector("#profileButton .profile-copy strong");
    const avatarEl = document.querySelector("#profileButton .profile-avatar");
    if (nameEl) nameEl.textContent = fallbackName;
    if (avatarEl) avatarEl.textContent = fallbackInitials || "J";

    const params = new URLSearchParams({
      select: "id,display_name,avatar_url,favorite_team_code",
      id: `eq.${currentUser.id}`,
      limit: "1"
    });
    const rows = await restRequest(`profiles?${params}`);
    const data = rows?.[0] || {
      id: currentUser.id,
      display_name: fallbackName,
      avatar_url: null,
      favorite_team_code: null
    };

    currentProfile = data;
    const name = data.display_name || fallbackName;
    const initials = name.split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
    if (nameEl) nameEl.textContent = name;
    if (avatarEl) avatarEl.textContent = initials || "J";
  }

  async function loadPredictions() {
    if (!currentUser || !games.length) {
      picks = {};
      revealedPicks = {};
      revealedNames = {};
      return;
    }

    const gameIds = games.map(game => String(game.id));
    const roundLockAt = window.BolaoRules.computeLockAt(games);
    const locked = window.BolaoRules.isRoundLocked(roundLockAt);

    if (!locked) {
      const params = new URLSearchParams({
        select: "game_id,picked_team_code",
        user_id: `eq.${currentUser.id}`,
        game_id: `in.(${gameIds.join(",")})`
      });
      const rows = await restRequest(`predictions?${params}`);
      picks = Object.fromEntries((rows || []).map(row => [String(row.game_id), row.picked_team_code]));
      revealedPicks = {};
      revealedNames = {};
      return;
    }

    const predictionParams = new URLSearchParams({
      select: "user_id,game_id,picked_team_code",
      game_id: `in.(${gameIds.join(",")})`,
      order: "created_at.asc"
    });
    const rows = await restRequest(`predictions?${predictionParams}`) || [];

    picks = Object.fromEntries(
      rows
        .filter(row => row.user_id === currentUser.id)
        .map(row => [String(row.game_id), row.picked_team_code])
    );

    revealedPicks = {};
    rows.forEach(row => {
      const gameId = String(row.game_id);
      if (!revealedPicks[gameId]) revealedPicks[gameId] = [];
      revealedPicks[gameId].push({
        user_id: row.user_id,
        picked_team_code: row.picked_team_code
      });
    });

    const userIds = [...new Set(rows.map(row => row.user_id).filter(Boolean))];
    revealedNames = {};
    if (userIds.length) {
      const profileParams = new URLSearchParams({
        select: "id,display_name",
        id: `in.(${userIds.join(",")})`
      });
      const profiles = await restRequest(`profiles?${profileParams}`) || [];
      revealedNames = Object.fromEntries(
        profiles.map(profile => [profile.id, profile.display_name || "Jogador"])
      );
    }
  }

  async function persistPick(gameId, teamCode) {
    if (!currentUser) throw new Error("Sessão inválida");
    const params = new URLSearchParams({ on_conflict: "user_id,game_id" });
    await restRequest(`predictions?${params}`, {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({
        user_id: currentUser.id,
        game_id: gameId,
        picked_team_code: teamCode
      })
    });
  }

  function formatTime(iso) {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: TZ
    }).format(new Date(iso));
  }

  function todayKey() {
    return window.BolaoRules.roundDateKey(new Date(), TZ, 6);
  }

  function formatRoundDate(key) {
    const safeDate = new Date(`${key}T12:00:00Z`);
    const formatted = new Intl.DateTimeFormat("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone: TZ
    }).format(safeDate).replaceAll(".", "").toLowerCase();
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  function isLocked() {
    return window.BolaoRules.isRoundLocked(lockAt);
  }

  function cleanForm(form) {
    if (!Array.isArray(form)) return [];
    return form.slice(-5).map(item => String(item || "").toUpperCase()).filter(item => item === "V" || item === "D");
  }

  function normalizeGame(game) {
    const homeCode = game.home?.code || "HOME";
    const awayCode = game.away?.code || "AWAY";
    const homeCfg = window.NBA_TEAMS?.get(homeCode) || {};
    const awayCfg = window.NBA_TEAMS?.get(awayCode) || {};

    return {
      id: String(game.id),
      round_date: game.round_date || todayKey(),
      start_at: game.start_at,
      status: String(game.status || "scheduled").toLowerCase(),
      home: {
        code: homeCode,
        name: game.home?.name || homeCfg.name || homeCode || "Mandante",
        color: homeCfg.color || game.home?.color || "#E8A800",
        soft: homeCfg.soft || "rgba(232,168,0,.12)",
        watermarkOpacity: homeCfg.watermarkOpacity ?? .07,
        nba_id: game.home?.nba_id || game.home?.id || homeCfg.id || null,
        logo_url: game.home?.logo_url || window.NBA_TEAMS?.logoUrl(homeCode, game.home?.nba_id || game.home?.id) || "",
        score: game.home?.score ?? null,
        record: game.home?.record || "0-0",
        form: cleanForm(game.home?.form)
      },
      away: {
        code: awayCode,
        name: game.away?.name || awayCfg.name || awayCode || "Visitante",
        color: awayCfg.color || game.away?.color || "#E8A800",
        soft: awayCfg.soft || "rgba(232,168,0,.12)",
        watermarkOpacity: awayCfg.watermarkOpacity ?? .07,
        nba_id: game.away?.nba_id || game.away?.id || awayCfg.id || null,
        logo_url: game.away?.logo_url || window.NBA_TEAMS?.logoUrl(awayCode, game.away?.nba_id || game.away?.id) || "",
        score: game.away?.score ?? null,
        record: game.away?.record || "0-0",
        form: cleanForm(game.away?.form)
      }
    };
  }

  function gameState(game) {
    const status = game.status;
    if (["postponed", "postponed_final", "ppd"].includes(status)) return "postponed";
    if (["final", "completed", "closed"].includes(status)) return "final";
    if (["live", "in_progress", "in-progress", "halftime"].includes(status)) return "live";
    return "scheduled";
  }

  function statusLabel(game, locked) {
    const state = gameState(game);
    if (state === "final") return "FINAL";
    if (state === "live") return "AO VIVO";
    if (state === "postponed") return "ADIADO";
    return locked ? "AGUARDANDO" : "ABERTO";
  }

  function scoreValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function winnerCode(game) {
    if (gameState(game) !== "final") return null;
    const awayScore = scoreValue(game.away.score);
    const homeScore = scoreValue(game.home.score);
    if (awayScore === null || homeScore === null || awayScore === homeScore) return null;
    return awayScore > homeScore ? game.away.code : game.home.code;
  }

  function formMarkup(team) {
    const form = team.form.length ? team.form : [];
    const recent = form.length
      ? `<span class="team-form" aria-label="Sequência recente">${form.map(result => `<i class="form-dot ${result === "V" ? "win" : "loss"}">${result}</i>`).join("")}</span>`
      : "";
    return `<span class="team-stats"><b>${team.record || "0-0"}</b>${recent}</span>`;
  }

  function savedMessage(game, selected, locked) {
    if (!selected) return `<span class="pick-hint">Escolha o vencedor</span>`;

    const winner = winnerCode(game);
    if (winner) {
      const correct = winner === selected;
      return `<span class="pick-result ${correct ? "correct" : "wrong"}"><span aria-hidden="true">${correct ? "✓" : "×"}</span>${correct ? "Palpite correto" : "Palpite incorreto"}</span>`;
    }

    if (gameState(game) === "postponed") {
      return `<span class="pick-confirmed muted"><span aria-hidden="true">○</span>Jogo adiado</span>`;
    }

    return `<span class="pick-confirmed"><span aria-hidden="true">✓</span>${locked ? "Palpite confirmado" : "Palpite salvo"}</span>`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function revealMarkup(game, locked) {
    if (!locked) return "";

    const list = revealedPicks[game.id] || [];
    const awayPicks = list.filter(item => item.picked_team_code === game.away.code);
    const homePicks = list.filter(item => item.picked_team_code === game.home.code);
    const awayCount = awayPicks.length;
    const homeCount = homePicks.length;
    const total = list.length;
    const awayPercent = total ? Math.round((awayCount / total) * 100) : 0;
    const homePercent = total ? 100 - awayPercent : 0;

    const votersMarkup = picksList => picksList.length
      ? picksList.map(item => {
          const name = revealedNames[item.user_id] || "Jogador";
          const you = item.user_id === currentUser?.id;
          return `<span class="crowd-voter ${you ? "is-you" : ""}">${escapeHtml(name)}${you ? " · você" : ""}</span>`;
        }).join("")
      : '<span class="crowd-voter crowd-voter--empty">Ninguém</span>';

    return `
      <div class="crowd-summary">
        <div class="crowd-summary__head">
          <strong>Palpites da galera</strong>
          <span>${total} ${total === 1 ? "palpite" : "palpites"}</span>
        </div>
        <div class="crowd-summary__votes">
          <span><b>${escapeHtml(game.away.code)}</b><strong>${awayCount}</strong></span>
          <span><strong>${homeCount}</strong><b>${escapeHtml(game.home.code)}</b></span>
        </div>
        <div class="crowd-summary__bar" aria-label="${escapeHtml(game.away.code)} ${awayPercent}%, ${escapeHtml(game.home.code)} ${homePercent}%">
          <i style="width:${awayPercent}%"></i>
          <b style="width:${homePercent}%"></b>
        </div>
        <details class="crowd-details">
          <summary>
            <span>Ver quem foi em quem</span>
            <b aria-hidden="true">⌄</b>
          </summary>
          <div class="crowd-details__grid">
            <div class="crowd-side">
              <strong>${escapeHtml(game.away.code)} · ${awayCount}</strong>
              <div class="crowd-voters">${votersMarkup(awayPicks)}</div>
            </div>
            <div class="crowd-side crowd-side--home">
              <strong>${escapeHtml(game.home.code)} · ${homeCount}</strong>
              <div class="crowd-voters">${votersMarkup(homePicks)}</div>
            </div>
          </div>
        </details>
      </div>`;
  }

  function renderGames() {
    if (!games.length) {
      gamesList.innerHTML = `
        <div class="game-card empty-games">
          <div>
            <strong>Nenhum jogo da NBA hoje.</strong>
            <span>A próxima rodada aparecerá automaticamente.</span>
          </div>
        </div>`;
      updateProgress();
      return;
    }

    const locked = isLocked();
    gamesList.innerHTML = games.map(game => {
      const selected = picks[game.id];
      const state = gameState(game);
      const blocked = locked || state === "live" || state === "final" || state === "postponed";
      const awayScore = scoreValue(game.away.score);
      const homeScore = scoreValue(game.home.score);
      const showScore = state === "live" || state === "final";
      const visualState = state === "scheduled" && locked ? "locked" : state;

      return `
        <article class="game-card state-${visualState}" data-game-id="${game.id}" style="--away-color:${game.away.color};--home-color:${game.home.color};--away-soft:${game.away.soft};--home-soft:${game.home.soft};--away-mark-opacity:${game.away.watermarkOpacity};--home-mark-opacity:${game.home.watermarkOpacity}">
          ${game.away.logo_url ? `<img class="team-watermark team-watermark--away" src="${game.away.logo_url}" alt="" aria-hidden="true">` : ""}
          ${game.home.logo_url ? `<img class="team-watermark team-watermark--home" src="${game.home.logo_url}" alt="" aria-hidden="true">` : ""}
          <div class="game-meta">
            <span class="game-time">${formatTime(game.start_at)}</span>
            <span class="game-status ${state === "live" ? "is-live" : ""}">${state === "live" ? '<i class="live-dot" aria-hidden="true"></i>' : ''}${statusLabel(game, locked)}</span>
          </div>

          <div class="matchup">
            <div class="team">
              <span class="team-mark" style="--team-color:${game.away.color}">
                ${game.away.logo_url ? `<img class="team-logo" src="${game.away.logo_url}" alt="Logo ${game.away.name}">` : ""}
                <span class="team-fallback">${game.away.code}</span>
              </span>
              <span class="team-copy">
                <span class="team-name-row"><span class="team-name">${game.away.name}</span>${showScore && awayScore !== null ? `<strong class="team-score">${awayScore}</strong>` : ""}</span>
                ${formMarkup(game.away)}
              </span>
            </div>

            <span class="vs" aria-label="visitante em mandante">@</span>

            <div class="team away">
              <span class="team-copy">
                <span class="team-name-row"><span class="team-name">${game.home.name}</span>${showScore && homeScore !== null ? `<strong class="team-score">${homeScore}</strong>` : ""}</span>
                ${formMarkup(game.home)}
              </span>
              <span class="team-mark" style="--team-color:${game.home.color}">
                ${game.home.logo_url ? `<img class="team-logo" src="${game.home.logo_url}" alt="Logo ${game.home.name}">` : ""}
                <span class="team-fallback">${game.home.code}</span>
              </span>
            </div>
          </div>

          <div class="pick-actions">
            <button class="pick-button ${selected === game.away.code ? "selected" : ""}" data-pick="${game.away.code}" ${blocked ? "disabled" : ""} aria-pressed="${selected === game.away.code}">
              <span>${game.away.name}</span>${selected === game.away.code ? '<b aria-hidden="true">✓</b>' : ''}
            </button>
            <span class="pick-actions__spacer" aria-hidden="true"></span>
            <button class="pick-button ${selected === game.home.code ? "selected" : ""}" data-pick="${game.home.code}" ${blocked ? "disabled" : ""} aria-pressed="${selected === game.home.code}">
              <span>${game.home.name}</span>${selected === game.home.code ? '<b aria-hidden="true">✓</b>' : ''}
            </button>
          </div>

          <div class="pick-saved">${savedMessage(game, selected, locked)}</div>
          ${revealMarkup(game, locked)}
        </article>`;
    }).join("");

    gamesList.querySelectorAll(".team-logo").forEach(img => {
      img.addEventListener("load", () => img.closest(".team-mark")?.classList.add("logo-loaded"));
      img.addEventListener("error", () => img.remove());
      if (img.complete && img.naturalWidth > 0) img.closest(".team-mark")?.classList.add("logo-loaded");
    });
    gamesList.querySelectorAll(".team-watermark").forEach(img => {
      img.addEventListener("error", () => img.remove());
    });

    gamesList.querySelectorAll(".pick-button").forEach(btn => {
      btn.addEventListener("click", () => {
        if (isLocked()) return showToast("A rodada já está fechada.");
        const card = btn.closest(".game-card");
        const game = games.find(item => item.id === card.dataset.gameId);
        if (!game || gameState(game) !== "scheduled") return showToast("Este jogo não aceita alterações agora.");
        const previous = picks[card.dataset.gameId];
        picks[card.dataset.gameId] = btn.dataset.pick;
        renderGames();
        btn.disabled = true;
        persistPick(card.dataset.gameId, btn.dataset.pick)
          .then(() => showToast(`✓ Palpite salvo em ${btn.dataset.pick}`))
          .catch(error => {
            if (previous) picks[card.dataset.gameId] = previous; else delete picks[card.dataset.gameId];
            renderGames();
            showToast("Não foi possível salvar o palpite.");
            console.error(error);
          });
      });
    });

    updateProgress();
  }

  function updateProgress() {
    const { total, done, percent } = window.BolaoRules.progress(games, picks);
    picksDoneEl.textContent = done;
    picksTotalEl.textContent = total;
    picksPercentEl.textContent = `${percent}%`;
    progressFill.style.width = `${percent}%`;
    if (roundGamesCountEl) roundGamesCountEl.textContent = total;
    if (roundPicksStatusEl) roundPicksStatusEl.textContent = `${done}/${total}`;
    gamesSummaryEl.textContent = total
      ? `${total} ${total === 1 ? "jogo" : "jogos"} na rodada · trava no início do primeiro jogo`
      : "Sem jogos programados para a data local";
  }

  async function renderMiniRanking() {
    if (!miniRankingEl) return;

    const params = new URLSearchParams({
      select: "user_id,display_name,points",
      order: "points.desc,display_name.asc"
    });
    const ranking = await restRequest(`standings?${params}`) || [];
    const currentIndex = ranking.findIndex(person => person.user_id === currentUser?.id);
    const current = ranking[currentIndex];
    const leader = ranking[0];
    const runnerUp = ranking[1];

    if (current && yourRankSummaryEl) {
      if (currentIndex === 0) {
        const gap = runnerUp ? current.points - runnerUp.points : 0;
        yourRankSummaryEl.textContent = gap > 0 ? `Você lidera por ${gap} ${gap === 1 ? "pt" : "pts"}.` : "Você está na liderança.";
      } else {
        const gap = (leader?.points || 0) - current.points;
        yourRankSummaryEl.textContent = `${gap} ${gap === 1 ? "pt" : "pts"} atrás do líder.`;
      }
    } else if (yourRankSummaryEl) {
      yourRankSummaryEl.textContent = "Seu ranking começa no primeiro palpite computado.";
    }

    miniRankingEl.innerHTML = ranking.slice(0, 3).map((person, index) => {
      const initials = String(person.display_name || "J").split(/\s+/).slice(0,2).map(part => part[0] || "").join("").toUpperCase();
      return `<p class="mini-rank-row ${person.user_id === currentUser?.id ? "is-you" : ""} ${index === 0 ? "is-leader" : ""}">
        <span class="mini-rank-position">${index === 0 ? '<span class="leader-crown">♛</span>' : index + 1}</span>
        <span class="mini-avatar">${initials}</span>
        <span class="mini-rank-name">${person.display_name}${person.user_id === currentUser?.id ? " · você" : ""}</span>
        <strong>${person.points} pts</strong>
      </p>`;
    }).join("") || '<p class="mini-rank-row">Sem pontuação ainda.</p>';
  }

  async function renderNextRound() {
    if (!nextRoundTitleEl || !nextRoundGamesEl || !nextRoundMatchEl) return;
    const current = todayKey();
    const d = new Date(`${current}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    const nextKey = d.toISOString().slice(0,10);

    const params = new URLSearchParams({
      select: "id,start_at,away_team_code,home_team_code",
      round_date: `eq.${nextKey}`,
      status: "neq.cancelled",
      order: "start_at.asc"
    });
    const rows = await restRequest(`games?${params}`) || [];

    const aliases = { NY: "NYK", WSH: "WAS", SA: "SAS", NO: "NOP", GS: "GSW", UTAH: "UTA" };
    const canonical = code => aliases[String(code || "").toUpperCase()] || String(code || "").toUpperCase();
    const seen = new Set();
    const uniqueRows = rows.filter(row => {
      const key = `${canonical(row.away_team_code)}|${canonical(row.home_team_code)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    nextRoundTitleEl.textContent = "Amanhã";
    nextRoundGamesEl.textContent = `${uniqueRows.length} ${uniqueRows.length === 1 ? "jogo" : "jogos"}`;
    const first = uniqueRows[0];
    if (first) {
      nextRoundMatchEl.innerHTML = `<span class="next-round-time">${formatTime(first.start_at)}</span><span class="next-round-teams"><b>${canonical(first.away_team_code)}</b><span>@</span><b>${canonical(first.home_team_code)}</b></span>`;
    } else {
      nextRoundMatchEl.textContent = "Sem jogos programados.";
    }
  }

  function updateRoundStatus() {
    if (!lockAt) {
      lockTimeEl.textContent = "--:--";
      countdownEl.textContent = "Sem rodada para fechar hoje.";
      return;
    }

    lockTimeEl.textContent = formatTime(lockAt.toISOString());
    const ms = lockAt.getTime() - Date.now();
    const locked = ms <= 0;

    if (previousLockedState !== null && locked !== previousLockedState) renderGames();
    previousLockedState = locked;

    if (locked) {
      countdownEl.textContent = "Rodada encerrada. Os palpites já estão travados.";
      ruleCard.classList.add("locked");
      if (roundStateEl) { roundStateEl.textContent = "FECHADA"; roundStateEl.classList.add("locked"); }
      ruleTitle.textContent = "Rodada fechada · palpites revelados";
      ruleText.textContent = "Agora todos podem comparar os palpites desta rodada.";
      if (familyRevealEl) {
        familyRevealEl.hidden = false;
        familyRevealEl.innerHTML = `<span class="reveal-dot">✓</span><span>Palpites liberados</span>`;
        requestAnimationFrame(() => familyRevealEl.classList.add("is-visible"));
      }
      return;
    }

    ruleCard.classList.remove("locked");
    if (familyRevealEl) {
      familyRevealEl.classList.remove("is-visible");
      familyRevealEl.hidden = true;
    }
    if (roundStateEl) { roundStateEl.textContent = "ABERTA"; roundStateEl.classList.remove("locked"); }
    ruleTitle.textContent = "Palpites escondidos até o 1º jogo";
    ruleText.textContent = "Quando a rodada fechar, os palpites dos participantes serão revelados.";

    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.max(0, Math.floor((ms % 60000) / 1000));
    countdownEl.textContent = `Faltam ${hours}h ${String(minutes).padStart(2, "0")}min ${String(seconds).padStart(2, "0")}s para enviar ou alterar`;
  }

  async function loadGamesFromNbaEndpoint() {
    let endpoint = window.APP_CONFIG?.NBA_GAMES_ENDPOINT || "";
    if (!endpoint && location.protocol !== "file:") endpoint = "/api/nba/games";
    if (!endpoint) return null;

    const url = new URL(endpoint, location.href);
    url.searchParams.set("date", todayKey());
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`NBA endpoint respondeu ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.games)) throw new Error("Resposta inválida do endpoint NBA");
    sourceName = "nba";
    return payload.games.map(normalizeGame);
  }

  async function loadGamesFromSupabase() {
    if (!currentAccessToken) return null;
    const key = todayKey();

    const params = new URLSearchParams({
      select: "id,round_date,start_at,status,home_team_code,home_team_name,home_record,home_form,home_score,away_team_code,away_team_name,away_record,away_form,away_score",
      round_date: `eq.${key}`,
      order: "start_at.asc"
    });

    const data = await restRequest(`games?${params}`);
    sourceName = "supabase-rest";
    return (data || []).map(row => normalizeGame({
      id: row.id,
      round_date: row.round_date,
      start_at: row.start_at,
      status: row.status,
      home: { code: row.home_team_code, name: row.home_team_name, record: row.home_record, form: row.home_form, score: row.home_score },
      away: { code: row.away_team_code, name: row.away_team_name, record: row.away_record, form: row.away_form, score: row.away_score }
    }));
  }

  function loadFallbackGames() {
    sourceName = "fallback";
    const key = todayKey();
    return (window.MOCK_GAMES || [])
      .filter(game => (game.round_date || window.BolaoRules.localDateKey(game.start_at, TZ)) === key)
      .map(normalizeGame);
  }

  async function resolveGames() {
    // O banco é a fonte principal porque predictions.game_id possui FK para public.games.
    // A API NBA fica como fallback até o sincronizador Vercel -> Supabase estar ativo.
    try {
      const fromSupabase = await loadGamesFromSupabase();
      if (fromSupabase) return fromSupabase;
    } catch (error) {
      console.warn("Supabase indisponível:", error);
    }

    try {
      const fromNba = await loadGamesFromNbaEndpoint();
      if (fromNba) return fromNba;
    } catch (error) {
      console.warn("NBA endpoint indisponível:", error);
    }

    if (window.APP_DEMO_MODE) return loadFallbackGames();
    sourceName = "supabase-error";
    return [];
  }

  const dialogContent = {
    how: {
      title: "Como funciona",
      html: `<ol class="dialog-list"><li>Faça todos os seus palpites antes do primeiro jogo da rodada.</li><li>Quando o primeiro jogo começa, a rodada inteira é travada.</li><li>Depois do fechamento, os palpites podem ser comparados.</li></ol>`
    },
    score: {
      title: "Pontuação",
      html: `<p>Na regra inicial do bolão, cada vencedor acertado vale <strong>1 ponto</strong>. O ranking da temporada soma todos os acertos.</p>`
    },
    rules: {
      title: "Regras da rodada",
      html: `<ul class="dialog-list"><li>Um palpite por jogo.</li><li>Você pode trocar enquanto a rodada estiver aberta.</li><li>O fechamento acontece no horário do primeiro jogo do dia.</li><li>Depois do fechamento, nenhuma escolha pode ser alterada.</li></ul>`
    }
  };

  function setupInfoDialog() {
    if (!infoDialog) return;
    document.querySelectorAll("[data-info-dialog]").forEach(button => {
      button.addEventListener("click", () => {
        const content = dialogContent[button.dataset.infoDialog] || dialogContent.how;
        infoDialogTitle.textContent = content.title;
        infoDialogBody.innerHTML = content.html;
        infoDialog.showModal();
      });
    });
    infoDialog.querySelector(".dialog-close")?.addEventListener("click", () => infoDialog.close());
    infoDialog.addEventListener("click", event => {
      if (event.target === infoDialog) infoDialog.close();
    });
  }

  async function init() {
    const authenticated = await requireUser();
    if (!authenticated) return;

    // Migração única: habilita e-mail + senha da sala para esta conta.
    // Depois disso, novos logins podem coexistir em qualquer navegador/aparelho.
    await migrateRoomLogin();
    await loadProfile();
    document.querySelector("#todayLabel").textContent = formatRoundDate(todayKey());
    games = await resolveGames();
    await loadPredictions();
    lockAt = window.BolaoRules.computeLockAt(games);
    renderGames();
    await renderMiniRanking();
    await renderNextRound();
    updateRoundStatus();
    setInterval(updateRoundStatus, 1000);

    let refreshing = false;
    async function refreshRoundData() {
      if (refreshing || document.hidden) return;
      refreshing = true;
      try {
        const freshGames = await loadGamesFromSupabase();
        if (freshGames) games = freshGames;
        await loadPredictions();
        lockAt = window.BolaoRules.computeLockAt(games);
        renderGames();
        await renderMiniRanking();
        await renderNextRound();
        updateRoundStatus();
      } catch (error) {
        console.warn("[Bolão] Atualização automática:", error);
      } finally {
        refreshing = false;
      }
    }

    setInterval(refreshRoundData, 60000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshRoundData();
    });

    document.querySelector("#profileButton")?.addEventListener("click", () => location.href = "mais.html");
    document.querySelector("#statsButton")?.addEventListener("click", () => location.href = "estatisticas.html");
    document.querySelector("#moreButton")?.addEventListener("click", () => location.href = "mais.html");
    document.querySelectorAll(".desktop-action").forEach(button => {
      button.addEventListener("click", () => {
        const target = button.dataset.target;
        if (target) location.href = target;
      });
    });
    setupInfoDialog();

    // Mantido apenas para diagnóstico no console; não aparece na interface.
    console.info(`[Bolão] Fonte dos jogos: ${sourceName}`);
  }

  init().catch(error => {
    console.error("[Bolão] Falha na inicialização:", error);

    // Nunca deixa a home presa em "Carregando..." sem explicação.
    if (!currentUser) {
      location.replace("login.html?reason=init");
      return;
    }

    if (gamesList) {
      gamesList.innerHTML = `
        <div class="game-card empty-games">
          <div>
            <strong>Não foi possível carregar o bolão.</strong>
            <span>Atualize a página. Se continuar, abra novamente pelo link do convite.</span>
          </div>
        </div>`;
    }
    if (gamesSummaryEl) gamesSummaryEl.textContent = "Falha ao carregar os dados da rodada";
    if (countdownEl) countdownEl.textContent = "Não foi possível carregar o horário da rodada.";
    showToast("Falha ao carregar o bolão.");
  });
})();
