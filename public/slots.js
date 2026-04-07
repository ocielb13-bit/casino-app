// slots.js - Asian Dragon visual, sin pagos por frontend

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  let data = {};
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    throw new Error(data.error || "Error");
  }

  return data;
}

const CELL_IDS = {
  top: ["tr1", "tr2", "tr3"],
  row1: ["c1_0", "c1_1", "c1_2", "c1_3", "c1_4"],
  row2: ["c2_0", "c2_1", "c2_2", "c2_3", "c2_4"],
  bottom: ["br1", "br2", "br3"]
};

const SYMBOLS = ["dragon", "goldpot", "coin", "jade", "lantern", "wild", "scatter"];

let playing = false;
let saldoActual = 0;
let username = "";
let jackpotAcumulado = 1000;
let freeSpinsRestantes = 0;
let freeSpinBank = 0;

function symbolSrc(symbolId) {
  return `/assets/symbols/asian/${symbolId}.png`;
}

function randomSymbol() {
  const weights = [
    ...Array(14).fill("dragon"),
    ...Array(12).fill("goldpot"),
    ...Array(18).fill("coin"),
    ...Array(18).fill("jade"),
    ...Array(16).fill("lantern"),
    ...Array(7).fill("wild"),
    ...Array(3).fill("scatter")
  ];
  return weights[Math.floor(Math.random() * weights.length)];
}

function setCell(id, symbolId) {
  const img = document.getElementById(`img-${id}`);
  if (!img) return;
  img.src = symbolSrc(symbolId);
  img.alt = symbolId;
}

function renderBoard(board) {
  Object.keys(board).forEach((id) => setCell(id, board[id]));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function showBalance() {
  setText("saldo", saldoActual);
  setText("freeLine", freeSpinsRestantes);
  setText("bankLine", freeSpinBank);
  setText("jackpotLine", jackpotAcumulado);
}

function resetHighlights() {
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

function clearInfo() {
  setText("resultado", "");
  setText("detallePago", "");
  setText("bonusHint", "");
}

function initialBoard() {
  const board = {};
  [...CELL_IDS.top, ...CELL_IDS.row1, ...CELL_IDS.row2, ...CELL_IDS.bottom].forEach((id) => {
    board[id] = randomSymbol();
  });
  return board;
}

async function loadSession() {
  const me = await api("/api/me");

  if (me.role === "admin") {
    window.location.href = "/admin.html";
    return;
  }

  username = me.username;
  saldoActual = Number(me.balance || 0);
  freeSpinsRestantes = Number(me.free_spins || 0);
  freeSpinBank = Number(me.free_spin_bank || 0);

  setText("playerLine", `Usuario: ${username}`);
  showBalance();
}

async function animateGroup(cellIds, finalMap, duration, tick) {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      cellIds.forEach((cellId) => {
        setCell(cellId, randomSymbol());
      });
    }, tick);

    setTimeout(() => {
      clearInterval(interval);
      cellIds.forEach((cellId) => {
        setCell(cellId, finalMap[cellId]);
      });
      resolve(true);
    }, duration);
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

function applyOutcome(res) {
  saldoActual = Number(res.balance || saldoActual);
  freeSpinsRestantes = Number(res.freeSpinsRemaining || 0);
  freeSpinBank = Number(res.freeSpinBank || 0);
  jackpotAcumulado = Number(res.jackpotBank || jackpotAcumulado);

  showBalance();

  if (res.spinWinRaw > 0) {
    setText("resultado", `🎉 Ganaste ${res.spinWinRaw}`);
    playSound("winSound");
  } else {
    setText("resultado", "😢 Sin premio");
  }

  if (res.creditedNow > 0) {
    setText("detallePago", `Saldo agregado: ${res.creditedNow}`);
  } else {
    setText("detallePago", "Sin pago");
  }

  if (res.scatterCount === 2) {
    setText("bonusHint", "✨ Hay 2 scatters. Falta 1 para free spins.");
    highlightCells(res.scatterCells, "scatter-hint");
  } else if (res.freeSpinsAwarded > 0) {
    setText("bonusHint", `🌀 Free spins activados (+${res.freeSpinsAwarded}).`);
    highlightCells(res.scatterCells, "free-hint");
  } else {
    setText("bonusHint", "");
  }

  if (Array.isArray(res.paylines)) {
    res.paylines.forEach((line) => {
      highlightCells(line.ids, line.tier || "win-mid");
    });

    if (res.paylines.length > 0) {
      setText(
        "detallePago",
        res.paylines.map((p) => `${p.label} +${p.amount}`).join(" • ")
      );
    }
  }
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

    const spinBtn = document.getElementById("spinBtn");
    spinBtn.disabled = true;

    resetHighlights();
    clearInfo();

    const res = await api("/api/slots/spin", {
      method: "POST",
      body: JSON.stringify({
        amount: apuesta,
        theme: "asian"
      })
    });

    // animación por grupos, no por casillas sueltas
    await Promise.all([
      animateGroup(CELL_IDS.top, res.board, 650, 60),
      animateGroup(CELL_IDS.row1, res.board, 850, 60),
      animateGroup(CELL_IDS.row2, res.board, 980, 60),
      animateGroup(CELL_IDS.bottom, res.board, 760, 60)
    ]);

    renderBoard(res.board);
    applyOutcome(res);
  } catch (err) {
    setText("resultado", "❌ " + err.message);
  } finally {
    document.getElementById("spinBtn").disabled = false;
    playing = false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadSession();
    renderBoard(initialBoard());
  } catch {
    window.location.href = "/";
  }
});