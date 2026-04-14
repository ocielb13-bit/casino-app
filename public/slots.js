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

  if (!res.ok) {
    if (res.status === 401) {
      console.warn("Token inválido");
      localStorage.removeItem("token");
      window.location.href = "/";
      return;
    }
    throw new Error(data.error || "Error");
  }

  return data;
}

let saldoActual = 0;
let freeSpins = 0;
let freeBank = 0;
let jackpotBank = 1000;
let currentBet = 10;
let winRate = 30;

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updateUI() {
  setText("saldo", saldoActual);
  setText("betDisplay", currentBet);
  setText("freeLine", freeSpins);
  setText("bankLine", freeBank);
  setText("jackpotLine", jackpotBank);
  setText("rtpLine", winRate);
}

async function loadSession() {
  try {
    const me = await api("/api/me");
    if (!me) return;

    saldoActual = Number(me.balance || 0);
    freeSpins = Number(me.free_spins || 0);
    freeBank = Number(me.free_spin_bank || 0);

    const info = await api("/api/game-info");
    if (!info) return;

    jackpotBank = Number(info.jackpot_bank || 1000);
    winRate = Number(info.win_rate || 30);

    document.getElementById("playerLine").textContent = me.username;

    updateUI();
  } catch (err) {
    console.error(err);
  }
}

async function jugar() {
  try {
    const res = await api("/api/slots/spin", {
      method: "POST",
      body: JSON.stringify({ amount: currentBet })
    });

    if (!res) return;

    saldoActual = res.balance;
    freeSpins = res.freeSpins;
    freeBank = res.freeSpinBank;
    jackpotBank = res.jackpotBank;

    updateUI();

    document.getElementById("resultado").textContent =
      res.win > 0 ? `Ganaste ${res.win}` : "Perdiste";

  } catch (err) {
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", loadSession);