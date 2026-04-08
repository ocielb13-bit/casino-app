// ================= CONFIG API =================
const API_URL = "https://casino-app-8wq8.onrender.com";

// ================= API =================
async function api(path, options = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(API_URL + path, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token,
      ...(options.headers || {})
    },
    ...options
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || "Error");

  return data;
}

// ================= CONFIG SLOT =================
const CELL_IDS = {
  row1: ["c1_0","c1_1","c1_2","c1_3","c1_4"],
  row2: ["c2_0","c2_1","c2_2","c2_3","c2_4"],
  row3: ["c3_0","c3_1","c3_2","c3_3","c3_4"]
};

let playing = false;
let saldoActual = 0;
let freeSpins = 0;

// ================= IMAGEN =================
function symbolSrc(symbol) {
  return `/assets/symbols/asian/${symbol}.png`;
}

function setCell(id, symbol) {
  const img = document.getElementById("img-" + id);
  if (img) img.src = symbolSrc(symbol);
}

// ================= RENDER =================
function renderBoard(board) {
  board.forEach((row, rIndex) => {
    row.forEach((symbol, cIndex) => {
      setCell(`c${rIndex+1}_${cIndex}`, symbol);
    });
  });
}

// ================= UI =================
function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

function showBalance() {
  setText("saldo", saldoActual);
  setText("freeLine", freeSpins);
}

// ================= SESSION =================
async function loadSession() {
  const data = await api("/api/user");

  saldoActual = data.balance;
  freeSpins = data.free_spins;

  showBalance();
}

// ================= ANIMACIÓN =================
function randomSymbol() {
  const arr = ["dragon","coin","jade","lantern","wild","scatter"];
  return arr[Math.floor(Math.random()*arr.length)];
}

async function animateRow(rowIds, duration) {
  return new Promise(resolve => {
    const interval = setInterval(() => {
      rowIds.forEach(id => setCell(id, randomSymbol()));
    }, 70);

    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, duration);
  });
}

// ================= HIGHLIGHT =================
function highlightRow(rowIndex) {
  CELL_IDS[`row${rowIndex+1}`].forEach(id => {
    document.getElementById(id)?.classList.add("win");
  });
}

// ================= JUGAR =================
async function jugar() {
  if (playing) return;
  playing = true;

  try {
    const apuesta = parseInt(document.getElementById("apuesta").value);
    if (!apuesta || apuesta <= 0) return;

    setText("resultado", "Girando...");

    // animación simultánea por filas
    await Promise.all([
      animateRow(CELL_IDS.row1, 700),
      animateRow(CELL_IDS.row2, 900),
      animateRow(CELL_IDS.row3, 1100)
    ]);

    // pedir resultado real al server
    const res = await api("/api/slots/spin", {
      method: "POST",
      body: JSON.stringify({ amount: apuesta })
    });

    renderBoard(res.board);

    saldoActual = res.balance;
    freeSpins = res.freeSpins;

    showBalance();

    // ================= RESULTADO =================
    if (res.win > 0) {
      setText("resultado", `🎉 Ganaste ${res.win}`);

      // highlight simple (mejoraremos después)
      res.board.forEach((row, i) => {
        const iguales = row.every(s => s === row[0] || s === "wild");
        if (iguales) highlightRow(i);
      });

    } else {
      setText("resultado", "😢 Perdiste");
    }

    // ================= SCATTER =================
    const scatters = res.board.flat().filter(s => s === "scatter").length;

    if (scatters === 2) {
      setText("bonusHint", "⚡ Falta 1 scatter para bonus");
    }

    if (scatters >= 3) {
      setText("bonusHint", "🌀 FREE SPINS!");
    }

  } catch (err) {
    setText("resultado", "❌ " + err.message);
  }

  playing = false;
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadSession();
  } catch {
    window.location.href = "/";
  }
});