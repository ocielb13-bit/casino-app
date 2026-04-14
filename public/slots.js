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

  const text = await res.text();
  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Respuesta inválida del server");
  }

  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

const SYMBOL_PATH = "/assets/symbols/asian";
const SPIN_SYMBOLS = ["dragon", "goldpot", "coin", "jade", "lantern", "wild", "scatter"];
const PREVIEW_SYMBOLS = ["dragon", "goldpot", "coin", "jade", "lantern", "wild"];

let playing = false;
let spinTimer = null;

let saldoActual = 0;
let freeSpins = 0;
let freeBank = 0;
let jackpotBank = 1000;
let currentBet = 10;
let winRate = 30;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

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

function changeBet(amount) {
  currentBet = clamp(currentBet + amount, 1, Math.max(1, saldoActual));
  updateUI();
}

function fallbackSvg(symbol) {
  const safe = String(symbol).toUpperCase();

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <defs>
        <radialGradient id="g" cx="35%" cy="20%" r="80%">
          <stop offset="0%" stop-color="#2b3554"/>
          <stop offset="60%" stop-color="#0c1020"/>
          <stop offset="100%" stop-color="#060812"/>
        </radialGradient>
      </defs>
      <rect width="200" height="200" rx="24" fill="url(#g)"/>
      <text x="100" y="110" text-anchor="middle" fill="#f3d77a" font-size="22" font-family="Arial, sans-serif" font-weight="700">${safe}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function setCell(id, symbol) {
  const img = document.getElementById("img-" + id);
  if (!img) return;

  img.onerror = () => {
    img.onerror = null;
    img.src = fallbackSvg(symbol);
  };

  img.src = `${SYMBOL_PATH}/${symbol}.png`;
}

function renderBoard(board) {
  if (!Array.isArray(board)) return;

  board.forEach((row, r) => {
    row.forEach((symbol, c) => {
      setCell(`c${r + 1}_${c}`, symbol);
    });
  });
}

function clearMarks() {
  document.querySelectorAll(".reel").forEach((reel) => {
    reel.classList.remove("win-low", "win-high", "win-jackpot", "scatter-hint", "free-hint");
  });
}

function markCells(ids, className) {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add(className);
  });
}

function randomSymbol() {
  return SPIN_SYMBOLS[Math.floor(Math.random() * SPIN_SYMBOLS.length)];
}

function startSpinFX() {
  stopSpinFX();

  document.querySelectorAll(".reel").forEach((r) => r.classList.add("spinning"));

  spinTimer = setInterval(() => {
    document.querySelectorAll(".reel img").forEach((img) => {
      img.src = fallbackSvg(randomSymbol());
    });
  }, 70);
}

function stopSpinFX() {
  if (spinTimer) {
    clearInterval(spinTimer);
    spinTimer = null;
  }

  document.querySelectorAll(".reel").forEach((r) => r.classList.remove("spinning"));
}

function spawnCoins(amount) {
  const total = Math.min(Math.floor(Number(amount) || 0), 15);

  for (let i = 0; i < total; i++) {
    const coin = document.createElement("div");
    coin.className = "coin";
    coin.textContent = "💰";
    coin.style.left = `${Math.random() * 100}%`;
    coin.style.animationDelay = `${Math.random() * 0.3}s`;
    document.body.appendChild(coin);

    setTimeout(() => coin.remove(), 1200);
  }
}

function showMessage(text, kind = "") {
  const el = document.getElementById("resultado");
  if (!el) return;
  el.className = kind;
  el.textContent = text;
}

function buildPreviewBoard() {
  return Array.from({ length: 3 }, () =>
    Array.from({ length: 5 }, () => PREVIEW_SYMBOLS[Math.floor(Math.random() * PREVIEW_SYMBOLS.length)])
  );
}

async function loadSession() {
  const me = await api("/api/me");

  saldoActual = Number(me.balance || 0);
  freeSpins = clamp(Number(me.free_spins || 0), 0, 20);
  freeBank = clamp(Number(me.free_spin_bank || 0), 0, 20);

  const info = await api("/api/game-info");
  jackpotBank = Number(info.jackpot_bank || 1000);
  winRate = Number(info.win_rate || 30);

  document.getElementById("playerLine").textContent = me.username;
  updateUI();
}

async function jugar() {
  if (playing) return;

  const btn = document.getElementById("spinBtn");
  const resultado = document.getElementById("resultado");
  const detallePago = document.getElementById("detallePago");
  const bonusHint = document.getElementById("bonusHint");

  const bet = Math.floor(Number(currentBet));
  if (!Number.isFinite(bet) || bet <= 0) {
    showMessage("Apuesta inválida", "lose");
    return;
  }

  if (bet > saldoActual && freeSpins <= 0) {
    showMessage("Saldo insuficiente", "lose");
    return;
  }

  playing = true;
  btn.disabled = true;
  clearMarks();
  showMessage("Girando...", "");
  detallePago.textContent = "";
  bonusHint.textContent = "";

  try {
    startSpinFX();

    const res = await api("/api/slots/spin", {
      method: "POST",
      body: JSON.stringify({ amount: bet })
    });

    stopSpinFX();

    const board = res.board || res.data?.board;
    if (!Array.isArray(board)) {
      throw new Error("El servidor no devolvió el tablero");
    }

    renderBoard(board);

    saldoActual = Number(res.balance ?? saldoActual);
    freeSpins = clamp(Number(res.freeSpins ?? 0), 0, 20);
    freeBank = clamp(Number(res.freeSpinBank ?? 0), 0, 20);
    jackpotBank = Number(res.jackpotBank ?? jackpotBank);

    updateUI();

    if (Array.isArray(res.paylines) && res.paylines.length > 0) {
      detallePago.textContent = res.paylines
        .map((p) => `${p.label} +${p.amount}`)
        .join(" • ");

      res.paylines.forEach((line) => {
        const cls =
          line.tier === "win-jackpot"
            ? "win-jackpot"
            : line.tier === "win-high"
            ? "win-high"
            : "win-low";

        markCells(line.ids || [], cls);
      });
    } else {
      detallePago.textContent = "Sin línea ganadora";
    }

    if (res.scatterCount >= 3) {
      if (res.freeSpinsAwarded > 0) {
        bonusHint.textContent = `🌀 Bonus activado: +${res.freeSpinsAwarded} free spins`;
        markCells(res.scatterCells || [], "free-hint");
      } else {
        bonusHint.textContent = "✨ Tres scatters, pero el bonus no salió esta vez";
        markCells(res.scatterCells || [], "scatter-hint");
      }
    }

    const win = Number(res.win || 0);

    if (win > 0) {
      showMessage(`🎉 Ganaste ${win}`, "win");
      spawnCoins(win);
    } else {
      showMessage("😢 Sin premio", "lose");
    }
  } catch (err) {
    stopSpinFX();
    showMessage(err.message || "Error", "lose");
  }

  btn.disabled = false;
  playing = false;
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadSession();
    renderBoard(buildPreviewBoard());
  } catch {
    localStorage.removeItem("token");
    window.location.href = "/";
  }
});