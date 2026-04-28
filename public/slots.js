const basePath = "/assets/symbols/asian/";

const COLS = 5;
const ROWS = 3;

let saldoActual = 0;
let currentBet = 100;
let spinning = false;
let spinTimer = null;

const spinWeights = [
  { symbol: "coin.png", weight: 24 },
  { symbol: "jade.png", weight: 20 },
  { symbol: "lantern.png", weight: 18 },
  { symbol: "goldpot.png", weight: 12 },
  { symbol: "dragon.png", weight: 8 },
  { symbol: "wild.png", weight: 5 },
  { symbol: "scatter.png", weight: 3 }
];

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

const byId = (id) => document.getElementById(id);

function setText(id, val) {
  const el = byId(id);
  if (el) el.textContent = val;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateBetUI() {
  setText("bet", currentBet);
}

function clampBet() {
  if (currentBet < 10) currentBet = 10;
  if (currentBet > 10000) currentBet = 10000;
}

function setCell(col, row, symbol) {
  const img = byId(`r${col}c${row}`);
  if (img && symbol) {
    img.src = basePath + symbol;
  }
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

function clearWinEffects() {
  document.querySelectorAll(".reel").forEach((el) => {
    el.classList.remove(
      "win-low",
      "win-high",
      "win-jackpot",
      "line-win",
      "reveal",
      "scatter-hint",
      "free-hint",
      "bonus-pulse"
    );
  });
}

function clearPaylineFeed() {
  const box = byId("paylineFeed");
  if (box) box.innerHTML = "";
}

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

function changeBet(amount) {
  currentBet += Number(amount || 0);
  clampBet();
  updateBetUI();
}

function formatPaylineSummary(paylines) {
  if (!Array.isArray(paylines) || paylines.length === 0) return "Sin línea ganadora";
  return paylines
    .map((line) => `Línea ${line.lineNumber} paga ${line.payout}`)
    .join(" ⇒ ");
}

function renderPaylineFeed(paylines) {
  const box = byId("paylineFeed");
  if (!box) return;

  box.innerHTML = "";

  if (!Array.isArray(paylines) || paylines.length === 0) {
    const empty = document.createElement("div");
    empty.className = "payline-empty";
    empty.textContent = "Sin línea ganadora";
    box.appendChild(empty);
    return;
  }

  paylines.forEach((line, index) => {
    const pill = document.createElement("span");
    pill.className = "payline-item";
    pill.textContent = `Línea ${line.lineNumber} paga ${line.payout}`;
    box.appendChild(pill);

    if (index < paylines.length - 1) {
      const arrow = document.createElement("span");
      arrow.className = "payline-arrow";
      arrow.textContent = "⇒";
      box.appendChild(arrow);
    }
  });
}

function showResult(text, cls = "") {
  const result = byId("resultado");
  if (!result) return;

  result.className = cls;
  result.textContent = text;
}

function showBonusBanner(text, active) {
  const banner = byId("bonusBanner");
  if (!banner) return;

  banner.textContent = text;
  banner.classList.toggle("is-visible", Boolean(active));
}

function updateBonusMeter(meter, chain) {
  const pct = Math.max(0, Math.min(100, Number(meter || 0)));
  const fill = byId("bonusMeterFill");
  const label = byId("bonusMeterText");
  const chainLine = byId("bonusChainLine");

  if (fill) fill.style.width = `${pct}%`;
  if (label) label.textContent = `${Math.round(pct)}%`;
  if (chainLine) chainLine.textContent = `Cadena bonus: ${Number(chain || 0)}`;
}

function highlightWinLines(paylines) {
  clearWinEffects();

  (paylines || []).forEach((line) => {
    const payout = Number(line.payout || 0);
    const cls =
      payout >= currentBet * 20 ? "win-jackpot" :
      payout >= currentBet * 8 ? "win-high" :
      "win-low";

    (line.cells || []).forEach((cellId) => {
      const cell = byId(cellId);
      if (cell && cell.parentElement) {
        cell.parentElement.classList.add("line-win", cls);
      }
    });
  });
}

async function spinColumnToFinal(col, finalBoard) {
  const cycles = 10 + col * 4;

  for (let tick = 0; tick < cycles; tick++) {
    for (let row = 0; row < ROWS; row++) {
      setCell(col, row, randomSymbol());
    }
    await delay(tick < 5 ? 25 : 40);
  }

  for (let row = 0; row < ROWS; row++) {
    const img = byId(`r${col}c${row}`);
    if (img && finalBoard[col] && finalBoard[col][row]) {
      img.classList.add("reveal");
      img.src = basePath + finalBoard[col][row];
    }
    await delay(70);
  }
}

async function spinVisual(board) {
  startSpinFX();

  for (let c = 0; c < COLS; c++) {
    await spinColumnToFinal(c, board);
  }

  stopSpinFX();
}

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
  const points = line.map((row, col) => getCellCenter(col, row));

  ctx.save();
  ctx.beginPath();
  ctx.lineWidth = 6;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.globalAlpha = 0.95;

  points.forEach((p, index) => {
    if (index === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });

  ctx.stroke();
  ctx.restore();
}

async function animatePaylines(paylines) {
  if (!Array.isArray(paylines) || paylines.length === 0) return;

  const colors = ["#FFD76A", "#00F0FF", "#34EF9A", "#FF2BD6", "#FF7B54", "#A8FF5F"];

  for (let i = 0; i < paylines.length; i++) {
    const lineObj = paylines[i];
    const line = normalizePaylineLine(lineObj);
    if (!line) continue;

    clearCanvas();
    drawPayline(line, colors[i % colors.length]);

    setText("detallePago", `💥 Línea ${lineObj.lineNumber} paga ${lineObj.payout}`);
    await delay(900);
  }

  await delay(250);
  clearCanvas();
}

function winMessage(win) {
  const amount = Number(win || 0);

  if (amount >= currentBet * 20) {
    return { text: `💎 JACKPOT ${amount}`, cls: "jackpot" };
  }

  if (amount >= currentBet * 8) {
    return { text: `🔥 BIG WIN ${amount}`, cls: "big" };
  }

  if (amount > 0) {
    return { text: `✨ Ganaste ${amount}`, cls: "win" };
  }

  return { text: "❌ Perdiste", cls: "lose" };
}

async function jugar() {
  if (spinning) return;

  spinning = true;
  clearWinEffects();
  clearPaylineFeed();
  clearCanvas();
  showResult("Girando...", "");
  showBonusBanner("MODO BONUS", false);

  const btn = byId("btnSpin");
  if (btn) btn.disabled = true;

  try {
    const res = await api("/api/slots/spin", {
      method: "POST",
      body: JSON.stringify({ amount: currentBet })
    });

    const board = Array.isArray(res?.board) ? res.board : randomBoard();
    await spinVisual(board);

    saldoActual = Number(res?.balance ?? saldoActual);
    setText("saldo", saldoActual);

    if (res?.bank !== undefined) setText("bankLine", Number(res.bank));
    if (res?.jackpot_bank !== undefined) setText("jackpotLine", Number(res.jackpot_bank));
    if (res?.freeSpins !== undefined) setText("freeLine", Number(res.freeSpins));

    updateBonusMeter(res?.bonusMeter ?? 0, res?.bonusChain ?? 0);

    if (res?.bonusMode) {
      showBonusBanner(`BONUS x${Number(res?.bonusMultiplier || 1).toFixed(2)}`, true);
    } else {
      showBonusBanner("MODO BONUS", false);
    }

    const summary = res?.winSummary || formatPaylineSummary(res?.paylines || []);
    setText("detallePago", summary);
    renderPaylineFeed(res?.paylines || []);

    if ((res?.scatterCount || 0) > 0) {
      setText(
        "bonusHint",
        `🎁 ${res.scatterCount} scatter${res.scatterCount === 1 ? "" : "s"} · +${res.freeSpinsAwarded || 0} free spins`
      );
    } else if (res?.bonusTriggered) {
      setText("bonusHint", `🌀 Bonus activado · +${res.freeSpinsAwarded || 0} free spins`);
    } else {
      setText("bonusHint", "");
    }

    highlightWinLines(res?.paylines || []);
    await animatePaylines(res?.paylines || []);

    const msg = winMessage(res?.win || 0);
    showResult(res?.isFreeSpin ? `🌀 FREE SPIN · x${Number(res?.bonusMultiplier || 1).toFixed(2)}` : msg.text, res?.isFreeSpin ? "bonus" : msg.cls);
  } catch (e) {
    console.error(e);
    showResult("Error", "lose");
  } finally {
    if (btn) btn.disabled = false;
    spinning = false;
  }
}

function updateBonusFromMe(me) {
  setText("bonusMeterLabel", `${Number(me?.bonusMeter || 0)}%`);
  setText("bonusChainLabel", Number(me?.bonusChain || 0));
  updateBonusMeter(Number(me?.bonusMeter || 0), Number(me?.bonusChain || 0));
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const me = await api("/api/me");
    if (!me) return;

    saldoActual = Number(me.balance || 0);
    setText("playerLine", `Jugador: ${me.username}`);
    setText("saldo", saldoActual);
    setText("freeLine", Number(me.freeSpins ?? 0));

    updateBonusFromMe(me);
    updateBetUI();

    try {
      const info = await api("/api/game-info");
      if (info) {
        setText("rtpLine", Number(info.rtp || 30));
        setText("jackpotLine", Number(info.jackpot_bank ?? info.bank ?? 1000));
      }
    } catch {}

    setGrid(randomBoard());

    requestAnimationFrame(() => {
      setupCanvas();
      clearCanvas();
    });

    showResult("", "");
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