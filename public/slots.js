const basePath = "/assets/symbols/asian/";

let saldoActual = 0;
let currentBet = 100;
let spinning = false;
let spinTimer = null;

const spinSymbols = [
  "coin.png",
  "dragon.png",
  "goldpot.png",
  "jade.png",
  "lantern.png",
  "scatter.png",
  "wild.png"
];

async function api(path, options = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {})
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

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function updateBetUI() {
  setText("bet", currentBet);
  setText("betDisplay", currentBet);
}

function setGrid(board) {
  if (!Array.isArray(board) || board.length !== 5) return;

  for (let col = 0; col < 5; col++) {
    if (!Array.isArray(board[col])) continue;

    for (let row = 0; row < 3; row++) {
      const img = document.getElementById(`r${col}c${row}`);
      if (img && board[col][row]) {
        img.src = basePath + board[col][row];
      }
    }
  }
}

function randomBoard() {
  return Array.from({ length: 5 }, () =>
    Array.from({ length: 3 }, () => spinSymbols[Math.floor(Math.random() * spinSymbols.length)])
  );
}

function clearWinEffects() {
  document.querySelectorAll(".reel").forEach((el) => {
    el.classList.remove("win-line");
    el.classList.remove("win-high");
    el.classList.remove("win-jackpot");
  });
}

function startSpinFX() {
  stopSpinFX();

  document.querySelectorAll(".reel").forEach((reel) => {
    reel.classList.add("spinning");
  });

  spinTimer = setInterval(() => {
    document.querySelectorAll(".reel img").forEach((img) => {
      img.src = basePath + spinSymbols[Math.floor(Math.random() * spinSymbols.length)];
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

function changeBet(amount) {
  currentBet += amount;

  if (currentBet < 10) currentBet = 10;
  if (currentBet > 10000) currentBet = 10000;

  updateBetUI();
}

function highlightWinLines(paylines) {
  clearWinEffects();

  (paylines || []).forEach((line) => {
    for (let col = 0; col <= line.count - 1; col++) {
      const cell = document.getElementById(`r${col}c${line.row}`);
      if (cell && cell.parentElement) {
        cell.parentElement.classList.add("win-line");
      }
    }
  });
}

function showResult(text, cls) {
  const result = document.getElementById("resultado");
  if (!result) return;
  result.className = cls || "";
  result.textContent = text;
}

async function spinVisual(finalBoard) {
  startSpinFX();

  for (let col = 0; col < 5; col++) {
    await new Promise((resolve) => {
      let ticks = 0;
      const interval = setInterval(() => {
        ticks++;
        if (ticks > 10 + col * 4) {
          clearInterval(interval);

          for (let row = 0; row < 3; row++) {
            const img = document.getElementById(`r${col}c${row}`);
            if (img && finalBoard[col] && finalBoard[col][row]) {
              img.src = basePath + finalBoard[col][row];
              img.style.transform = "scale(1)";
            }
          }

          resolve();
          return;
        }

        for (let row = 0; row < 3; row++) {
          const img = document.getElementById(`r${col}c${row}`);
          if (img) {
            img.style.transform = "scale(1.08)";
          }
        }
      }, 60);
    });
  }

  stopSpinFX();
}

async function jugar() {
  if (spinning) return;
  spinning = true;
  clearWinEffects();
  showResult("Girando...", "");

  const btn = document.getElementById("btnSpin");
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
    saldoActual = Number(me.balance || 0);
    setText("saldo", saldoActual);
    updateBetUI();

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