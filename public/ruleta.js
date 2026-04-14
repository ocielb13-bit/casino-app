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
let spinning = false;

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
    document.getElementById("playerLine").textContent = `Usuario: ${me.username}`;
    document.getElementById("saldo").textContent = me.balance;

    const info = await api("/api/game-info");
    document.getElementById("payoutLine").textContent = `${info.roulette_payout || 35}:1`;
  } catch {
    localStorage.removeItem("token");
    window.location.href = "/";
  }
}

function limpiar() {
  document.getElementById("numero").value = "";
  document.getElementById("apuesta").value = "";
  document.getElementById("resultado").textContent = "";
}

function animateWheel(finalNumber) {
  return new Promise((resolve) => {
    const wheel = document.getElementById("wheel");

    let duration = 2000;
    let start = null;
    let frame = 0;

    function spin(timestamp) {
      if (!start) start = timestamp;
      const progress = timestamp - start;

      wheel.classList.add("spinning");
      wheel.textContent = Math.floor(Math.random() * 37);
      wheel.style.transform = `rotate(${progress * 0.45}deg) scale(${1 + Math.sin(progress / 70) * 0.01})`;

      frame += 1;

      if (progress < duration) {
        requestAnimationFrame(spin);
      } else {
        wheel.textContent = finalNumber;
        wheel.style.transform = "rotate(0deg)";
        wheel.classList.remove("spinning");
        resolve();
      }
    }

    requestAnimationFrame(spin);
  });
}

async function jugar() {
  if (spinning) return;

  const resultado = document.getElementById("resultado");
  const btn = document.querySelector('button[onclick="jugar()"]');

  try {
    const numero = parseInt(document.getElementById("numero").value, 10);
    const apuesta = parseInt(document.getElementById("apuesta").value, 10);

    if (!Number.isInteger(numero) || numero < 0 || numero > 36) {
      resultado.textContent = "Elegí un número entre 0 y 36.";
      return;
    }

    if (!Number.isInteger(apuesta) || apuesta <= 0) {
      resultado.textContent = "Poné una apuesta válida.";
      return;
    }

    spinning = true;
    if (btn) btn.disabled = true;

    resultado.textContent = "🎡 Girando...";

    const data = await api("/api/roulette/spin", {
      method: "POST",
      body: JSON.stringify({
        number: numero,
        amount: apuesta
      })
    });

    await animateWheel(data.result);

    document.getElementById("saldo").textContent = data.balance;

    if (data.win > 0) {
      resultado.textContent = `🎉 Salió ${data.result}. Ganaste ${data.win}`;
      resultado.className = "win";
    } else {
      resultado.textContent = `😢 Salió ${data.result}. Perdiste`;
      resultado.className = "lose";
    }

    addHistory(data.result, data.win);
  } catch (err) {
    resultado.textContent = "❌ " + err.message;
  } finally {
    spinning = false;
    if (btn) btn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  loadHistory();
  await loadMe();
});