(() => {
  const installButton = document.getElementById("installPwaButton");
  const installHint = document.getElementById("installPwaHint");
  let deferredPrompt = null;
  let refreshing = false;

  const isStandalone = () =>
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;

  const isIOS = () => {
    const ua = navigator.userAgent || "";
    const touchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return /iPhone|iPad|iPod/i.test(ua) || touchMac;
  };

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 3600);
  }

  function syncInstallButton() {
    if (!installButton) return;
    if (isStandalone()) {
      installButton.hidden = true;
      return;
    }
    if (deferredPrompt) {
      installButton.hidden = false;
      if (installHint) installHint.textContent = "Instalar como aplicativo neste aparelho";
      return;
    }
    if (isIOS()) {
      installButton.hidden = false;
      if (installHint) installHint.textContent = "Safari → Compartilhar → Adicionar à Tela de Início";
      return;
    }
    installButton.hidden = true;
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    syncInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    syncInstallButton();
    showToast("NBADABET instalado neste aparelho.");
  });

  installButton?.addEventListener("click", async () => {
    if (isStandalone()) return showToast("O NBADABET já está instalado.");
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      await prompt.prompt();
      await prompt.userChoice.catch(() => null);
      syncInstallButton();
      return;
    }
    if (isIOS()) {
      showToast("No iPhone: abra no Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.");
      return;
    }
    showToast("Use a opção Instalar app ou Adicionar à tela inicial no menu do navegador.");
  });

  function ensureNetworkStatus() {
    let banner = document.getElementById("pwaNetworkStatus");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "pwaNetworkStatus";
      banner.className = "pwa-network-status";
      banner.setAttribute("role", "status");
      banner.setAttribute("aria-live", "polite");
      document.body.appendChild(banner);
    }
    const update = () => {
      const offline = !navigator.onLine;
      banner.hidden = !offline;
      banner.textContent = offline
        ? "Você está offline. Palpites e resultados não serão enviados até a conexão voltar."
        : "";
    };
    window.addEventListener("online", () => {
      update();
      showToast("Conexão restabelecida.");
    });
    window.addEventListener("offline", update);
    update();
  }

  ensureNetworkStatus();
  syncInstallButton();

  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  const hadController = Boolean(navigator.serviceWorker.controller);

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js", {
        scope: "/",
        updateViaCache: "none"
      });
      registration.update().catch(() => {});
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController || refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    } catch (error) {
      console.warn("[NBADABET] PWA indisponível:", error);
    }
  });
})();
