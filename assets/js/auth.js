(function () {
  const ROOM_CODE = "1322";
  const supabase = window.APP_SUPABASE;
  const form = document.querySelector("#loginForm");
  const nameInput = document.querySelector("#playerName");
  const codeInput = document.querySelector("#roomCode");
  const submitButton = form?.querySelector('button[type="submit"]');
  const toast = document.querySelector("#toast");
  const existing = document.querySelector("#existingPlayer");
  const existingName = document.querySelector("#existingPlayerName");
  const continueButton = document.querySelector("#continuePlayer");
  const switchButton = document.querySelector("#switchPlayer");

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function setBusy(busy) {
    if (!submitButton) return;
    submitButton.disabled = busy;
    submitButton.textContent = busy ? "Entrando…" : "Entrar no bolão";
  }

  function cleanName(value) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, 24);
  }

  async function getDisplayName(user) {
    if (!user || !supabase) return "";
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    return data?.display_name || user.user_metadata?.display_name || "Jogador";
  }

  function showExistingPlayer(name) {
    if (!existing || !form) return;
    existing.hidden = false;
    form.hidden = true;
    if (existingName) existingName.textContent = name;
  }

  function showJoinForm() {
    if (!existing || !form) return;
    existing.hidden = true;
    form.hidden = false;
    nameInput?.focus();
  }

  async function joinBolao(event) {
    event.preventDefault();
    if (!supabase) {
      showToast("Não foi possível conectar ao bolão.");
      return;
    }

    const name = cleanName(nameInput?.value);
    const code = String(codeInput?.value || "").trim();

    if (name.length < 2) {
      showToast("Digite seu nome.");
      nameInput?.focus();
      return;
    }

    if (code !== ROOM_CODE) {
      showToast("Código da sala incorreto.");
      codeInput?.select();
      return;
    }

    setBusy(true);

    const { data, error } = await supabase.auth.signInAnonymously({
      options: {
        data: { display_name: name }
      }
    });

    if (error || !data?.user) {
      setBusy(false);
      console.error(error);
      const message = String(error?.message || "");
      if (/anonymous/i.test(message) && /disabled|not enabled/i.test(message)) {
        showToast("Entrada sem e-mail ainda não está habilitada no Supabase.");
      } else {
        showToast("Não foi possível entrar agora.");
      }
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: data.user.id,
        display_name: name
      }, { onConflict: "id" });

    if (profileError) {
      console.warn("Perfil será lido pelos metadados da sessão:", profileError);
    }

    location.replace("index.html");
  }

  async function init() {
    if (!supabase) {
      showToast("Supabase não carregou.");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const name = await getDisplayName(session.user);
      showExistingPlayer(name);
    } else {
      showJoinForm();
    }

    form?.addEventListener("submit", joinBolao);
    continueButton?.addEventListener("click", () => location.replace("index.html"));

    switchButton?.addEventListener("click", async () => {
      switchButton.disabled = true;
      await supabase.auth.signOut();
      switchButton.disabled = false;
      if (nameInput) nameInput.value = "";
      if (codeInput) codeInput.value = "";
      showJoinForm();
    });
  }

  init();
})();