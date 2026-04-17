const basePath = "/assets/symbols/asian/";

// =========================
// 🎮 ESTADO DEL JUEGO
// =========================
let saldoActual = 0;
let currentBet = 100;
let spinning = false;
let spinTimer = null;

// =========================
// 🎰 CONFIG SLOT (ESCALABLE)
// =========================
const COLS = 5;
const ROWS = 3;

// Probabilidades (ajustable fácil)
const spinWeights = [
  { symbol: "coin.png", weight: 24 },
  { symbol: "jade.png", weight: 20 },
  { symbol: "lantern.png", weight: 18 },
  { symbol: "goldpot.png", weight: 12 },
  { symbol: "dragon.png", weight: 8 },   // 🔥 ALTO PAGO
  { symbol: "wild.png", weight: 5 },     // comodín
  { symbol: "scatter.png", weight: 3 }   // 🎁 FREE SPIN
];

// =========================
// 🎲 RANDOM INTELIGENTE
// =========================
function weightedPick(items) {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
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
      ...(token && { Authorization: "Bearer " + token })
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

// =========================
// 🎰 GRID
// =========================
function setCell(col, row, symbol) {
  const img = byId(`r${col}c${row}`);
  if (img) img.src = basePath + symbol;
}

function setGrid(board) {
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      setCell(c, r, board[c][r]);
    }
  }
}

// =========================
// 🎥 ANIMACIÓN SPIN PRO
// =========================
function startSpinFX() {
  stopSpinFX();

  document.querySelectorAll(".reel").forEach(r =>
    r.classList.add("spinning")
  );

  spinTimer = setInterval(() => {
    document.querySelectorAll(".reel img").forEach(img => {
      img.src = basePath + randomSymbol();
    });
  }, 50);
}

function stopSpinFX() {
  clearInterval(spinTimer);
  spinTimer = null;

  document.querySelectorAll(".reel").forEach(r =>
    r.classList.remove("spinning")
  );
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
    el.classList.add("reveal");
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
// 🎨 CANVAS PAYLINES PRO
// =========================
function setupCanvas() {
  const canvas = byId("paylineCanvas");
  const wrap = document.querySelector(".slot-wrapper");

  if (!canvas || !wrap) return;

  const rect = wrap.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

function getCellCenter(col, row) {
  const el = byId(`r${col}c${row}`);
  const wrap = document.querySelector(".slot-wrapper");

  const r1 = el.getBoundingClientRect();
  const r2 = wrap.getBoundingClientRect();

  return {
    x: r1.left - r2.left + r1.width / 2,
    y: r1.top - r2.top + r1.height / 2
  };
}

function drawPayline(line, color) {
  const canvas = byId("paylineCanvas");
  const ctx = canvas.getContext("2d");

  ctx.beginPath();
  ctx.lineWidth = 6;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;

  line.forEach((row, col) => {
    const p = getCellCenter(col, row);
    col === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  });

  ctx.stroke();
  ctx.shadowBlur = 0;
}

function clearCanvas() {
  const c = byId("paylineCanvas");
  if (!c) return;
  c.getContext("2d").clearRect(0, 0, c.width, c.height);
}

async function animatePaylines(paylines) {
  const colors = ["gold", "cyan", "lime", "magenta", "orange"];

  for (let i = 0; i < paylines.length; i++) {
    clearCanvas();
    drawPayline(paylines[i].line, colors[i % colors.length]);

    setText("detallePago",
      `💥 Línea ${paylines[i].lineNumber} paga ${paylines[i].payout}`
    );

    await delay(900);
  }

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
betPerLine = res.betPerLine || (currentBet / 25);
    });

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
// ⚙️ INIT
// =========================
function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

document.addEventListener("DOMContentLoaded", async () => {
  const me = await api("/api/me");
  if (!me) return;

  saldoActual = me.balance;
  setText("saldo", saldoActual);

  setGrid(randomBoard());

  requestAnimationFrame(() => {
    setupCanvas();
  });
});

window.addEventListener("resize", () => {
  setupCanvas();
  clearCanvas();
});

window.jugar = jugar;