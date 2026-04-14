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

// ===== RANDOM =====
function randomBoard() {
  return Array.from({ length: 5 }, () =>
    Array.from({ length: 3 }, () =>
      symbols[Math.floor(Math.random() * symbols.length)]
    )
  );
}

// ===== BOTONES APUESTA =====
function changeBet(amount) {
  currentBet += amount;

  if (currentBet < 10) currentBet = 10;
  if (currentBet > 10000) currentBet = 10000;

  setText("bet", currentBet);
}

// ===== ANIMACIÓN PRO =====
async function spinVisual(finalBoard) {
  for (let col = 0; col < 5; col++) {
    await new Promise(resolve => {
      let speed = 50;
      let cycles = 0;

      const interval = setInterval(() => {
        const temp = randomBoard();
        setGrid(temp);

        speed *= 1.08;
        cycles++;

        if (cycles > 12 + col * 5) {
          clearInterval(interval);

          for (let row = 0; row < 3; row++) {
            document.getElementById(`r${col}c${row}`).src =
              basePath + finalBoard[col][row];
          }

          resolve();
        }
      }, speed);
    });
  }
}

// ===== WIN + LINEAS =====
function checkWin(board) {
  let totalWin = 0;

  document.querySelectorAll(".reel").forEach(el =>
    el.classList.remove("win-line")
  );

  for (let row = 0; row < 3; row++) {
    let first = board[0][row];
    let count = 1;

    for (let col = 1; col < 5; col++) {
      if (board[col][row] === first) count++;
      else break;
    }

    if (count >= 3) {
      totalWin += currentBet * count;

      // iluminar línea
      for (let col = 0; col < count; col++) {
        document
          .getElementById(`r${col}c${row}`)
          .parentElement.classList.add("win-line");
      }
    }
  }

  return totalWin;
}

// ===== EFECTO MONEDAS 💰 =====
function coinEffect() {
  for (let i = 0; i < 15; i++) {
    const coin = document.createElement("div");
    coin.className = "coin";
    coin.textContent = "💰";

    coin.style.left = Math.random() * 100 + "%";

    document.body.appendChild(coin);

    setTimeout(() => coin.remove(), 1000);
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

    saldoActual = res.balance;
    setText("saldo", saldoActual);

    const board = randomBoard();

    await spinVisual(board);

    const win = checkWin(board);

    const result = document.getElementById("resultado");

    if (win > 0) {
      result.textContent = `🔥 Ganaste ${win}`;
      result.className = "win";

      coinEffect();

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

  setGrid(randomBoard());

  // botones
  window.mas100 = () => changeBet(100);
  window.menos100 = () => changeBet(-100);
  window.spin = jugar;
});