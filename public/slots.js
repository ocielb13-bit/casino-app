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

let playing = false;
let saldoActual = 0;
let freeSpins = 0;
let freeBank = 0;
let jackpotBank = 1000;
let currentTheme = "asian";

function symbolSrc(symbol) {
  return `/assets/symbols/asian/${symbol}.png`;
}

function setCell(id, symbol) {
  const img = document.getElementById("img-" + id);
  if (img) img.src = symbolSrc(symbol);
}

function renderBoard(board) {
  board.forEach((row, rIndex) => {
    row.forEach((symbol, cIndex) => {
      setCell(`c${rIndex + 1}_${cIndex}`, symbol);
    });
  });
}

function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

function showBalance() {
  setText("saldo", saldoActual);
  setText("freeLine", freeSpins);
  setText("bankLine", freeBank);
  setText("jackpotLine", jackpotBank);
}

function randomSymbol() {
  const arr = ["dragon", "goldpot", "coin", "jade", "lantern", "wild", "scatter"];
  return arr[Math.floor(Math.random() * arr.length)];
}

async function animateRow(rowIds, duration) {
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      rowIds.forEach((id) => setCell(id, randomSymbol()));
    }, 70);

    setTimeout(() => {
      clearInterval(timer);
      resolve();
    }, duration);
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

function playSound(id) {
  const audio = document.getElementById(id);
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {}
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
  setText("rtpLine", info.slot_rtp || 96);
  showBalance();
}

function initialBoard() {
  return [
    ["dragon", "coin", "jade", "lantern", "wild"],
    ["coin", "jade", "dragon", "goldpot", "scatter"],
    ["dragon", "dragon", "coin", "jade", "lantern"]
  ];
}

async function jugar() {
  if (playing) return;
  playing = true;

  try {
    const apuesta = parseInt(document.getElementById("apuesta").value, 10);
    if (!Number.isInteger(apuesta) || apuesta <= 0) {
      setText("resultado", "Apuesta inválida");
      return;
    }

    document.getElementById("spinBtn").disabled = true;
    resetReels();
    setText("resultado", "Girando...");
    setText("detallePago", "");
    setText("bonusHint", "");

    const res = await api("/api/slots/spin", {
      method: "POST",
      body: JSON.stringify({ amount: apuesta, theme: currentTheme })
    });

    await Promise.all([
      animateRow(ROW_IDS[0], 650),
      animateRow(ROW_IDS[1], 850),
      animateRow(ROW_IDS[2], 1050)
    ]);

    renderBoard(res.board);

    saldoActual = Number(res.balance || saldoActual);
    freeSpins = Number(res.freeSpins || 0);
    freeBank = Number(res.freeSpinBank || 0);
    jackpotBank = Number(res.jackpotBank || jackpotBank);

    showBalance();

    if (Array.isArray(res.paylines)) {
      res.paylines.forEach((line) => {
        highlightCells(line.ids, line.tier || "win-mid");
      });
      setText(
        "detallePago",
        res.paylines.length
          ? res.paylines.map((p) => `${p.label} +${p.amount}`).join(" • ")
          : "Sin línea ganadora"
      );
    }

    if (res.scatterCount === 2) {
      setText("bonusHint", "✨ Hay 2 scatters. Falta 1 para free spins.");
      highlightCells(res.scatterCells, "scatter-hint");
    } else if (res.freeSpinsAwarded > 0) {
      setText("bonusHint", `🌀 Free spins activados (+${res.freeSpinsAwarded}).`);
      highlightCells(res.scatterCells, "free-hint");
    }

    if (res.freeSpinBankPaid > 0) {
      setText("resultado", `🎉 Cobro de free spins: ${res.freeSpinBankPaid}`);
      playSound("winSound");
    } else if (res.win > 0) {
      setText("resultado", `🎉 Ganaste ${res.win}`);
      playSound("winSound");
    } else {
      setText("resultado", "😢 Sin premio");
    }

    document.getElementById("spinBtn").disabled = false;
  } catch (err) {
    setText("resultado", "❌ " + err.message);
    document.getElementById("spinBtn").disabled = false;
  }

  playing = false;
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadSession();
    renderBoard(initialBoard());
  } catch {
    localStorage.removeItem("token");
    window.location.href = "/";
  }
});