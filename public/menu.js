// menu.js - muestra usuario y saldo, navega a los juegos

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  let data = {};
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    throw new Error(data.error || "Error");
  }

  return data;
}

function go(page) {
  window.location.href = `/${page}.html`;
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
    window.location.href = "/";
  }
}

async function logout() {
  await api("/api/logout", { method: "POST" });
  window.location.href = "/";
}

document.addEventListener("DOMContentLoaded", loadMe);