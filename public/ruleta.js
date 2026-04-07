// ruleta.js - ruleta simple conectada al saldo real

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

async function loadMe() {
  try {
    const me = await api("/api/me");
    if (me.role === "admin") {
      window.location.href = "/admin.html";
      return;
    }

    document.getElementById("playerLine").textContent = `Usuario: ${me.username}`;
    document.getElementById("saldo").textContent = me.balance;
  } catch {
    window.location.href = "/";
  }
}

async function jugar() {
  try {
    const numero = parseInt(document.getElementById("numero").value, 10);
    const apuesta = parseInt(document.getElementById("apuesta").value, 10);

    if (!Number.isInteger(numero) || numero < 0 || numero > 36) {
      document.getElementById("resultado").textContent = "Elegí un número entre 0 y 36.";
      return;
    }

    if (!Number.isInteger(apuesta) || apuesta <= 0) {
      document.getElementById("resultado").textContent = "Poné una apuesta válida.";
      return;
    }

    const res = await api("/api/roulette/spin", {
      method: "POST",
      body: JSON.stringify({ number: numero, amount: apuesta })
    });

    document.getElementById("saldo").textContent = res.balance;

    document.getElementById("resultado").textContent =
      res.win > 0
        ? `🎉 Salió ${res.result}. Ganaste ${res.win}.`
        : `😢 Salió ${res.result}. Perdiste.`;
  } catch (err) {
    document.getElementById("resultado").textContent = "❌ " + err.message;
  }
}

document.addEventListener("DOMContentLoaded", loadMe);