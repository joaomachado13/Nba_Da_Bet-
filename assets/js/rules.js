(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.BolaoRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function computeLockAt(games) {
    const starts = (games || []).map(g => new Date(g.start_at).getTime()).filter(Number.isFinite);
    return starts.length ? new Date(Math.min(...starts)) : null;
  }

  function isRoundLocked(lockAt, now = new Date()) {
    return Boolean(lockAt && now.getTime() >= new Date(lockAt).getTime());
  }

  function progress(games, picks) {
    const total = (games || []).length;
    const done = (games || []).filter(g => Boolean((picks || {})[g.id])).length;
    return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  function localDateKey(date, timeZone = "America/Sao_Paulo") {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric", month: "2-digit", day: "2-digit", timeZone
    }).formatToParts(new Date(date));
    const bag = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${bag.year}-${bag.month}-${bag.day}`;
  }

  function roundDateKey(date = new Date(), timeZone = "America/Sao_Paulo", rolloverHour = 6) {
    const shifted = new Date(new Date(date).getTime() - rolloverHour * 3600000);
    return localDateKey(shifted, timeZone);
  }

  return { computeLockAt, isRoundLocked, progress, localDateKey, roundDateKey };
});
