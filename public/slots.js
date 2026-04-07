// slots.js LIMPIO Y FUNCIONAL

let playing = false;
let apuestaActual = 0;

let jackpotAcumulado = 1000;
let freeSpinsRestantes = 0;
let freeSpinBank = 0;
let enFreeSpin = false;
let saldoActual = 0;

const CELL_IDS = {
  top: ["tr1", "tr2", "tr3"],
  row1: ["c1_0", "c1_1", "c1_2", "c1_3", "c1_4"],
  row2: ["c2_0", "c2_1", "c2_2", "c2_3", "c2_4"],
  bottom: ["br1", "br2", "br3"]
};

const SYMBOL_KIND = {
  dragon: "regular",
  goldpot: "regular",
  coin: "regular",
  jade: "regular",
  lantern: "regular",
  wild: "wild",
  scatter: "scatter"
};

const WEIGHTED_POOL = [
  ...Array(14).fill("dragon"),
  ...Array(12).fill("goldpot"),
  ...Array(18).fill("coin"),
  ...Array(18).fill("jade"),
  ...Array(16).fill("lantern"),
  ...Array(7).fill("wild"),
  ...Array(3).fill("scatter")
];

function symbolSrc(symbolId) {
  return `/assets/symbols/asian/${symbolId}.png`;
}

function pickSymbol() {
  return WEIGHTED_POOL[Math.floor(Math.random() * WEIGHTED_POOL.length)];
}

function setCell(id, symbol) {
  const img = document.getElementById(`img-${id}`);
  if (img) img.src = symbolSrc(symbol);
}

function renderBoard(board) {
  Object.keys(board).forEach(id => setCell(id, board[id]));
}

function generateBoard() {
  const board = {};
  [...CELL_IDS.top, ...CELL_IDS.row1, ...CELL_IDS.row2, ...CELL_IDS.bottom]
    .forEach(id => board[id] = pickSymbol());
  return board;
}

function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

function showBalance() {
  setText("saldo", saldoActual);
  setText("freeLine", freeSpinsRestantes);
  setText("bankLine", freeSpinBank);
  setText("jackpotLine", jackpotAcumulado);
}

// 🔐 CARGAR USUARIO
async function loadSession() {
  const user = localStorage.getItem("user");

  if (!user) {
    window.location.href = "/";
    return;
  }

  const res = await fetch("/get-balance", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ username: user })
  });

  const data = await res.json();

  saldoActual = data.balance || 0;

  setText("playerLine", `Usuario: ${user}`);
  showBalance();
}

// 🎰 SPIN PRINCIPAL
async function jugar() {
  if (playing) return;
  playing = true;

  try {
    const user = localStorage.getItem("user");
    const apuesta = parseInt(document.getElementById("apuesta").value);

    if (!apuesta || apuesta <= 0) {
      setText("resultado", "Apuesta inválida");
      return;
    }

    apuestaActual = apuesta;

    if (!enFreeSpin && apuestaActual > saldoActual) {
      setText("resultado", "Sin saldo");
      return;
    }

    document.getElementById("spinBtn").disabled = true;

    // 💸 RESTAR APUESTA
    if (freeSpinsRestantes > 0) {
      enFreeSpin = true;
      freeSpinsRestantes--;
    } else {
      enFreeSpin = false;

      await fetch("/update-balance", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          username: user,
          amount: -apuestaActual
        })
      });

      saldoActual -= apuestaActual;
    }

    // 🎲 GENERAR TABLERO
    const board = generateBoard();
    renderBoard(board);

    let win = 0;

    // 🎯 EJEMPLO SIMPLE DE PREMIO
    const symbols = Object.values(board);
    const dragons = symbols.filter(s => s === "dragon").length;

    if (dragons >= 5) {
      win = apuestaActual * 5;
    }

    // 🎁 SCATTER
    const scatters = symbols.filter(s => s === "scatter").length;

    if (scatters >= 3) {
      freeSpinsRestantes += 5;
    }

    // 💰 PAGAR
    if (win > 0) {
      if (enFreeSpin) {
        freeSpinBank += win;
      } else {
        await fetch("/update-balance", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            username: user,
            amount: win
          })
        });

        saldoActual += win;
      }
    }

    // 🏁 FIN FREE SPINS
    if (enFreeSpin && freeSpinsRestantes === 0 && freeSpinBank > 0) {
      await fetch("/update-balance", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          username: user,
          amount: freeSpinBank
        })
      });

      saldoActual += freeSpinBank;
      freeSpinBank = 0;
      enFreeSpin = false;
    }

    showBalance();

    setText("resultado",
      win > 0 ? `Ganaste ${win}` : "Sin premio"
    );

  } catch (err) {
    setText("resultado", "Error: " + err.message);
  } finally {
    document.getElementById("spinBtn").disabled = false;
    playing = false;
  }
}

// 🚀 INIT
document.addEventListener("DOMContentLoaded", async () => {
  await loadSession();
  renderBoard(generateBoard());
});