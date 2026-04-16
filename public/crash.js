let running = false;
let crashed = false;
let multiplier = 1;
let interval = null;
let crashPoint = 0;

const growthSpeed = 0.02;

function byId(...ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

function setTextAny(ids, value) {
  const el = byId(...ids);
  if (el) el.textContent = value;
}

function getNumberValue(...ids) {
  const el = byId(...ids);
  if (!el) return 0;
  return Number(el.value || el.textContent || 0);
}

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

  if (!res.ok) {
    throw new Error(data.error || "Error");
  }

  return data;
}

function updateBalanceUI(value) {
  setTextAny(["balance", "saldo"], value);
}

function updateMultiplierUI(value) {
  const el = byId("crashBig", "multiplier");
  if (!el) return;

  const val = Number(value);
  el.textContent = val.toFixed(2) + "x";

  // 🎨 COLORES DINÁMICOS
  if (val < 1.5) {
    el.style.color = "#ffffff"; // blanco
  } else if (val < 2) {
    el.style.color = "#00ff88"; // verde
  } else if (val < 5) {
    el.style.color = "#00c3ff"; // azul
  } else if (val < 10) {
    el.style.color = "#ffcc00"; // amarillo
  } else {
    el.style.color = "#ff3b3b"; // rojo🔥
  }
}

function updateStatus(text) {
  setTextAny(["status", "statusLine"], text);
}

function updateButton(text, disabled) {
  const btn = byId("btnAction", "startBtn");
  if (!btn) return;
  btn.disabled = !!disabled;
  btn.textContent = text;
}

function resetGame() {
  running = false;
  crashed = false;
  multiplier = 1;
  crashPoint = 0;

  clearInterval(interval);
  interval = null;

  updateMultiplierUI(1);
  updateStatus("Esperando apuesta...");
  updateButton("🚀 Apostar", false);
}

async function refreshBalance() {
  try {
    const me = await api("/api/me");
    if (me && me.balance !== undefined) {
      updateBalanceUI(me.balance);
    }
  } catch {}
}

async function startGame() {
  if (running) return;

  const bet = Number(getNumberValue("bet"));
  if (!Number.isFinite(bet) || bet <= 0) {
    updateStatus("Poné una apuesta válida");
    return;
  }

  try {
    const res = await api("/api/crash/start", {
      method: "POST",
      body: JSON.stringify({ amount: bet })
    });

    if (!res.success) {
      updateStatus(res.error || "Error");
      return;
    }

    running = true;
    crashed = false;
    multiplier = 1;
    crashPoint = Number(res.crashPoint || 0);

    updateBalanceUI(res.balance);
    updateStatus("Corriendo...");
    updateButton("💰 Retirar", false);
    updateMultiplierUI(1);

    clearInterval(interval);
    interval = setInterval(() => {
      if (!running) return;

      multiplier += growthSpeed;
      updateMultiplierUI(multiplier);

      if (crashPoint && multiplier >= crashPoint) {
        crashGame();
      }
    }, 50);
  } catch (err) {
    updateStatus(err.message || "Error");
  }
}

async function cashOut() {
  if (!running || crashed) return;

  try {
    const res = await api("/api/crash/cashout", {
      method: "POST"
    });

    clearInterval(interval);
    interval = null;

    if (!res.success) {
      crashed = true;
      running = false;

      updateStatus("💥 CRASH en " + Number(res.crashPoint || crashPoint || multiplier).toFixed(2) + "x");
      await api("/api/crash/crash", { method: "POST" }).catch(() => {});
      await refreshBalance();

      setTimeout(resetGame, 1500);
      return;
    }

    updateBalanceUI(res.balance);
    updateStatus("💰 Cobraste " + res.win);
    updateMultiplierUI(res.cashoutMultiplier || multiplier);

    setTimeout(resetGame, 1200);
  } catch (err) {
    clearInterval(interval);
    interval = null;
    crashed = true;
    running = false;

    updateStatus(err.message || "Error");
    await api("/api/crash/crash", { method: "POST" }).catch(() => {});
    await refreshBalance();

    setTimeout(resetGame, 1500);
  }
}

async function crashGame() {
  if (crashed) return;

  crashed = true;
  running = false;

  clearInterval(interval);
  interval = null;

  updateStatus("💥 CRASH en " + multiplier.toFixed(2) + "x");
  updateButton("🚀 Apostar", true);

  await api("/api/crash/crash", { method: "POST" }).catch(() => {});
  await refreshBalance();

  setTimeout(resetGame, 1500);
}

function action() {
  if (!running) {
    startGame();
  } else {
    cashOut();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const btn = byId("btnAction", "startBtn");
  if (btn) btn.onclick = action;

  try {
    await refreshBalance();

    const state = await api("/api/crash/state");
    if (state && state.active) {
      running = true;
      crashed = false;
      crashPoint = Number(state.crashPoint || 0);
      multiplier = Number(state.currentMultiplier || 1);

      updateMultiplierUI(multiplier);
      updateStatus("Ronda activa. Podés cashout.");
      updateButton("💰 Retirar", false);

      clearInterval(interval);
      interval = setInterval(() => {
        if (!running) return;

        multiplier += growthSpeed;
        updateMultiplierUI(multiplier);

        if (crashPoint && multiplier >= crashPoint) {
          crashGame();
        }
      }, 50);
    } else {
      resetGame();
    }
  } catch {
    resetGame();
  }
});

function startRound() {
  startGame();
}
window.startRound = startRound;
window.cashOut = cashOut;
window.action = action;