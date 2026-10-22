(async function () {
  const supabase = window.APP_SUPABASE;

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function showToast(message) {
    const toast = document.querySelector("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  if (!supabase) {
    showToast("Não foi possível carregar as estatísticas.");
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    location.replace("login.html");
    return;
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || user.is_anonymous) {
    await supabase.auth.signOut();
    location.replace("login.html");
    return;
  }

  try {
    const [{ data: standing }, { count: submitted }, { data: ranking }] = await Promise.all([
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
        .order("display_name", { ascending: true })
    ]);

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
  } catch (error) {
    console.error("[Bolão] Estatísticas:", error);
    showToast("Falha ao carregar as estatísticas.");
  }
})();