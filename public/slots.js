const basePath = "/assets/symbols/asian/";

let saldoActual = 0;
let currentBet = 100;
let spinning = false;
let freeSpins = 0;

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

// ===== PAYLINES (10 líneas) =====
const paylines = [
  [0,0,0,0,0],
  [1,1,1,1,1],
  [2,2,2,2,2],
  [0,1,2,1,0],
  [2,1,0,1,2],
  [0,0,1,0,0],
  [2,2,1,2,2],
  [1,0,1,2,1],
  [1,2,1,0,1],
  [0,1,1,1,0]
];

// ===== PAGOS =====
const paytable = {
  coin: [0, 0, 5, 10, 20],
  jade: [0, 0, 6, 12, 25],
  lantern: [0, 0, 8, 15, 30],
  goldpot: [0, 0, 10, 20, 40],
  dragon: [0, 0, 15, 30, 60],
  wild: [0, 0, 20, 50, 100]
};

// ===== CALCULAR GANANCIA =====
function evaluate(board) {
  let total = 0;

  document.querySelectorAll(".reel").forEach(el =>
    el.classList.remove("win-line")
  );

  paylines.forEach(line => {
    let first = board[0][line[0]].replace(".png","");
    let count = 1;

    for (let col = 1; col < 5; col++) {
      let symbol = board[col][line[col]].replace(".png","");

      if (symbol === first || symbol === "wild") {
        count++;
      } else break;
    }

    if (count >= 3 && paytable[first]) {
      total += paytable[first][count-1] * currentBet;

      for (let col = 0; col < count; col++) {
        document
          .getElementById(`r${col}c${line[col]}`)
          .parentElement.classList.add("win-line");
      }
    }
  });

  return total;
}

// ===== SCATTER =====
function checkScatter(board) {
  let count = 0;

  board.flat().forEach(s => {
    if (s === "scatter.png") count++;
  });

  if (count >= 3) {
    freeSpins += 5;
    return true;
  }

  return false;
}

// ===== ANIMACION =====
async function spinVisual(board) {
  for (let col = 0; col < 5; col++) {
    await new Promise(resolve => {
      let speed = 50;
      let cycles = 0;

      const interval = setInterval(() => {
        speed *= 1.1;
        cycles++;

        if (cycles > 10 + col * 4) {
          clearInterval(interval);

          for (let row = 0; row < 3; row++) {
            document.getElementById(`r${col}c${row}`).src =
              basePath + board[col][row];
          }

          resolve();
        }
      }, speed);
    });
  }
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

    const board = res.board; // 🔥 REAL DESDE BACKEND

    await spinVisual(board);

    saldoActual = res.balance;
    setText("saldo", saldoActual);

    const scatter = checkScatter(board);
    const win = evaluate(board);

    const result = document.getElementById("resultado");

    if (scatter) {
      result.textContent = "🎁 FREE SPINS ACTIVADOS!";
      result.className = "bonus";
    } else if (win > 0) {
      result.textContent = `🔥 Ganaste ${win}`;
      result.className = "win";
    } else {
      result.textContent = "❌ Perdiste";
      result.className = "lose";
    }

    // free spins auto
    if (freeSpins > 0) {
      freeSpins--;
      setTimeout(jugar, 1200);
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

  window.mas100 = () => changeBet(100);
  window.menos100 = () => changeBet(-100);
  window.spin = jugar;
});