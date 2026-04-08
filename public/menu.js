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

async function loadMe() {
  try {
    const me = await api("/api/me");
    if (me.role === "admin") {
      window.location.href = "/admin.html";
      return;
    }

    document.getElementById("playerLine").textContent = `Usuario: ${me.username}`;
    document.getElementById("balanceLine").textContent = me.balance;
    document.getElementById("freeLine").textContent = me.free_spins || 0;
    document.getElementById("bankLine").textContent = me.free_spin_bank || 0;
  } catch {
    localStorage.removeItem("token");
    window.location.href = "/";
  }
}

async function logout() {
  localStorage.removeItem("token");
  try { await api("/api/logout", { method: "POST" }); } catch {}
  window.location.href = "/";
}

document.addEventListener("DOMContentLoaded", loadMe);