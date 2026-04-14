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
      if (img) img.src = basePath + board[col][row];
    }
  }
}

// ===== BOTONES =====
function changeBet(amount) {
  currentBet += amount;

  if (currentBet < 10) currentBet = 10;
  if (currentBet > 10000) currentBet = 10000;

  setText("bet", currentBet);
}

// ===== SCATTER SIMPLE =====
function checkScatter(board) {
  let count = 0;

  board.flat().forEach(s => {
    if (s === "scatter.png") count++;
  });

  return count >= 3;
}

// ===== WIN SIMPLE =====
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

      for (let col = 0; col < count; col++) {
        document
          .getElementById(`r${col}c${row}`)
          .parentElement.classList.add("win-line");
      }
    }
  }

  return win;
}

// ===== LIMPIAR EFECTOS =====
function clearWinEffects() {
  document.querySelectorAll(".reel").forEach(el =>
    el.classList.remove("win-line")
  );
}

// ===== ANIMACION =====
async function spinVisual(board) {
  for (let col = 0; col < 5; col++) {
    await new Promise(resolve => {
      let cycles = 0;

      const interval = setInterval(() => {
        cycles++;

        if (cycles > 10 + col * 4) {
          clearInterval(interval);

          for (let row = 0; row < 3; row++) {
            document.getElementById(`r${col}c${row}`).src =
              basePath + board[col][row];
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

    const board = res.board || [
      ["coin.png","coin.png","coin.png"],
      ["coin.png","coin.png","coin.png"],
      ["coin.png","coin.png","coin.png"],
      ["coin.png","coin.png","coin.png"],
      ["coin.png","coin.png","coin.png"]
    ];

    await spinVisual(board);

    saldoActual = res.balance;
    setText("saldo", saldoActual);

    const scatter = checkScatter(board);
    const win = checkWin(board);

    const result = document.getElementById("resultado");

    if (scatter) {
      result.textContent = "🎁 BONUS!";
      result.className = "bonus";
    } else if (win > 0) {
      result.textContent = `🔥 Ganaste ${win}`;
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

  // BOTONES SEGUROS
  document.getElementById("btnMas100").onclick = () => changeBet(100);
  document.getElementById("btnMenos100").onclick = () => changeBet(-100);
  document.getElementById("btnSpin").onclick = jugar;
});