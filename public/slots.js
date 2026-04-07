const user = localStorage.getItem("user");

if (!user) {
  window.location.href = "/menu.html";
}

const simbolos = ["🍒", "🍋", "🍉", "⭐", "💎", "7️⃣", "🎁"];

// Pesos para que 🎁 salga MUY poco
const simbolosPonderados = [
  ...Array(30).fill("🍒"),
  ...Array(30).fill("🍋"),
  ...Array(25).fill("🍉"),
  ...Array(20).fill("⭐"),
  ...Array(15).fill("💎"),
  ...Array(10).fill("7️⃣"),
  ...Array(2).fill("🎁")
];

const LINEAS = {
  top: ["tr1", "tr2", "tr3"],
  row1: ["c1_0", "c1_1", "c1_2", "c1_3", "c1_4"],
  row2: ["c2_0", "c2_1", "c2_2", "c2_3", "c2_4"],
  bottom: ["br1", "br2", "br3"]
};

let jackpotAcumulado = 1000;
let freeSpinsRestantes = 0;
let gananciaFreeSpins = 0;
let enFreeSpin = false;
let jugando = false;
let saldoActual = 0;

function simboloAleatorio() {
  return simbolosPonderados[Math.floor(Math.random() * simbolosPonderados.length)];
}

function setCell(id, valor) {
  const el = document.getElementById(id);
  if (el) el.innerText = valor;
}

function playSound(id) {
  const audio = document.getElementById(id);
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch (_) {}
}

function resaltarLinea(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.boxShadow = "0 0 18px gold";
    el.style.transform = "scale(1.03)";
    setTimeout(() => {
      el.style.boxShadow = "";
      el.style.transform = "";
    }, 700);
  });
}

async function animarLinea(ids, finales, duracion = 800, tick = 70) {
  return new Promise(resolve => {
    const interval = setInterval(() => {
      ids.forEach(id => setCell(id, simboloAleatorio()));
    }, tick);

    setTimeout(() => {
      clearInterval(interval);
      finales.forEach((valor, i) => setCell(ids[i], valor));
      resolve(finales);
    }, duracion);
  });
}

function renderSaldo() {
  const saldoEl = document.getElementById("saldo");
  if (!saldoEl) return;

  saldoEl.innerText = `💰 ${saldoActual} | 🎁 ${freeSpinsRestantes} | 🏆 ${jackpotAcumulado}`;
}

async function cargarSaldo() {
  const res = await fetch("/get-balance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user })
  });

  const data = await res.json();
  saldoActual = Number(data.balance || 0);
  renderSaldo();
}

async function actualizarSaldo(monto) {
  const res = await fetch("/update-balance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user, amount: monto })
  });

  const data = await res.json();
  if (typeof data.balance === "number") {
    saldoActual = data.balance;
  } else {
    saldoActual += monto;
  }
  renderSaldo();
  return saldoActual;
}

function generarFinales() {
  return {
    top: Array.from({ length: 3 }, () => simboloAleatorio()),
    row1: Array.from({ length: 5 }, () => simboloAleatorio()),
    row2: Array.from({ length: 5 }, () => simboloAleatorio()),
    bottom: Array.from({ length: 3 }, () => simboloAleatorio())
  };
}

