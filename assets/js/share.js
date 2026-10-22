(function () {
  const buttons = [
    document.querySelector("#shareBolaoButton"),
    document.querySelector("#shareBolaoMobile")
  ].filter(Boolean);

  if (!buttons.length) return;

  function inviteUrl() {
    return new URL("./", location.href).href;
  }

  async function copyFallback(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    }
  }

  function showToast(message) {
    const toast = document.querySelector("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  async function shareBolao() {
    const url = inviteUrl();
    const text = "Entra no Bolão NBA 🏀\nCódigo da sala: 1322";

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Bolão NBA",
          text,
          url
        });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    const copied = await copyFallback(`${text}\n${url}`);
    showToast(copied ? "Link do bolão copiado." : "Não foi possível copiar o link.");
  }

  buttons.forEach(button => button.addEventListener("click", shareBolao));
})();