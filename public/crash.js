const CRASH_GROWTH_PER_SECOND = 0.45;

let crashState = {
  active: false,
  startedAt: 0,
  crashPoint: 0,
  bet: 0,
  raf: null
};

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

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function currentMultiplierAt(startedAt) {
  const elapsed = Date.now() - startedAt;
  return Number((1 + (elapsed / 1000) * CRASH_GROWTH_PER_SECOND).toFixed(2));
}

function renderCrash(mult) {
  const value = Number(mult || 1);
  setText("multiplier", `${value.toFixed(2)}x`);
  setText("crashBig", `${value.toFixed(2)}x`);
}

function setButtons(active) {
  const startBtn = document.getElementById("startBtn");
  const cashoutBtn = document.getElementById("cashoutBtn");
  const betInput = document.getElementById("bet");

  if (startBtn) startBtn.disabled = active;
  if (cashoutBtn) cashoutBtn.disabled = !active;
  if (betInput) betInput.disabled = active;
}

function stopLoop() {
  if (crashState.raf) {
    cancelAnimationFrame(crashState.raf);
    crashState.raf = null;
  }
}

function tick() {
  if (!crashState.active) return;

  const current = currentMultiplierAt(crashState.startedAt);
  renderCrash(current);

  if (current >= crashState.crashPoint) {
    crashState.active = false;
    stopLoop();
    setButtons(false);
    setText("statusLine", `💥 Se estrelló en x${crashState.crashPoint.toFixed(2)}`);
    setText("result", "Perdiste la apuesta");
    renderCrash(crashState.crashPoint);
    return;
  }

  crashState.raf = requestAnimationFrame(tick);
}

function resumeRound(state) {
  crashState = {
    active: true,
    startedAt: state.startedAt,
    crashPoint: state.crashPoint,
    bet: state.bet,
    raf: null
  };

  setButtons(true);
  setText("statusLine", "Ronda activa. Podés cashout.");
  setText("result", "");
  renderCrash(state.currentMultiplier || 1);
  stopLoop();
  crashState.raf = requestAnimationFrame(tick);
}

async function loadMe() {
  const me = await api("/api/me");
  if (!me) return;

  setText("playerLine", me.username);
  setText("saldo", me.balance);
}

async function loadState() {
  try {
    const state = await api("/api/crash/state");
    if (!state) return;

    if (state.active) {
      resumeRound(state);
    } else {
      crashState.active = false;
      stopLoop();
      setButtons(false);
      setText("statusLine", "Listo para empezar.");
      setText("result", "");
      renderCrash(1);
    }
  } catch (err) {
    console.error(err);
  }
}

async function startRound() {
  if (crashState.active) return;

  try {
    const bet = Number(document.getElementById("bet").value || 100);

    if (!Number.isFinite(bet) || bet <= 0) {
      setText("result", "Poné una apuesta válida");
      return;
    }

    const data = await api("/api/crash/start", {
      method: "POST",
      body: JSON.stringify({ amount: bet })
    });

    crashState = {
      active: true,
      startedAt: data.startedAt,
      crashPoint: data.crashPoint,
      bet: data.bet,
      raf: null
    };

    setText("saldo", data.balance);
    setText("statusLine", "Corriendo...");
    setText("result", "");
    renderCrash(1);
    setButtons(true);

    stopLoop();
    crashState.raf = requestAnimationFrame(tick);
  } catch (err) {
    setText("result", err.message || "Error");
  }
}

async function cashout() {
  if (!crashState.active) return;

  try {
    const data = await api("/api/crash/cashout", {
      method: "POST"
    });

    crashState.active = false;
    stopLoop();
    setButtons(false);

    setText("saldo", data.balance);
    setText("statusLine", `Cobraste en x${Number(data.cashoutMultiplier).toFixed(2)}`);
    setText("result", `🔥 Ganaste ${data.win}`);
    renderCrash(data.cashoutMultiplier);
  } catch (err) {
    crashState.active = false;
    stopLoop();
    setButtons(false);
    setText("result", err.message || "Crash");
    setText("statusLine", "Ronda terminada");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadMe();
    await loadState();
  } catch {
    localStorage.removeItem("token");
    window.location.href = "/";
  }
});

window.startRound = startRound;
window.cashout = cashout;