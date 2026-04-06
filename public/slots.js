const user = localStorage.getItem("user");

const simbolos = ["🍒", "🍋", "🍉", "⭐", "💎", "7️⃣", "🎁"];

let jackpotAcumulado = 1000;
let freeSpinsRestantes = 0;

function girarVisual() {
  return simbolos[Math.floor(Math.random() * simbolos.length)];
}

// 🎨 RENDER
function renderizar(resultados) {

  // TOP
  resultados.top.forEach((val, i) => {
    document.getElementById(`tr${i + 1}`).innerText = val;
  });

  // CENTRO
  resultados.c1.forEach((val, i) => {
    document.getElementById(`c1_${i}`).innerText = val;
  });

  resultados.c2.forEach((val, i) => {
    document.getElementById(`c2_${i}`).innerText = val;
  });

  // BOTTOM
  resultados.bottom.forEach((val, i) => {
    document.getElementById(`br${i + 1}`).innerText = val;
  });
}

async function jugar() {
  const apuestaBase = parseInt(document.getElementById("apuesta").value);
  if (!apuestaBase || apuestaBase <= 0) return;

  if (freeSpinsRestantes === 0) {
    await actualizarSaldo(-apuestaBase);
  } else {
    freeSpinsRestantes--;
  }

  // 🎰 GENERAR
  const resultados = {
    top: Array(3).fill().map(girarVisual),
    c1: Array(5).fill().map(girarVisual),
    c2: Array(5).fill().map(girarVisual),
    bottom: Array(3).fill().map(girarVisual)
  };

  // 🎨 MOSTRAR
  renderizar(resultados);

  let multiplicador = 0;

  // 🔝 TOP x10
  if (resultados.top.every(v => v === resultados.top[0])) {
    multiplicador += 10;
  }

  // 🧱 COLUMNAS
  resultados.c1.forEach((emoji, i) => {
    if (emoji === resultados.c2[i]) {
      multiplicador += 2;
    }
  });

  // 💰 JACKPOT
  if (resultados.bottom.every(v => v === "7️⃣")) {
    alert("¡JACKPOT! 🏆");
    multiplicador += jackpotAcumulado / apuestaBase;
    jackpotAcumulado = 1000;
  } else {
    jackpotAcumulado += Math.floor(apuestaBase * 0.1);
  }

  // 🎁 FREESPINS
  const todos = [
    ...resultados.top,
    ...resultados.c1,
    ...resultados.c2,
    ...resultados.bottom
  ];

  const scatters = todos.filter(e => e === "🎁").length;

  if (scatters >= 3) {
    freeSpinsRestantes += 5;
    document.getElementById("resultado").innerText =
      "🎁 ¡Ganaste 5 FREE SPINS!";
  }

  // 💸 GANANCIA
  const gananciaTotal = apuestaBase * multiplicador;

  if (gananciaTotal > 0) {
    await actualizarSaldo(gananciaTotal);
  }

  document.getElementById("resultado").innerText +=
    ` | Ganancia: ${gananciaTotal}`;

  cargarSaldo();
}

// 🔄 SALDO
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
    `💰 ${data.balance} | 🎁 Free: ${freeSpinsRestantes} | 🏆 Jackpot: ${jackpotAcumulado}`;
}

cargarSaldo();