(() => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animate = (element, frames, options) => {
    if (element && !motion.matches && element.animate) return element.animate(frames, options);
  };
  window.BolaoUI = {
    finishLoading(element) {
      element?.classList.remove('is-loading');
      element?.setAttribute('aria-busy', 'false');
    },
    feedback(element) {
      animate(element, [{ transform: 'scale(1)' }, { transform: 'scale(1.025)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
    }
  };

  const icons = [
    '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
    '<path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 13v6m-4 2h8m-6-2h4"/>',
    '<path d="M4 20V10m8 10V4m8 16v-7"/>',
    '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  ];
  document.querySelectorAll('.bottom-nav .nav-item').forEach((link, index) => {
    const icon = link.querySelector('span');
    if (icon) icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[index % 4]}</svg>`;
  });
  document.querySelectorAll('nav a.active').forEach(link => link.setAttribute('aria-current', 'page'));
  document.querySelectorAll('.invite-button__icon').forEach(icon => {
    icon.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V3m-4 4 4-4 4 4M5 12v8h14v-8"/></svg>';
  });
  const main = document.querySelector('main');
  if (main) {
    main.id ||= 'conteudo';
    main.tabIndex = -1;
    const skip = document.createElement('a');
    skip.href = '#' + main.id;
    skip.className = 'skip-link';
    skip.textContent = 'Pular para o conteúdo';
    document.body.prepend(skip);
  }

  // Animate each list only on its first real render, never on polling or a saved pick.
  for (const id of ['gamesList', 'leaderboard', 'communityRounds']) {
    const host = document.getElementById(id);
    if (!host) continue;
    const reveal = () => {
      const items = host.querySelectorAll('.game-card:not(.loading-card), .rank-row, .community-round');
      if (!items.length) return false;
      [...items].slice(0, 8).forEach((item, index) => animate(item,
        [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 340, delay: index * 45, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' }));
      return true;
    };
    if (!reveal()) {
      const observer = new MutationObserver(() => { if (reveal()) observer.disconnect(); });
      observer.observe(host, { childList: true });
    }
  }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-retry]')) location.reload();
  });
})();
