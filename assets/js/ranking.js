(async function () {
  const host = document.querySelector("#leaderboard");
  const braveTitle = document.querySelector("#braveTitle");
  const supabase = window.APP_SUPABASE;

  function initials(name) {
    return String(name || "Jogador")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0] || "")
      .join("")
      .toUpperCase();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const base = window.APP_CONFIG?.SUPABASE_URL;
    const key = window.APP_CONFIG?.SUPABASE_PUBLISHABLE_KEY;
    const params = new URLSearchParams({
      select: "user_id,display_name,points,decided_picks,total_picks",
      order: "points.desc,display_name.asc"
    });

    const response = await fetch(`${base}/rest/v1/standings?${params}`, {
      signal: controller.signal,
      headers: {
        apikey: key,
        Authorization: `Bearer ${session.access_token}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Ranking respondeu ${response.status}`);
    }

    const rows = await response.json();
    const currentUserId = session.user.id;

    host.innerHTML = (rows || []).map((person, index) => {
      const name = person.display_name || "Jogador";
      const isYou = person.user_id === currentUserId;
      return `
        <div class="rank-row ${index === 0 ? "first" : ""} ${isYou ? "is-you" : ""}">
          <div class="rank-position">${index === 0 ? "♛" : index + 1}</div>
          <div class="rank-person">
            <div class="avatar">${escapeHtml(initials(name))}</div>
            <div>
              <div class="rank-name">${escapeHtml(name)}${isYou ? " · você" : ""}</div>
              <small>${Number(person.decided_picks || 0)} palpites decididos</small>
            </div>
          </div>
          <div class="rank-points">${Number(person.points || 0)} pts</div>
        </div>`;
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

    if (braveTitle) {
      braveTitle.textContent = rows?.length
        ? "Os destaques da rodada aparecem aqui."
        : "Ainda sem destaque nesta rodada.";
    }
  } catch (err) {
    console.error("[Bolão] Falha ao carregar ranking:", err);
    renderError(err?.name === "AbortError" ? "Tempo limite ao consultar os dados." : err?.message || "Erro inesperado.");
  } finally {
    clearTimeout(timeout);
  }
})();