function calcularPremio(finales) {
  let multiplicador = 0;
  const mensajes = [];
  const lineasGanadoras = [];

  // TOP 3 iguales
  if (finales.top.every(v => v === finales.top[0])) {
    multiplicador += 10;
    mensajes.push("Top x10");
    lineasGanadoras.push(LINEAS.top);
  }

  // Fila 1 de 5 iguales
  if (finales.row1.every(v => v === finales.row1[0])) {
    multiplicador += 6;
    mensajes.push("Fila 1 x6");
    lineasGanadoras.push(LINEAS.row1);
  }

  // Fila 2 de 5 iguales
  if (finales.row2.every(v => v === finales.row2[0])) {
    multiplicador += 6;
    mensajes.push("Fila 2 x6");
    lineasGanadoras.push(LINEAS.row2);
  }

  // Coincidencias por columna entre fila 1 y fila 2
  finales.row1.forEach((emoji, i) => {
    if (emoji === finales.row2[i]) {
      multiplicador += 2;
    }
  });

  // Jackpot: 3 sietes abajo
  if (finales.bottom.every(v => v === "7️⃣")) {
    multiplicador += jackpotAcumulado / Math.max(1, apuestaActual);
    mensajes.push("JACKPOT");
    lineasGanadoras.push(LINEAS.bottom);
    jackpotAcumulado = 1000;
  } else {
    jackpotAcumulado += Math.floor(apuestaActual * 0.1);
  }

  // Free spins: muy raros
  const todos = [...finales.top, ...finales.row1, ...finales.row2, ...finales.bottom];
  const scatters = todos.filter(e => e === "🎁").length;

  if (scatters >= 3) {
    freeSpinsRestantes += 5;
    mensajes.push("5 FREE SPINS");
  }

  return { multiplicador, mensajes, lineasGanadoras, scatters };
}

let apuestaActual = 0;

async function jugar() {
  if (jugando) return;
  jugando = true;

  try {
    apuestaActual = parseInt(document.getElementById("apuesta").value, 10);
    if (!apuestaActual || apuestaActual <= 0) return;

    if (!enFreeSpin && apuestaActual > saldoActual) {
      document.getElementById("resultado").innerText = "No tenés saldo suficiente";
      return;
    }

    playSound("spinSound");

    if (freeSpinsRestantes > 0) {
      enFreeSpin = true;
      freeSpinsRestantes--;
    } else {
      enFreeSpin = false;
      await actualizarSaldo(-apuestaActual);
    }

    document.getElementById("resultado").innerText = "Girando...";

    // Genero el resultado final una sola vez
    const finales = generarFinales();

    // Giro real por línea, todos los símbolos de esa línea se mueven juntos
    const animTop = animarLinea(LINEAS.top, finales.top, 650, 60);
    const animRow1 = animarLinea(LINEAS.row1, finales.row1, 850, 60);
    const animRow2 = animarLinea(LINEAS.row2, finales.row2, 950, 60);
    const animBottom = animarLinea(LINEAS.bottom, finales.bottom, 750, 60);

    await Promise.all([animTop, animRow1, animRow2, animBottom]);

    const { multiplicador, mensajes, lineasGanadoras } = calcularPremio(finales);
    const gananciaTotal = apuestaActual * multiplicador;

    // Resaltar líneas que ganaron
    lineasGanadoras.forEach(resaltarLinea);

    // Si está en free spin, se acumula para el final
    if (gananciaTotal > 0) {
      if (enFreeSpin) {
        gananciaFreeSpins += gananciaTotal;
      } else {
        await actualizarSaldo(gananciaTotal);
        playSound("winSound");
      }
    }

    // Si terminó el bloque de free spins, se paga todo al final
    if (enFreeSpin && freeSpinsRestantes === 0) {
      if (gananciaFreeSpins > 0) {
        await actualizarSaldo(gananciaFreeSpins);
        playSound("winSound");
      }

      document.getElementById("resultado").innerText =
        `🌀 Free Spins terminados | Total pagado: ${gananciaFreeSpins}`;

      gananciaFreeSpins = 0;
      enFreeSpin = false;
      await cargarSaldo();
      jugando = false;
      return;
    }

    // Mensaje por tiro, actualizado en cada giro
    let texto = gananciaTotal > 0
      ? `🎉 Ganaste ${gananciaTotal}`
      : "😢 Perdiste";

    if (enFreeSpin) {
      texto += ` | Free restantes: ${freeSpinsRestantes} | Acumulado: ${gananciaFreeSpins}`;
    }

    if (mensajes.length > 0) {
      texto += ` | ${mensajes.join(" · ")}`;
    }

    document.getElementById("resultado").innerText = texto;

    await cargarSaldo();
  } finally {
    jugando = false;
  }
}

cargarSaldo();