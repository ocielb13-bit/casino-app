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
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

const SYMBOL_PATH = "/assets/symbols/asian";

const SYMBOLS = ["dragon","goldpot","coin","jade","lantern","wild","scatter"];

let playing = false;
let spinTimer = null;

let saldoActual = 0;
let freeSpins = 0;
let freeBank = 0;
let jackpotBank = 1000;
let currentBet = 10;

// 🎁 CONTROL FREESPINS
function controlFreeSpins(serverFreeSpins) {
  if (serverFreeSpins > 20) return 20;
  if (freeSpins > 0 && serverFreeSpins > freeSpins) return freeSpins;
  return serverFreeSpins;
}

// 🎰 FALLBACK IMAGEN
function fallbackSvg(symbol) {
  return `data:image/svg+xml;charset=UTF-8,
  <svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
    <rect width='200' height='200' fill='#000'/>
    <text x='100' y='110' font-size='24' fill='#0ff' text-anchor='middle'>
      ${symbol.toUpperCase()}
    </text>
  </svg>`;
}

// 🎰 SETEAR CELDA
function setCell(id, symbol) {
  const img = document.getElementById("img-" + id);
  if (!img) return;

  img.onerror = () => img.src = fallbackSvg(symbol);
  img.src = `${SYMBOL_PATH}/${symbol}.png`;
}

// 🎰 RENDER TABLERO
function renderBoard(board) {
  board.forEach((row, r) => {
    row.forEach((symbol, c) => {
      setCell(`c${r+1}_${c}`, symbol);
    });
  });
}

// 🎰 RANDOM PARA SPIN VISUAL
function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
}

// 🎰 ANIMACIÓN GIRO
function startSpinFX() {
  stopSpinFX();

  document.querySelectorAll(".reel").forEach(r => r.classList.add("spinning"));

  spinTimer = setInterval(() => {
    document.querySelectorAll(".reel img").forEach(img => {
      img.src = fallbackSvg(randomSymbol());
    });
  }, 60);
}

function stopSpinFX() {
  clearInterval(spinTimer);
  spinTimer = null;

  document.querySelectorAll(".reel").forEach(r => r.classList.remove("spinning"));
}

// 💰 MONEDAS
function spawnCoins(amount) {
  for (let i = 0; i < Math.min(amount, 20); i++) {
    const coin = document.createElement("div");
    coin.className = "coin";
    coin.innerText = "💰";
    coin.style.left = Math.random()*100 + "%";
    document.body.appendChild(coin);
    setTimeout(()=>coin.remove(),1000);
  }
}

// 🎁 BONUS
function triggerBonus() {
  const el = document.getElementById("resultado");
  el.textContent = "🎁 BONUS!";
  el.className = "bonus";

  const win = Math.floor(Math.random()*200)+50;

  setTimeout(()=>{
    el.textContent = `🎉 Bonus ganó ${win}`;
    spawnCoins(win);
  },1500);
}

// 🎰 MULTIPLICADOR
function applyMultiplier(win) {
  const r = Math.random();
  if (r < 0.03) return win * 5;
  if (r < 0.1) return win * 2;
  return win;
}

// 🎰 SPIN PRINCIPAL
async function jugar() {
  if (playing) return;

  const btn = document.getElementById("spinBtn");
  const resultado = document.getElementById("resultado");

  playing = true;
  btn.disabled = true;

  resultado.textContent = "Girando...";
  resultado.className = "";

  try {
    startSpinFX();

    const [res] = await Promise.all([
      api("/api/slots/spin", {
        method:"POST",
        body: JSON.stringify({ amount: currentBet })
      }),
      new Promise(r=>setTimeout(r,1200))
    ]);

    stopSpinFX();
    renderBoard(res.board);

    saldoActual = res.balance || saldoActual;
    freeSpins = controlFreeSpins(res.freeSpins || 0);

    let win = res.win || 0;
    win = applyMultiplier(win);

    // 🎁 BONUS SI HAY SCATTERS
    if (res.scatterCount >= 3) {
      triggerBonus();
    }

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
    resultado.textContent = "Error";
  }

  btn.disabled = false;
  playing = false;
}

// 🎰 INIT
document.addEventListener("DOMContentLoaded", () => {
  renderBoard([
    ["dragon","coin","jade","lantern","wild"],
    ["coin","jade","dragon","goldpot","scatter"],
    ["dragon","dragon","coin","jade","lantern"]
  ]);
});