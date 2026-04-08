async function api(path, options = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

async function loadCasino() {
  const me = await api("/api/me");
  const info = await api("/api/game-info");

  document.getElementById("welcome").textContent = `Bienvenido ${me.username}`;
  document.getElementById("balance").textContent = me.balance;
  document.getElementById("multiplier").textContent = info.multiplier;

  // mostrar acceso admin si corresponde
  if (me.role === "admin") {
    document.getElementById("adminCard").style.display = "block";
  }
}

async function logout() {
  localStorage.clear();
  try {
    await api("/api/logout", { method: "POST" });
  } catch {}
  window.location.href = "/";
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadCasino();
  } catch {
    localStorage.clear();
    window.location.href = "/";
  }
});