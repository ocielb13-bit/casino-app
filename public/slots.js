// ===== API =====
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

// ===== CONFIG =====
const basePath = "/assets/symbols/asian/";

const weights = {
  "coin.png": 30,
  "jade.png": 25,
  "lantern.png": 20,
  "goldpot.png": 10,
  "dragon.png": 8,
  "wild.png": 5,
  "scatter.png": 2
};

// ===== STATE =====
let saldoActual = 0;
let freeSpins = 0;
let freeBank = 0;
let jackpotBank = 1000;
let currentBet = 10;
let winRate = 30;
let spinning = false;

// ===== HELPERS =====
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

// ===== RANDOM CON PESO =====
function weightedRandom() {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [_, w]) => sum + w, 0);

  let rand = Math.random() * total;

  for (const [symbol, weight] of entries) {
    if (rand < weight) return symbol;
    rand -= weight;
  }

  return "coin.png";
}

// ===== RENDER =====
function setImage(col, row, symbol) {
  const img = document.getElementById(`img-c${col}_${row}`);
  if (img) {
    img.src = basePath + symbol;
  }
}

function renderRandomGrid() {
  for (let c = 1; c <= 3; c++) {
    for (let r = 0; r < 5; r++) {
      setImage(c, r, weightedRandom());
    }
  }
}

// ===== ANIMACIÓN =====
function spinAnimation() {
  return new Promise((resolve) => {
    let cycles = 0;

    const interval = setInterval(() => {
      renderRandomGrid();
      cycles++;

      if (cycles > 15) {
        clearInterval(interval);
        resolve();
      }
    }, 70);
  });
}

// ===== APUESTA =====
function changeBet(amount) {
  currentBet += amount;

  if (currentBet < 1) currentBet = 1;
  if (currentBet > saldoActual) currentBet = saldoActual;

  updateUI();
}

// ===== LOAD =====
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

    setText("playerLine", me.username);

    updateUI();
    renderRandomGrid();

  } catch (err) {
    console.error(err);
  }
}

// ===== SPIN =====
async function jugar() {
  if (spinning) return;
  spinning = true;

  try {
    await spinAnimation();

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

    // Resultado visual final
    renderRandomGrid();

    setText(
      "resultado",
      res.win > 0 ? `🔥 Ganaste ${res.win}` : "❌ Perdiste"
    );

    // ===== EFECTO GANAR =====
    if (res.win > 0) {
      document.querySelectorAll(".reel img").forEach(img => {
        img.style.transform = "scale(1.2)";
        img.style.filter = "brightness(1.5)";
      });

      setTimeout(() => {
        document.querySelectorAll(".reel img").forEach(img => {
          img.style.transform = "scale(1)";
          img.style.filter = "none";
        });
      }, 500);
    }

  } catch (err) {
    console.error(err);
  } finally {
    spinning = false;
  }
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", loadSession);