const basePath = "/assets/symbols/asian/";

// =========================
// 🎮 ESTADO DEL JUEGO
// =========================
let saldoActual = 0;
let currentBet = 100;
let spinning = false;
let spinTimer = null;

// =========================
// 🎰 CONFIG SLOT
// =========================
const COLS = 5;
const ROWS = 3;

const spinWeights = [
  { symbol: "coin.png", weight: 24 },
  { symbol: "jade.png", weight: 20 },
  { symbol: "lantern.png", weight: 18 },
  { symbol: "goldpot.png", weight: 12 },
  { symbol: "dragon.png", weight: 8 },
  { symbol: "wild.png", weight: 5 },
  { symbol: "scatter.png", weight: 3 }
];

// =========================
// 🎲 RANDOM
// =========================
function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;

  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.symbol;
  }

  return items[items.length - 1].symbol;
}

function randomSymbol() {
  return weightedPick(spinWeights);
}

function randomBoard() {
  return Array.from({ length: COLS }, () =>
    Array.from({ length: ROWS }, () => randomSymbol())
  );
}

// =========================
// 🌐 API
// =========================
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

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/";
    return null;
  }

  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

// =========================
// 🧩 UI HELPERS
// =========================
const byId = (id) => document.getElementById(id);

function setText(id, val) {
  const el = byId(id);
  if (el) el.textContent = val;
}

function updateBetUI() {
  setText("bet", currentBet);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =========================
// 🎰 GRID
// =========================
function setCell(col, row, symbol) {
  const img = byId(`r${col}c${row}`);
  if (img) img.src = basePath + symbol;
}

function setGrid(board) {
  if (!Array.isArray(board) || board.length !== COLS) return;

  for (let c = 0; c < COLS; c++) {
    if (!Array.isArray(board[c])) continue;

    for (let r = 0; r < ROWS; r++) {
      if (board[c][r]) setCell(c, r, board[c][r]);
    }
  }
}

// =========================
// 🎥 SPIN FX
// =========================
function startSpinFX() {
  stopSpinFX();

  document.querySelectorAll(".reel").forEach((reel) => {
    reel.classList.add("spinning");
  });

  spinTimer = setInterval(() => {
    document.querySelectorAll(".reel img").forEach((img) => {
      img.src = basePath + randomSymbol();
    });
  }, 50);
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

async function spinColumn(col, finalBoard) {
  const cycles = 10 + col * 4;

  for (let i = 0; i < cycles; i++) {
    for (let r = 0; r < ROWS; r++) {
      setCell(col, r, randomSymbol());
    }
    await delay(i < 5 ? 25 : 40);
  }

  for (let r = 0; r < ROWS; r++) {
    const el = byId(`r${col}c${r}`);
    if (el) el.classList.add("reveal");
    setCell(col, r, finalBoard[col][r]);
    await delay(70);
  }
}

async function spinVisual(board) {
  startSpinFX();

  for (let c = 0; c < COLS; c++) {
    await spinColumn(c, board);
  }

  stopSpinFX();
}

// =========================
// 🎨 CANVAS PAYLINES
// =========================
function setupCanvas() {
  const canvas = byId("paylineCanvas");
  const wrap = document.querySelector(".slot-wrapper");

  if (!canvas || !wrap) return;

  const rect = wrap.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width));
  canvas.height = Math.max(1, Math.floor(rect.height));
}

function getCellCenter(col, row) {
  const el = byId(`r${col}c${row}`);
  const wrap = document.querySelector(".slot-wrapper");

  if (!el || !wrap) return { x: 0, y: 0 };

  const r1 = el.getBoundingClientRect();
  const r2 = wrap.getBoundingClientRect();

  return {
    x: r1.left - r2.left + r1.width / 2,
    y: r1.top - r2.top + r1.height / 2
  };
}

function clearCanvas() {
  const canvas = byId("paylineCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function normalizePaylineLine(lineObj) {
  if (!lineObj || typeof lineObj !== "object") return null;

  if (Array.isArray(lineObj.line)) return lineObj.line;
  if (Array.isArray(lineObj.path)) return lineObj.path;
  if (Array.isArray(lineObj.rows)) return lineObj.rows;

  return null;
}

function drawPayline(line, color) {
  if (!Array.isArray(line) || line.length !== COLS) return;

  const canvas = byId("paylineCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  ctx.beginPath();
  ctx.lineWidth = 6;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.globalAlpha = 0.95;

  line.forEach((row, col) => {
    const p = getCellCenter(col, row);
    if (col === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });

  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

async function animatePaylines(paylines) {
  if (!Array.isArray(paylines) || paylines.length === 0) return;

  const colors = ["gold", "cyan", "lime", "magenta", "orange", "#65d9ff", "#f3d77a"];

  for (let i = 0; i < paylines.length; i++) {
    const lineObj = paylines[i];
    const line = normalizePaylineLine(lineObj);
    if (!line) continue;

    clearCanvas();
    drawPayline(line, colors[i % colors.length]);

    setText(
      "detallePago",
      `💥 Línea ${lineObj.lineNumber} paga ${lineObj.payout}`
    );

    await delay(900);
  }

  await delay(250);
  clearCanvas();
}

// =========================
// 🎮 GAMEPLAY
// =========================
async function jugar() {
  if (spinning) return;

  spinning = true;
  setText("resultado", "Girando...");

  const btn = byId("btnSpin");
  if (btn) btn.disabled = true;

  try {
    const res = await api("/api/slots/spin", {
      method: "POST",
      body: JSON.stringify({ amount: currentBet })
    });

    // ✅ ACÁ recién podés usar res
    const betPerLine = currentBet / 25;

    const board = res.board || randomBoard();
    await spinVisual(board);

    saldoActual = res.balance;
    setText("saldo", saldoActual);

    await animatePaylines(res.paylines || []);

    if (res.win > 0) {
      setText("resultado", `🔥 Ganaste ${res.win}`);
    } else {
      setText("resultado", "❌ Perdiste");
    }

  } catch (e) {
    console.error(e);
    setText("resultado", "Error");
  }

  spinning = false;
  if (btn) btn.disabled = false;
}

// =========================
// 🔧 BET CONTROLS
// =========================
function changeBet(amount) {
  currentBet += Number(amount || 0);

  if (currentBet < 10) currentBet = 10;
  if (currentBet > 10000) currentBet = 10000;

  updateBetUI();
}

// =========================
// ⚙️ INIT
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const me = await api("/api/me");
    if (!me) return;

    saldoActual = Number(me.balance || 0);
    setText("saldo", saldoActual);
    updateBetUI();

    setGrid(randomBoard());

    requestAnimationFrame(() => {
      setupCanvas();
      clearCanvas();
    });
  } catch {
    localStorage.removeItem("token");
    window.location.href = "/";
  }
});

window.addEventListener("resize", () => {
  setupCanvas();
  clearCanvas();
});

window.jugar = jugar;
window.changeBet = changeBet;