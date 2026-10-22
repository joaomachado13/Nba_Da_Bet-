(function () {
  const ROOM_CODE = "1322";
  const supabase = window.APP_SUPABASE;
  const form = document.querySelector("#loginForm");
  const emailInput = document.querySelector("#playerEmail");
  const codeInput = document.querySelector("#roomCode");
  const submitButton = form?.querySelector('button[type="submit"]');
  const toast = document.querySelector("#toast");

  function roomPassword(code) {
    return `BolaoNBA-${code}!`;
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function cleanEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function setBusy(busy) {
    if (!submitButton) return;
    submitButton.disabled = busy;
    submitButton.textContent = busy ? "Entrando…" : "Entrar";
  }

  async function login(event) {
    event.preventDefault();

    if (!supabase) {
      showToast("Não foi possível conectar ao bolão.");
      return;
    }

    const email = cleanEmail(emailInput?.value);
    const code = String(codeInput?.value || "").trim();

    if (!email || !email.includes("@")) {
      showToast("Digite o e-mail cadastrado.");
      emailInput?.focus();
      return;
    }

    if (code !== ROOM_CODE) {
      showToast("Senha da sala incorreta.");
      codeInput?.select();
      return;
    }

    setBusy(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: roomPassword(code)
      });

      if (error || !data?.session) {
        console.warn("[Bolão] Login:", error);
        showToast("Este acesso ainda não foi atualizado. Abra o bolão uma vez no aparelho onde você já estava conectado e tente novamente.");
        return;
      }

      location.replace("index.html");
    } catch (error) {
      console.error("[Bolão] Login:", error);
      showToast("Não foi possível entrar agora.");
    } finally {
      setBusy(false);
    }
  }

  async function init() {
    if (!supabase) {
      showToast("Supabase não carregou.");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user && !session.user.is_anonymous) {
      location.replace("index.html");
      return;
    }

    form?.addEventListener("submit", login);
    emailInput?.focus();
  }

  init().catch(error => {
    console.error("[Bolão] Falha na tela de login:", error);
    showToast("Falha ao iniciar o acesso.");
  });
})();