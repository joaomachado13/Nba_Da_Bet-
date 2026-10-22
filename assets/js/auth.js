(function () {
  const ROOM_CODE = "1322";
  const supabase = window.APP_SUPABASE;

  const joinForm = document.querySelector("#loginForm");
  const recoveryForm = document.querySelector("#recoveryForm");
  const nameInput = document.querySelector("#playerName");
  const emailInput = document.querySelector("#playerEmail");
  const codeInput = document.querySelector("#roomCode");
  const recoveryEmail = document.querySelector("#recoveryEmail");
  const recoveryCode = document.querySelector("#recoveryCode");
  const submitButton = joinForm?.querySelector('button[type="submit"]');
  const recoveryButton = recoveryForm?.querySelector('button[type="submit"]');
  const showRecoveryButton = document.querySelector("#showRecovery");
  const hideRecoveryButton = document.querySelector("#hideRecovery");
  const toast = document.querySelector("#toast");
  const existing = document.querySelector("#existingPlayer");
  const existingName = document.querySelector("#existingPlayerName");
  const existingEmail = document.querySelector("#existingPlayerEmail");
  const continueButton = document.querySelector("#continuePlayer");
  const switchButton = document.querySelector("#switchPlayer");
  const entryTitle = document.querySelector("#entryTitle");
  const entryCopy = document.querySelector("#entryCopy");

  let currentSession = null;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function cleanName(value) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, 24);
  }

  function cleanEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function validRoomCode(value) {
    return String(value || "").trim() === ROOM_CODE;
  }

  function makeRandomPassword() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const raw = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
    return `NBA!${raw}aA1`;
  }

  function setJoinBusy(busy) {
    if (!submitButton) return;
    submitButton.disabled = busy;
    submitButton.textContent = busy ? "Entrando…" : "Entrar no bolão";
  }

  function setRecoveryBusy(busy) {
    if (!recoveryButton) return;
    recoveryButton.disabled = busy;
    recoveryButton.textContent = busy ? "Enviando…" : "Enviar acesso por e-mail";
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

  function showExistingPlayer(name, email) {
    existing.hidden = false;
    joinForm.hidden = true;
    recoveryForm.hidden = true;
    if (existingName) existingName.textContent = name;
    if (existingEmail) existingEmail.textContent = email || "";
    if (entryTitle) entryTitle.textContent = "Seu jogador está salvo";
    if (entryCopy) entryCopy.textContent = "Você já está conectado neste aparelho.";
  }

  function showJoinForm({ completingAnonymous = false, name = "" } = {}) {
    existing.hidden = true;
    recoveryForm.hidden = true;
    joinForm.hidden = false;
    if (name && nameInput) nameInput.value = name;

    if (completingAnonymous) {
      if (entryTitle) entryTitle.textContent = "Complete seu acesso";
      if (entryCopy) entryCopy.textContent = "Adicione seu e-mail uma vez para poder recuperar este jogador em outro navegador.";
    } else {
      if (entryTitle) entryTitle.textContent = "Entrar no bolão";
      if (entryCopy) entryCopy.textContent = "Seu acesso fica salvo neste aparelho. O e-mail serve para recuperar o mesmo jogador em outro navegador.";
    }

    nameInput?.focus();
  }

  function showRecoveryForm(prefillEmail = "") {
    existing.hidden = true;
    joinForm.hidden = true;
    recoveryForm.hidden = false;
    if (prefillEmail && recoveryEmail) recoveryEmail.value = prefillEmail;
    if (entryTitle) entryTitle.textContent = "Acessar meu jogador";
    if (entryCopy) entryCopy.textContent = "Use o mesmo e-mail da primeira entrada. Você recebe um link de acesso e este navegador fica conectado.";
    recoveryEmail?.focus();
  }

  async function ensureProfile(userId, displayName) {
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: displayName }, { onConflict: "id" });

    if (error) console.warn("Não foi possível atualizar o perfil:", error);
  }

  function looksLikeExistingAccount(error, data) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("already registered") || message.includes("already exists")) return true;
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return true;
    return false;
  }

  async function joinBolao(event) {
    event.preventDefault();

    if (!supabase) {
      showToast("Não foi possível conectar ao bolão.");
      return;
    }

    const name = cleanName(nameInput?.value);
    const email = cleanEmail(emailInput?.value);
    const code = String(codeInput?.value || "").trim();

    if (name.length < 2) {
      showToast("Digite seu nome.");
      nameInput?.focus();
      return;
    }

    if (!email || !email.includes("@")) {
      showToast("Digite um e-mail válido.");
      emailInput?.focus();
      return;
    }

    if (!validRoomCode(code)) {
      showToast("Código da sala incorreto.");
      codeInput?.select();
      return;
    }

    setJoinBusy(true);

    try {
      // Usuários anônimos antigos eram apenas a fase de protótipo.
      // Como ainda não havia palpites acumulados, saímos da sessão anônima
      // antes de criar a conta permanente por e-mail.
      if (currentSession?.user?.is_anonymous) {
        await supabase.auth.signOut();
        currentSession = null;
      }

      const password = makeRandomPassword();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name }
        }
      });

      if (looksLikeExistingAccount(error, data)) {
        showToast("Esse e-mail já tem jogador. Use “acessar em outro aparelho”.");
        showRecoveryForm(email);
        return;
      }

      if (error) throw error;

      if (!data?.session?.user) {
        showToast("A confirmação de e-mail ainda está ligada no Supabase. Desative para entrar direto.");
        return;
      }

      await ensureProfile(data.session.user.id, name);
      location.replace("index.html");
    } catch (error) {
      console.error(error);
      showToast("Não foi possível criar seu acesso agora.");
    } finally {
      setJoinBusy(false);
    }
  }

  async function recoverAccess(event) {
    event.preventDefault();

    if (!supabase) {
      showToast("Não foi possível conectar ao bolão.");
      return;
    }

    const email = cleanEmail(recoveryEmail?.value);
    const code = String(recoveryCode?.value || "").trim();

    if (!email || !email.includes("@")) {
      showToast("Digite seu e-mail.");
      recoveryEmail?.focus();
      return;
    }

    if (!validRoomCode(code)) {
      showToast("Código da sala incorreto.");
      recoveryCode?.select();
      return;
    }

    setRecoveryBusy(true);

    try {
      if (currentSession) {
        await supabase.auth.signOut();
        currentSession = null;
      }

      const redirectTo = new URL("index.html", location.href).href;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: redirectTo
        }
      });

      if (error) throw error;

      showToast("Acesso enviado. Abra o e-mail neste aparelho e toque no link.");
    } catch (error) {
      console.error(error);
      showToast("Não foi possível enviar o acesso. Confira o e-mail informado.");
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function init() {
    if (!supabase) {
      showToast("Supabase não carregou.");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    currentSession = session;

    if (session?.user && !session.user.is_anonymous) {
      currentSession = session;
      const name = await getDisplayName(session.user);
      showExistingPlayer(name, session.user.email);
    } else if (session?.user?.is_anonymous) {
      const name = await getDisplayName(session.user);
      showJoinForm({ completingAnonymous: true, name });
    } else {
      showJoinForm();
    }

    joinForm?.addEventListener("submit", joinBolao);
    recoveryForm?.addEventListener("submit", recoverAccess);

    showRecoveryButton?.addEventListener("click", () => {
      showRecoveryForm(cleanEmail(emailInput?.value));
    });

    hideRecoveryButton?.addEventListener("click", () => showJoinForm());

    continueButton?.addEventListener("click", () => location.replace("index.html"));

    switchButton?.addEventListener("click", async () => {
      switchButton.disabled = true;
      await supabase.auth.signOut();
      currentSession = null;
      switchButton.disabled = false;
      if (nameInput) nameInput.value = "";
      if (emailInput) emailInput.value = "";
      if (codeInput) codeInput.value = "";
      showJoinForm();
    });
  }

  init().catch(error => {
    console.error("[Bolão] Falha na tela de acesso:", error);
    showToast("Falha ao iniciar o acesso.");
  });
})();