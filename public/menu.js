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

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function clampInt(value, min, max) {
  const n = Math.floor(Number(value) || 0);
  return Math.max(min, Math.min(max, n));
}

async function loadMe() {
  try {
    const me = await api("/api/me");

    setText("playerLine", `Jugador: ${me.username}`);
    setText("balanceLine", me.balance);
    setText("freeLine", clampInt(me.free_spins, 0, 20));
    setText("bankLine", clampInt(me.free_spin_bank, 0, 20));
    setText("roleLine", me.role);

    if (me.role === "admin") {
      const adminCard = document.getElementById("adminCard");
      if (adminCard) adminCard.classList.remove("hidden");
    }
  } catch {
    localStorage.removeItem("token");
    window.location.href = "/";
  }
}

async function logout() {
  localStorage.removeItem("token");
  try {
    await api("/api/logout", { method: "POST" });
  } catch {}
  window.location.href = "/";
}

document.addEventListener("DOMContentLoaded", loadMe);