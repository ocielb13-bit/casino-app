const basePath = "/assets/symbols/asian/";

let saldoActual = 0;
let currentBet = 100;
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

// ===== BET =====
function changeBet(amount) {
  currentBet += amount;

  if (currentBet < 10) currentBet = 10;
  if (currentBet > 10000) currentBet = 10000;

  setText("bet", currentBet);
}

// ===== EFECTOS =====
function clearWinEffects() {
  document.querySelectorAll(".reel").forEach(el =>
    el.classList.remove("win-line")
  );
}

// ===== SCATTER =====
function checkScatter(board) {
  return board.flat().filter(s => s === "scatter.png").length >= 3;
}

// ===== WIN =====
function checkWin(board) {
  let win = 0;

  for (let row = 0; row < 3; row++) {
    let first = board[0][row];
    let count = 1;

    for (let col = 1; col < 5; col++) {
      if (board[col][row] === first || board[col][row] === "wild.png") {
        count++;
      } else break;
    }

    if (count >= 3) {
      win += currentBet * count;

      for (let col = 0; col < count; col++) {
        document
          .getElementById(`r${col}c${row}`)
          .parentElement.classList.add("win-line");
      }
    }
  }

  return win;
}

// ===== ANIMACION PRO =====
async function spinVisual(board) {
  for (let col = 0; col < 5; col++) {
    await new Promise(resolve => {
      let cycles = 0;

      const interval = setInterval(() => {
        cycles++;

        // animación fake girando
        for (let row = 0; row < 3; row++) {
          const img = document.getElementById(`r${col}c${row}`);
          img.style.transform = "scale(1.1)";
        }

        if (cycles > 10 + col * 3) {
          clearInterval(interval);

          for (let row = 0; row < 3; row++) {
            const img = document.getElementById(`r${col}c${row}`);
            img.src = basePath + board[col][row];
            img.style.transform = "scale(1)";
          }

          resolve();
        }
      }, 60);
    });
  }
}

// ===== SPIN =====
async function jugar() {
  if (spinning) return;
  spinning = true;

  clearWinEffects();

  try {
    const res = await api("/api/slots/spin", {
      method: "POST",
      body: JSON.stringify({ amount: currentBet })
    });

    await spinVisual(res.board);

    saldoActual = res.balance;
    setText("saldo", saldoActual);

    const result = document.getElementById("resultado");

    if (res.freeSpins > 0) {
      result.textContent = "🎁 FREE SPINS!";
      result.className = "bonus";
    } else if (res.win > 0) {
      result.textContent = `🔥 Ganaste ${res.win}`;
      result.className = "win";
    } else {
      result.textContent = "❌ Perdiste";
      result.className = "lose";
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
  setText("bet", currentBet);
});

// 👇 IMPORTANTE
window.jugar = jugar;
window.changeBet = changeBet;