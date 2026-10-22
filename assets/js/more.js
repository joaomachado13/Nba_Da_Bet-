(async function () {
  const supabase = window.APP_SUPABASE;
  const toast = document.querySelector("#toast");

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  if (!supabase) {
    showToast("Não foi possível carregar sua conta.");
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    location.replace("login.html");
    return;
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || user.is_anonymous) {
    await supabase.auth.signOut();
    location.replace("login.html");
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const name = profile?.display_name || user.user_metadata?.display_name || "Jogador";
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();

  document.getElementById("accountName").textContent = name;
  document.getElementById("accountEmail").textContent = user.email || "";
  document.getElementById("accountAvatar").textContent = initials || "J";

  document.getElementById("copyRoomCode")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("1322");
      showToast("Código 1322 copiado.");
    } catch {
      showToast("Código da sala: 1322");
    }
  });

  document.getElementById("recoverInfo")?.addEventListener("click", () => {
    showToast("Em outro aparelho, escolha “Já joguei” e use este mesmo e-mail.");
  });

  document.getElementById("logoutButton")?.addEventListener("click", async () => {
    const button = document.getElementById("logoutButton");
    button.disabled = true;
    await supabase.auth.signOut();
    location.replace("login.html");
  });
})();