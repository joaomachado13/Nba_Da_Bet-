(() => {
  const fallback = 'index.html';
  // Prefetch only internal HTML destinations; never interfere with auth or forms.
  const prefetched = new Set();
  const prefetch = (href) => {
    try {
      const url = new URL(href, location.href);
      if (url.origin !== location.origin || !url.pathname.endsWith(".html") || url.pathname === location.pathname || prefetched.has(url.href)) return;
      prefetched.add(url.href);
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "document";
      link.href = url.href;
      document.head.appendChild(link);
    } catch (_) {}
  };
  document.addEventListener("pointerover", (event) => {
    const anchor = event.target.closest?.("a[href]");
    if (anchor) prefetch(anchor.href);
  }, {passive:true});
  document.addEventListener("focusin", (event) => {
    const anchor = event.target.closest?.("a[href]");
    if (anchor) prefetch(anchor.href);
  });
  const commonPages = ["index.html", "ranking.html", "estatisticas.html", "mais.html", "historico.html"];
  const warmNavigation = () => commonPages.forEach(page => prefetch(page));
  if ("requestIdleCallback" in window) window.requestIdleCallback(warmNavigation, {timeout:2500});
  else window.addEventListener("load", warmNavigation, {once:true});

  document.querySelectorAll('[data-back]').forEach((button) => {
    button.addEventListener('click', () => {
      // Se a página foi aberta a partir de outra tela do bolão, respeita o histórico.
      // Se foi aberta diretamente (favorito/URL), volta para Palpites.
      if (window.history.length > 1 && document.referrer) {
        window.history.back();
        return;
      }

      window.location.href = fallback;
    });
  });
})();
