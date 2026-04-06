const user = localStorage.getItem("user");

const simbolos = ["🍒", "🍋", "🍉", "⭐", "💎", "7️⃣", "🎁"];

let jackpotAcumulado = 1000;
let freeSpinsRestantes = 0;
let gananciaFreeSpins = 0;
let enFreeSpin = false;

function girarVisual() {
  return simbolos[Math.floor(Math.random() * simbolos.length)];
}

// 🎞️ ANIMACIÓN
function animarRodillo(id, delay = 0) {
  return new Promise(resolve => {
    const interval = setInterval(() => {
      document.getElementById(id).innerText = girarVisual();
    }, 80);

    setTimeout(() => {
      clearInterval(interval);
      const final = girarVisual();
      document.getElementById(id).innerText = final;
      resolve(final);
    }, 500 + delay);
  });
}

async function jugar() {
  const apuestaBase = parseInt(document.getElementById("apuesta").value);
  if (!apuestaBase || apuestaBase <= 0) return;

  document.getElementById("spinSound").play();

  if (freeSpinsRestantes > 0) {
    enFreeSpin = true;
    freeSpinsRestantes--;
  } else {
    enFreeSpin = false;
    await actualizarSaldo(-apuestaBase);
  }

  // 🎰 GIRO CON ANIMACIÓN
  const top = await Promise.all([
    animarRodillo("tr1", 0),
    animarRodillo("tr2", 200),
    animarRodillo("tr3", 400)
  ]);

  const c1 = [];
  const c2 = [];

  for (let i = 0; i < 5; i++) {
    c1.push(await animarRodillo(`c1_${i}`, i * 100));
    c2.push(await animarRodillo(`c2_${i}`, i * 100));
  }

  const bottom = await Promise.all([
    animarRodillo("br1", 0),
    animarRodillo("br2", 200),
    animarRodillo("br3", 400)
  ]);

  const resultados = { top, c1, c2, bottom };

  let multiplicador = 0;

  // TOP x10
  if (top.every(v => v === top[0])) multiplicador += 10;

  // COLUMNAS
  c1.forEach((emoji, i) => {
    if (emoji === c2[i]) multiplicador += 2;
  });

  // JACKPOT
  if (bottom.every(v => v === "7️⃣")) {
    alert("¡JACKPOT! 🏆");
    multiplicador += jackpotAcumulado / apuestaBase;
    jackpotAcumulado = 1000;
  } else {
    jackpotAcumulado += Math.floor(apuestaBase * 0.1);
  }

  // FREE SPINS
  const todos = [...top, ...c1, ...c2, ...bottom];
  const scatters = todos.filter(e => e === "🎁").length;

  if (scatters >= 3) {
    freeSpinsRestantes += 5;
  }

  const gananciaTotal = apuestaBase * multiplicador;

  if (gananciaTotal > 0) {
    if (enFreeSpin) {
      gananciaFreeSpins += gananciaTotal;
    } else {
      await actualizarSaldo(gananciaTotal);
      document.getElementById("winSound").play();
    }
  }

  // FIN FREE SPINS
  if (enFreeSpin && freeSpinsRestantes === 0) {
    await actualizarSaldo(gananciaFreeSpins);
    document.getElementById("resultado").innerText =
      `🌀 Free Spins terminados: +${gananciaFreeSpins}`;
    gananciaFreeSpins = 0;
  } else {
    document.getElementById("resultado").innerText =
      gananciaTotal > 0
        ? `🎉 Ganaste ${gananciaTotal}`
        : "😢 Perdiste";
  }

  cargarSaldo();
}

// 💰 SALDO
async function actualizarSaldo(monto) {
  await fetch("/update-balance", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ username: user, amount: monto })
  });
}

async function cargarSaldo() {
  const res = await fetch("/get-balance", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ username: user })
  });

  const data = await res.json();

  document.getElementById("saldo").innerText =
    `💰 ${data.balance} | 🎁 ${freeSpinsRestantes} | 🏆 ${jackpotAcumulado}`;
}

cargarSaldo();