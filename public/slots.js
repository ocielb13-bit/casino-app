let freeSpins = 0;
let currentBet = 10;

// 🎁 CONTROL FREESPINS REAL
function controlFreeSpins(serverFreeSpins) {
  if (serverFreeSpins > 10) return 10;
  if (freeSpins > 0 && serverFreeSpins > freeSpins) return freeSpins;
  return serverFreeSpins;
}

// 💰 MONEDAS VISUALES
function spawnCoins(amount) {
  for (let i = 0; i < Math.min(amount, 20); i++) {
    const coin = document.createElement("div");
    coin.className = "coin";
    coin.textContent = "💰";
    coin.style.left = Math.random() * 100 + "%";
    document.body.appendChild(coin);

    setTimeout(() => coin.remove(), 1000);
  }
}

// 🎁 BONUS GAME SIMPLE
function triggerBonus() {
  const el = document.getElementById("resultado");
  el.textContent = "🎁 BONUS ACTIVADO!";
  el.className = "bonus";

  let bonusWin = Math.floor(Math.random() * 200) + 50;

  setTimeout(() => {
    el.textContent = `🎉 Bonus ganó ${bonusWin}`;
    spawnCoins(15);
  }, 1500);
}

// 🎰 MULTIPLICADOR
function applyMultiplier(win) {
  let chance = Math.random();

  if (chance < 0.1) return win * 2;
  if (chance < 0.03) return win * 5;

  return win;
}

// 🎰 SPIN
async function jugar() {
  const resultado = document.getElementById("resultado");

  try {
    resultado.textContent = "Girando...";

    const res = await fetch("/api/slots/spin", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ amount: currentBet })
    }).then(r => r.json());

    freeSpins = controlFreeSpins(res.freeSpins || 0);

    let win = res.win || 0;

    // 🎰 MULTIPLICADOR
    win = applyMultiplier(win);

    if (res.scatterCount >= 3) {
      triggerBonus();
      return;
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
    resultado.textContent = "Error";
  }
}