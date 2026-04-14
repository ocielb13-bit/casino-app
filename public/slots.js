const basePath = "/assets/symbols/asian/";

const symbols = [
  "coin.png",
  "jade.png",
  "lantern.png",
  "goldpot.png",
  "dragon.png",
  "wild.png",
  "scatter.png"
];

let saldoActual = 0;
let currentBet = 10;
let spinning = false;

// ===== API =====
async function api(path, options = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {})
    },
    ...options
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/";
    return;
  }

  return res.json();
}

// ===== UI =====
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ===== GRID =====
function setGrid(board) {
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 3; row++) {
      const img = document.getElementById(`r${col}c${row}`);
      if (img) {
        img.src = basePath + board[col][row];
      }
    }
  }
}

// ===== RANDOM GRID =====
function randomBoard() {
  return Array.from({ length: 5 }, () =>
    Array.from({ length: 3 }, () =>
      symbols[Math.floor(Math.random() * symbols.length)]
    )
  );
}

// ===== ANIMACION REAL =====
async function spinVisual(finalBoard) {
  const reels = 5;

  for (let i = 0; i < reels; i++) {
    await new Promise(resolve => {
      let speed = 50;
      let cycles = 0;

      const interval = setInterval(() => {
        const tempBoard = randomBoard();
        setGrid(tempBoard);

        speed *= 1.05;
        cycles++;

        if (cycles > 10 + i * 5) {
          clearInterval(interval);

          // STOP con resultado real
          for (let r = 0; r < 3; r++) {
            document.getElementById(`r${i}c${r}`).src =
              basePath + finalBoard[i][r];
          }

          resolve();
        }
      }, speed);
    });
  }
}

// ===== WIN CHECK SIMPLE =====
function checkWin(board) {
  let win = 0;

  for (let row = 0; row < 3; row++) {
    let first = board[0][row];
    let count = 1;

    for (let col = 1; col < 5; col++) {
      if (board[col][row] === first) count++;
      else break;
    }

    if (count >= 3) {
      win += currentBet * count;
    }
  }

  return win;
}

// ===== SPIN =====
async function jugar() {
  if (spinning) return;
  spinning = true;

  try {
    const res = await api("/api/slots/spin", {
      method: "POST",
      body: JSON.stringify({ amount: currentBet })
    });

    saldoActual = res.balance;
    setText("saldo", saldoActual);

    const board = randomBoard(); // ⚠️ temporal (hasta que backend lo devuelva real)

    await spinVisual(board);

    const win = checkWin(board);

    const resultEl = document.getElementById("resultado");

    if (win > 0) {
      resultEl.textContent = `🔥 Ganaste ${win}`;
      resultEl.className = "win";

      document.querySelectorAll(".reel").forEach(el => {
        el.classList.add("win-high");
      });

      setTimeout(() => {
        document.querySelectorAll(".reel").forEach(el => {
          el.classList.remove("win-high");
        });
      }, 800);

    } else {
      resultEl.textContent = "❌ Perdiste";
      resultEl.className = "lose";
    }

  } catch (e) {
    console.error(e);
  }

  spinning = false;
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", async () => {
  const me = await api("/api/me");
  saldoActual = me.balance;
  setText("saldo", saldoActual);

  setGrid(randomBoard());
});