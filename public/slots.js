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

const ROW_IDS = [
  ["c1_0", "c1_1", "c1_2", "c1_3", "c1_4"],
  ["c2_0", "c2_1", "c2_2", "c2_3", "c2_4"],
  ["c3_0", "c3_1", "c3_2", "c3_3", "c3_4"]
];

const SYMBOLS = ["dragon", "goldpot", "coin", "jade", "lantern", "wild", "scatter"];
const SYMBOL_LABELS = {
  dragon: "DRAGON",
  goldpot: "POT",
  coin: "COIN",
  jade: "JADE",
  lantern: "LANTERN",
  wild: "WILD",
  scatter: "BONUS"
};

const SYMBOL_PATH = "/asset/symbol/asian";

let playing = false;
let spinTimer = null;
let saldoActual = 0;
let freeSpins = 0;
let freeBank = 0;
let jackpotBank = 1000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function symbolLabel(symbol) {
  return SYMBOL_LABELS[symbol] || symbol.toUpperCase();
}

function fallbackSvg(symbol) {
  const label = symbolLabel(symbol);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <defs>
        <radialGradient id="g" cx="30%" cy="20%" r="90%">
          <stop offset="0%" stop-color="#2d3a59"/>
          <stop offset="55%" stop-color="#111827"/>
          <stop offset="100%" stop-color="#070a12"/>
        </radialGradient>
      </defs>
      <rect width="200" height="200" rx="28" fill="url(#g)"/>
      <circle cx="100" cy="100" r="74" fill="none" stroke="#f3d77a" stroke-opacity="0.35" stroke-width="4"/>
      <text x="100" y="109" text-anchor="middle" fill="#f3d77a" font-size="28" font-family="Arial, sans-serif" font-weight="700">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

function setCell(id, symbol) {
  const img = document.getElementById("img-" + id);
  if (!img) return;

  img.alt = symbolLabel(symbol);
  delete img.dataset.fallbackApplied;
  img.onerror = () => {
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = "1";
    img.src = fallbackSvg(symbol);
  };
  img.src = `${SYMBOL_PATH}/${symbol}.png`;
}

function renderBoard(board) {
  board.forEach((row, rIndex) => {
    row.forEach((symbol, cIndex) => {
      setCell(`c${rIndex + 1}_${cIndex}`, symbol);
    });
  });
}

function resetReels() {
  document.querySelectorAll(".reel").forEach((el) => {
    el.className = "reel";
  });
}

function highlightCells(ids, className) {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add(className);
  });
}

function showBalance() {
  setText("saldo", saldoActual);
  setText("freeLine", freeSpins);
  setText("bankLine", freeBank);
  setText("jackpotLine", jackpotBank);
}

function startSpinFX() {
  stopSpinFX();
  document.querySelectorAll(".reel").forEach((reel) => {
    reel.classList.add("spinning");
  });

  spinTimer = setInterval(() => {
    document.querySelectorAll(".reel img").forEach((img) => {
      const symbol = randomSymbol();
      img.alt = symbolLabel(symbol);
      img.src = fallbackSvg(symbol);
    });
  }, 70);
}

function stopSpinFX() {
  if (spinTimer) {
    clearInterval(spinTimer);
    spinTimer = null;
  }
  document.querySelectorAll(".reel").forEach((reel) => {
    reel.classList.remove("spinning");
  });
}

function initialBoard() {
  return [
    ["dragon", "coin", "jade", "lantern", "wild"],
    ["coin", "jade", "dragon", "goldpot", "scatter"],
    ["dragon", "dragon", "coin", "jade", "lantern"]
  ];
}

async function loadSession() {
  const me = await api("/api/me");

  if (me.role === "admin") {
    window.location.href = "/admin.html";
    return;
  }

  saldoActual = Number(me.balance || 0);
  freeSpins = Number(me.free_spins || 0);
  freeBank = Number(me.free_spin_bank || 0);

  const info = await api("/api/game-info");
  jackpotBank = Number(info.jackpot_bank || 1000);

  document.getElementById("playerLine").textContent = me.username;
  setText("rtpLine", 96);
  showBalance();
}

function setMessage(text, type = "") {
  const el = document.getElementById("resultado");
  if (!el) return;
  el.textContent = text;
  el.dataset.type = type;
}

async function jugar() {
  if (playing) return;

  const btn = document.getElementById("spinBtn");
  const input = document.getElementById("apuesta");
  const apuesta = parseInt(input.value, 10);

  if (!Number.isInteger(apuesta) || apuesta <= 0) {
    setMessage("Apuesta inválida", "error");
    return;
  }

  playing = true;
  btn.disabled = true;
  resetReels();
  setMessage("Girando...", "loading");
  setText("detallePago", "");
  setText("bonusHint", "");

  try {
    startSpinFX();

    const [res] = await Promise.all([
      api("/api/slots/spin", {
        method: "POST",
        body: JSON.stringify({ amount: apuesta })
      }),
      wait(1100)
    ]);

    stopSpinFX();
    renderBoard(res.board);

    saldoActual = Number(res.balance || saldoActual);
    freeSpins = Number(res.freeSpins || 0);
    freeBank = Number(res.freeSpinBank || 0);
    jackpotBank = Number(res.jackpotBank || jackpotBank);

    showBalance();

    if (Array.isArray(res.paylines) && res.paylines.length > 0) {
      res.paylines.forEach((line) => {
        highlightCells(line.ids, line.tier || "win-mid");
      });
      setText(
        "detallePago",
        res.paylines.map((p) => `${p.label} +${p.amount}`).join(" • ")
      );
    } else {
      setText("detallePago", "Sin línea ganadora");
    }

    if (res.scatterCount === 2) {
      setText("bonusHint", "✨ Hay 2 scatters. Falta 1 para free spins.");
      highlightCells(res.scatterCells, "scatter-hint");
    } else if (res.freeSpinsAwarded > 0) {
      setText("bonusHint", `🌀 Free spins activados (+${res.freeSpinsAwarded}).`);
      highlightCells(res.scatterCells, "free-hint");
    }

    if (res.win > 0) {
      setMessage(`🎉 Ganaste ${res.win}`, "win");
    } else {
      setMessage("😢 Sin premio", "lose");
    }

    input.value = "";
  } catch (err) {
    stopSpinFX();
    setMessage("❌ " + err.message, "error");
  } finally {
    btn.disabled = false;
    playing = false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const input = document.getElementById("apuesta");
    if (input) input.value = "";

    await loadSession();
    renderBoard(initialBoard());

    input?.addEventListener("input", () => {
      input.value = input.value.replace(/[^\d]/g, "");
    });
  } catch {
    localStorage.removeItem("token");
    window.location.href = "/";
  }
});

window.addEventListener("pageshow", () => {
  const input = document.getElementById("apuesta");
  if (input) input.value = "";
});