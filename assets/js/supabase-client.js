(function () {
  const cfg = window.APP_CONFIG || {};
  const canConnect = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY && window.supabase?.createClient);

  window.APP_SUPABASE = canConnect
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      })
    : null;

  window.APP_DEMO_MODE = !canConnect;

  // One in-flight season read per document, scoped to the current authenticated user.
  // Do not persist predictions or share them across accounts in a browser cache.
  let seasonRequest = null;
  let seasonUserId = null;
  window.loadBolaoSeasonData = function (userId) {
    if (seasonRequest && seasonUserId === userId) return seasonRequest;
    seasonUserId = userId;
    seasonRequest = Promise.all([
      window.APP_SUPABASE.from("profiles").select("id,display_name"),
      window.APP_SUPABASE.from("games").select("id,round_date,start_at,status,away_team_code,home_team_code,away_score,home_score").neq("status", "cancelled").order("start_at"),
      window.APP_SUPABASE.from("predictions").select("user_id,game_id,picked_team_code")
    ]).then(([profiles, games, predictions]) => {
      if (profiles.error || games.error || predictions.error) throw profiles.error || games.error || predictions.error;
      return { profiles: profiles.data || [], games: games.data || [], predictions: predictions.data || [] };
    }).catch(error => {
      seasonRequest = null;
      throw error;
    });
    return seasonRequest;
  };
})();
