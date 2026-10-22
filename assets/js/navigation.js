(() => {
  const fallback = 'index.html';

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
