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

let history = [];

function saveHistory() {
  localStorage.setItem("rouletteHistory", JSON.stringify(history.slice(0, 5)));
}

function loadHistory() {
  try {
    history = JSON.parse(localStorage.getItem("rouletteHistory") || "[]");
    if (!Array.isArray(history)) history = [];
  } catch {
    history = [];
  }
  renderHistory();
}

function renderHistory() {
  const box = document.getElementById("history");
  if (!box) return;

  box.innerHTML = "";
  history.slice(0, 5).forEach((item) => {
    const el = document.createElement("div");
    el.className = `history-item ${item.win > 0 ? "win" : "lose"}`;
    el.textContent = `${item.result}${item.win > 0 ? ` +${item.win}` : ""}`;
    box.appendChild(el);
  });
}

function addHistory(result, win) {
  history.unshift({ result, win });
  history = history.slice(0, 5);
  saveHistory();
  renderHistory();
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
    localStorage.removeItem("token");
    window.location.href = "/";
  }
}

function animateWheel(finalNumber) {
  return new Promise((resolve) => {
    const wheel = document.getElementById("wheel");
    wheel.classList.add("spinning");

    let count = 0;
    const timer = setInterval(() => {
      wheel.textContent = Math.floor(Math.random() * 37);
      count += 1;

      if (count >= 18) {
        clearInterval(timer);
        wheel.classList.remove("spinning");
        wheel.textContent = finalNumber;
        resolve();
      }
    }, 55);
  });
}

async function jugar() {
  try {
    const numero = parseInt(document.getElementById("numero").value, 10);
    const apuesta = parseInt(document.getElementById("apuesta").value, 10);
    const resultado = document.getElementById("resultado");

    if (!Number.isInteger(numero) || numero < 0 || numero > 36) {
      resultado.textContent = "Elegí un número entre 0 y 36.";
      return;
    }

    if (!Number.isInteger(apuesta) || apuesta <= 0) {
      resultado.textContent = "Poné una apuesta válida.";
      return;
    }

    resultado.textContent = "Girando...";

    const data = await api("/api/roulette/spin", {
      method: "POST",
      body: JSON.stringify({ number: numero, amount: apuesta })
    });

    await animateWheel(data.result);

    document.getElementById("saldo").textContent = data.balance;

    if (data.win > 0) {
      resultado.textContent = `🎉 Salió ${data.result}. Ganaste ${data.win}.`;
    } else {
      resultado.textContent = `😢 Salió ${data.result}. Perdiste.`;
    }

    addHistory(data.result, data.win);
  } catch (err) {
    document.getElementById("resultado").textContent = "❌ " + err.message;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  loadHistory();
  await loadMe();
});