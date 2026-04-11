// 🔌 API
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

  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Respuesta inválida del server");
  }

  if (!res.ok) throw new Error(data.error || "Error");

  return data;
}

// 🎰 CONFIG
const SYMBOL_PATH = "/assets/symbols/asian";
const SYMBOLS = ["dragon","goldpot","coin","jade","lantern","wild","scatter"];

let playing = false;
let spinTimer = null;

let saldoActual = 0;
let freeSpins = 0;
let freeBank = 0;
let jackpotBank = 1000;
let currentBet = 10;

// 🎁 FIX FREESPINS (ANTI EXPLOIT)
function controlFreeSpins(serverFreeSpins) {
  // límite duro
  if (serverFreeSpins > 20) serverFreeSpins = 20;

  // si ya estás en free spins → no acumula infinitamente
  if (freeSpins > 0) {
    return Math.max(freeSpins - 1, serverFreeSpins);
  }

  return serverFreeSpins;
}

// 🎰 UI
function updateUI() {
  document.getElementById("saldo").textContent = saldoActual;
  document.getElementById("betDisplay").textContent = currentBet;
  document.getElementById("freeLine").textContent = freeSpins;
  document.getElementById("bankLine").textContent = freeBank;
  document.getElementById("jackpotLine").textContent = jackpotBank;
}

// 🎰 APUESTA (+ y -)
function changeBet(amount) {
  currentBet += amount;

  if (currentBet < 1) currentBet = 1;
  if (currentBet > saldoActual) currentBet = saldoActual;

  updateUI();
}

// 🎰 SESSION
async function loadSession() {
  const me = await api("/api/me");

  saldoActual = Number(me.balance || 0);
  freeSpins = Number(me.free_spins || 0);
  freeBank = Number(me.free_spin_bank || 0);

  const info = await api("/api/game-info");
  jackpotBank = Number(info.jackpot_bank || 1000);

  document.getElementById("playerLine").textContent = me.username;

  updateUI();
}

// 🎰 FALLBACK
function fallbackSvg(symbol) {
  return `data:image/svg+xml;charset=UTF-8,
  <svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
    <rect width='200' height='200' fill='#000'/>
    <text x='100' y='110' font-size='24' fill='#0ff' text-anchor='middle'>
      ${symbol}
    </text>
  </svg>`;
}

// 🎰 CELDA
function setCell(id, symbol) {
  const img = document.getElementById("img-" + id);
  if (!img) return;

  const path = `${SYMBOL_PATH}/${symbol}.png`;

  img.onerror = () => {
    img.src = fallbackSvg(symbol);
  };

  img.src = path;
}

// 🎰 BOARD
function renderBoard(board) {
  if (!board) return;

  board.forEach((row, r) => {
    row.forEach((symbol, c) => {
      setCell(`c${r+1}_${c}`, symbol);
    });
  });
}

// 🎰 FX
function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
}

function startSpinFX() {
  stopSpinFX();

  document.querySelectorAll(".reel").forEach(r => r.classList.add("spinning"));

  spinTimer = setInterval(() => {
    document.querySelectorAll(".reel img").forEach(img => {
      img.src = fallbackSvg(randomSymbol());
    });
  }, 80);
}

function stopSpinFX() {
  clearInterval(spinTimer);
  spinTimer = null;

  document.querySelectorAll(".reel").forEach(r => r.classList.remove("spinning"));
}

// 💰 FX MONEDAS
function spawnCoins(amount) {
  for (let i = 0; i < Math.min(amount, 15); i++) {
    const coin = document.createElement("div");
    coin.className = "coin";
    coin.innerText = "💰";
    coin.style.left = Math.random()*100 + "%";
    document.body.appendChild(coin);
    setTimeout(()=>coin.remove(),1000);
  }
}

// 🎰 SPIN
async function jugar() {
  if (playing) return;

  const btn = document.getElementById("spinBtn");
  const resultado = document.getElementById("resultado");

  if (currentBet > saldoActual && freeSpins <= 0) {
    resultado.textContent = "Saldo insuficiente";
    return;
  }

  playing = true;
  btn.disabled = true;

  resultado.textContent = "Girando...";

  try {
    startSpinFX();

    const res = await api("/api/slots/spin", {
      method:"POST",
      body: JSON.stringify({ amount: currentBet })
    });

    stopSpinFX();

    // 🔥 FIX FLEXIBLE (soporta cualquier backend)
    const board = res.board || res.data?.board;
    renderBoard(board);

    saldoActual = Number(res.balance ?? res.data?.balance ?? saldoActual);
    freeSpins = controlFreeSpins(res.freeSpins ?? res.data?.freeSpins ?? 0);
    freeBank = Number(res.freeSpinBank ?? res.data?.freeSpinBank ?? freeBank);
    jackpotBank = Number(res.jackpotBank ?? res.data?.jackpotBank ?? jackpotBank);

    updateUI();

    let win = res.win ?? res.data?.win ?? 0;

    if (win > 0) {
      resultado.textContent = `🎉 Ganaste ${win}`;
      resultado.className = "win";
      spawnCoins(win);
    } else {
      resultado.textContent = "😢 Sin premio";
      resultado.className = "lose";
    }

  } catch (err) {
    stopSpinFX();
    console.error(err);
    resultado.textContent = err.message || "Error";
  }

  btn.disabled = false;
  playing = false;
}

// INIT
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadSession();

    renderBoard([
      ["dragon","coin","jade","lantern","wild"],
      ["coin","jade","dragon","goldpot","scatter"],
      ["dragon","dragon","coin","jade","lantern"]
    ]);

  } catch {
    localStorage.removeItem("token");
    window.location.href = "/";
  }
});