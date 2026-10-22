(function () {
  const cfg = window.APP_CONFIG || {};
  const canConnect = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY && window.supabase?.createClient);

  window.APP_SUPABASE = canConnect
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY)
    : null;

  window.APP_DEMO_MODE = !canConnect;
})();
