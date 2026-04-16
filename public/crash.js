let running = false;
let crashed = false;
let multiplier = 1;
let interval = null;

const growthSpeed = 0.02;

async function api(path, options = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {})
    },
    ...options
  });

  return res.json();
}

function resetGame() {
  running = false;
  crashed = false;
  multiplier = 1;

  clearInterval(interval);

  document.getElementById("multiplier").textContent = "1.00x";
  document.getElementById("status").textContent = "Esperando apuesta...";
  
  const btn = document.getElementById("btnAction");
  btn.disabled = false;
  btn.textContent = "🚀 Apostar";
}

async function startGame() {
  if (running) return;

  const bet = Number(document.getElementById("bet").value);

  const res = await api("/api/crash/start", {
    method: "POST",
    body: JSON.stringify({ amount: bet })
  });

  if (!res.success) {
    alert("Error");
    return;
  }

  running = true;
  crashed = false;
  multiplier = 1;

  const crashPoint = res.crashPoint;

  const btn = document.getElementById("btnAction");
  btn.textContent = "💰 Retirar";

  interval = setInterval(() => {
    multiplier += growthSpeed;

    document.getElementById("multiplier").textContent =
      multiplier.toFixed(2) + "x";

    if (multiplier >= crashPoint) {
      crashGame();
    }

  }, 50);
}

async function cashOut() {
  if (!running || crashed) return;

  const res = await api("/api/crash/cashout", {
    method: "POST",
    body: JSON.stringify({ multiplier })
  });

  document.getElementById("status").textContent =
    "💰 Cobraste " + res.win;

  document.getElementById("balance").textContent = res.balance;

  clearInterval(interval);

  // 🔥 IMPORTANTE
  setTimeout(resetGame, 1500);
}

function crashGame() {
  crashed = true;
  running = false;

  clearInterval(interval);

  document.getElementById("status").textContent =
    "💥 CRASH en " + multiplier.toFixed(2) + "x";

  // 🔥 IMPORTANTE
  setTimeout(resetGame, 2000);
}

function action() {
  if (!running) {
    startGame();
  } else {
    cashOut();
  }
}

document.getElementById("btnAction").onclick = action;

function startRound() {
  startGame();
}