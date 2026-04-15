let spinning = false;
let history = [];

async function api(path, options = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {})
    },
    ...options
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/";
    return;
  }

  if (!res.ok) throw new Error(data.error || "Error");
  return data;
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
  renderHistory();
  localStorage.setItem("rouletteHistory", JSON.stringify(history));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem("rouletteHistory");
    history = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(history)) history = [];
  } catch {
    history = [];
  }
  renderHistory();
}

function limpiar() {
  const numero = document.getElementById("numero");
  const apuesta = document.getElementById("apuesta");
  const resultado = document.getElementById("resultado");

  if (numero) numero.value = "";
  if (apuesta) apuesta.value = "";
  if (resultado) resultado.textContent = "";
}

async function loadMe() {
  const me = await api("/api/me");
  if (!me) return;

  const playerLine = document.getElementById("playerLine");
  const saldo = document.getElementById("saldo");
  const payoutLine = document.getElementById("payoutLine");

  if (playerLine) playerLine.textContent = me.username;
  if (saldo) saldo.textContent = me.balance;

  try {
    const info = await api("/api/game-info");
    if (payoutLine) payoutLine.textContent = `${info.roulette_payout || 35}:1`;
  } catch {
    if (payoutLine) payoutLine.textContent = "35:1";
  }
}

function animateWheel(finalNumber) {
  return new Promise((resolve) => {
    const wheel = document.getElementById("wheel");
    let duration = 2200;
    let start = null;

    function spin(timestamp) {
      if (!start) start = timestamp;
      const progress = timestamp - start;

      if (wheel) {
        wheel.classList.add("spinning");
        wheel.textContent = Math.floor(Math.random() * 37);
        wheel.style.transform = `rotate(${progress * 0.45}deg) scale(${1 + Math.sin(progress / 70) * 0.01})`;
      }

      if (progress < duration) {
        requestAnimationFrame(spin);
      } else {
        if (wheel) {
          wheel.textContent = finalNumber;
          wheel.style.transform = "rotate(0deg)";
          wheel.classList.remove("spinning");
        }
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
      if (resultado) resultado.textContent = "Elegí un número entre 0 y 36.";
      return;
    }

    if (!Number.isInteger(apuesta) || apuesta <= 0) {
      if (resultado) resultado.textContent = "Poné una apuesta válida.";
      return;
    }

    spinning = true;
    if (btn) btn.disabled = true;

    if (resultado) resultado.textContent = "🎡 Girando...";

    const data = await api("/api/roulette/spin", {
      method: "POST",
      body: JSON.stringify({
        number: numero,
        amount: apuesta
      })
    });

    await animateWheel(data.result);

    const saldo = document.getElementById("saldo");
    if (saldo) saldo.textContent = data.balance;

    if (resultado) {
      if (data.win > 0) {
        resultado.textContent = `🎉 Salió ${data.result}. Ganaste ${data.win}`;
        resultado.className = "win";
      } else {
        resultado.textContent = `😢 Salió ${data.result}. Perdiste`;
        resultado.className = "lose";
      }
    }

    addHistory(data.result, data.win);
  } catch (err) {
    console.error(err);
    if (resultado) resultado.textContent = "❌ " + err.message;
  } finally {
    spinning = false;
    if (btn) btn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  loadHistory();
  await loadMe();
});

window.jugar = jugar;
window.limpiar = limpiar;