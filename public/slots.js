const basePath = "/assets/symbols/asian/";

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
    return;
  }

  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

function byId(id) {
  return document.getElementById(id);
}

function setText(id, val) {
  const el = byId(id);
  if (el) el.textContent = val;
}

function updateBetUI() {
  setText("bet", currentBet);
  setText("betDisplay", currentBet);
}

function setCell(col, row, symbol) {
  const img = byId(`r${col}c${row}`);
  if (img && symbol) {
    img.src = basePath + symbol;
  }
}

function setGrid(board) {
  if (!Array.isArray(board) || board.length !== 5) return;

  for (let col = 0; col < 5; col++) {
    if (!Array.isArray(board[col])) continue;

    for (let row = 0; row < 3; row++) {
      const symbol = board[col][row];
      if (symbol) setCell(col, row, symbol);
    }
  }
}

function randomBoard() {
  return Array.from({ length: 5 }, () =>
    Array.from({ length: 3 }, () => randomSymbol())
  );
}

function clearWinEffects() {
  document.querySelectorAll(".reel").forEach((el) => {
    el.classList.remove("win-low", "win-high", "win-jackpot", "line-win", "win-line", "reveal");
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
  }, 55);
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
  currentBet += amount;

  if (currentBet < 10) currentBet = 10;
  if (currentBet > 10000) currentBet = 10000;

  updateBetUI();
}

function formatPaylineSummary(paylines) {
  if (!Array.isArray(paylines) || paylines.length === 0) {
    return "Sin línea ganadora";
  }

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

function highlightWinLines(paylines) {
  clearWinEffects();

  (paylines || []).forEach((line) => {
    const cls =
      line.count >= 5 ? "win-jackpot" :
      line.count === 4 ? "win-high" :
      "win-low";

    (line.cells || []).forEach((cellId) => {
      const cell = byId(cellId);
      if (cell && cell.parentElement) {
        cell.parentElement.classList.add("line-win", cls);
      }
    });
  });
}

function showResult(text, cls) {
  const result = byId("resultado");
  if (!result) return;

  result.className = cls || "";
  result.textContent = text;
}

async function spinColumnToFinal(col, finalBoard) {
  const cycles = 9 + col * 4;

  for (let tick = 0; tick < cycles; tick++) {
    for (let row = 0; row < 3; row++) {
      setCell(col, row, randomSymbol());
    }

    await new Promise((resolve) => setTimeout(resolve, tick < 4 ? 28 : 38));
  }

  for (let row = 0; row < 3; row++) {
    const img = byId(`r${col}c${row}`);
    if (img && finalBoard[col] && finalBoard[col][row]) {
      img.classList.add("reveal");
      img.src = basePath + finalBoard[col][row];
    }

    await new Promise((resolve) => setTimeout(resolve, 72));
  }
}

async function spinVisual(finalBoard) {
  startSpinFX();

  for (let col = 0; col < 5; col++) {
    await spinColumnToFinal(col, finalBoard);
  }

  stopSpinFX();
}

async function jugar() {
  if (spinning) return;

  spinning = true;
  clearWinEffects();
  clearPaylineFeed();
  showResult("Girando...", "");

  const btn = byId("btnSpin");
  if (btn) btn.disabled = true;

  try {
    const res = await api("/api/slots/spin", {
      method: "POST",
      body: JSON.stringify({ amount: currentBet })
    });

    const board = Array.isArray(res.board) ? res.board : randomBoard();
    await spinVisual(board);

    saldoActual = Number(res.balance || saldoActual);
    setText("saldo", saldoActual);
    setText("freeLine", Number(res.freeSpins || 0));

    const summary = res.winSummary || formatPaylineSummary(res.paylines || []);
    setText("detallePago", summary);
    renderPaylineFeed(res.paylines || []);

    if (res.freeSpinsAwarded > 0) {
      setText("bonusHint", `🌀 ${res.scatterCount} scatters → +${res.freeSpinsAwarded} free spins`);
      (res.scatterCells || []).forEach((cellId) => {
        const cell = byId(cellId);
        if (cell && cell.parentElement) {
          cell.parentElement.classList.add("free-hint");
        }
      });
    } else if ((res.scatterCount || 0) >= 3) {
      setText("bonusHint", `✨ ${res.scatterCount} scatters, pero el bonus no salió esta vez`);
      (res.scatterCells || []).forEach((cellId) => {
        const cell = byId(cellId);
        if (cell && cell.parentElement) {
          cell.parentElement.classList.add("scatter-hint");
        }
      });
    } else {
      setText("bonusHint", "");
    }

    highlightWinLines(res.paylines || []);

    if (res.isFreeSpin) {
      showResult("🌀 FREE SPIN!", "bonus");
    } else if (res.win > 0) {
      showResult(`🔥 Ganaste ${res.win}`, "win");
    } else {
      showResult("❌ Perdiste", "lose");
    }
  } catch (e) {
    console.error(e);
    stopSpinFX();
    showResult("Error", "lose");
  }

  if (btn) btn.disabled = false;
  spinning = false;
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const me = await api("/api/me");
    if (!me) return;

    saldoActual = Number(me.balance || 0);
    const freeSpins = Number(me.freeSpins ?? me.free_spins ?? 0);
    const freeSpinBank = Number(me.freeSpinBank ?? me.free_spin_bank ?? freeSpins);

    setText("playerLine", `Jugador: ${me.username}`);
    setText("saldo", saldoActual);
    setText("freeLine", freeSpins);
    setText("bankLine", freeSpinBank);
    updateBetUI();

    try {
      const info = await api("/api/game-info");
      if (info) {
        setText("rtpLine", Number(info.rtp || 30));
        setText("jackpotLine", Number(info.jackpot_bank || 1000));
      }
    } catch {}

    const initial = randomBoard();
    setGrid(initial);
    showResult("", "");
  } catch {
    localStorage.removeItem("token");
    window.location.href = "/";
  }
});

window.jugar = jugar;
window.changeBet = changeBet;