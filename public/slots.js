// slots.js - imágenes asian dragon, luces de pago, wild, scatter, free spins y jackpot

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  let data = {};
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    throw new Error(data.error || "Error");
  }

  return data;
}

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

let session = null;
let playing = false;
let apostaActual = 0;

let jackpotAcumulado = 1000;
let freeSpinsRestantes = 0;
let freeSpinBank = 0;
let enFreeSpin = false;
let saldoActual = 0;

function symbolSrc(symbolId) {
  return `/assets/symbols/asian/${symbolId}.png`;
}

function pickSymbol() {
  return WEIGHTED_POOL[Math.floor(Math.random() * WEIGHTED_POOL.length)];
}

function setCell(cellId, symbolId) {
  const img = document.getElementById(`img-${cellId}`);
  if (!img) return;
  img.src = symbolSrc(symbolId);
  img.alt = symbolId;
}

function resetHighlights() {
  document.querySelectorAll(".reel").forEach((el) => {
    el.className = "reel";
  });
}

function highlightCells(ids, className) {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add(className);
  });
}

function renderBoard(board) {
  CELL_IDS.top.forEach((id, i) => setCell(id, board[id]));
  CELL_IDS.row1.forEach((id, i) => setCell(id, board[id]));
  CELL_IDS.row2.forEach((id, i) => setCell(id, board[id]));
  CELL_IDS.bottom.forEach((id, i) => setCell(id, board[id]));
}

async function spinGroup(cellIds, finalMap, duration = 800, tick = 70) {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      cellIds.forEach((cellId) => {
        setCell(cellId, pickSymbol());
      });
    }, tick);

    setTimeout(() => {
      clearInterval(interval);
      cellIds.forEach((cellId) => setCell(cellId, finalMap[cellId]));
      resolve(true);
    }, duration);
  });
}

function lineValues(board, ids) {
  return ids.map((id) => board[id]);
}

function sameLineMatch(values) {
  const nonWild = values.filter((s) => SYMBOL_KIND[s] !== "wild");
  if (nonWild.length === 0) return null;

  const base = nonWild[0];
  if (SYMBOL_KIND[base] !== "regular") return null;

  const ok = values.every((s) => SYMBOL_KIND[s] === "wild" || s === base);
  return ok ? base : null;
}

function pairMatch(a, b) {
  const kindA = SYMBOL_KIND[a];
  const kindB = SYMBOL_KIND[b];

  if (!kindA || !kindB) return false;
  if (kindA === "scatter" || kindB === "scatter") return false;

  if (a === b && kindA === "regular") return true;
  if (kindA === "wild" && kindB === "regular") return true;
  if (kindB === "wild" && kindA === "regular") return true;
  if (kindA === "wild" && kindB === "wild") return true;

  return false;
}

function payoutTier(amount, bet) {
  if (amount >= bet * 30) return "win-jackpot";
  if (amount >= bet * 12) return "win-high";
  if (amount >= bet * 5) return "win-mid";
  return "win-low";
}

function boardAsObject() {
  return {
    top: ["tr1", "tr2", "tr3"],
    row1: ["c1_0", "c1_1", "c1_2", "c1_3", "c1_4"],
    row2: ["c2_0", "c2_1", "c2_2", "c2_3", "c2_4"],
    bottom: ["br1", "br2", "br3"]
  };
}

function generateBoard() {
  const board = {};
  const allCells = [
    ...CELL_IDS.top,
    ...CELL_IDS.row1,
    ...CELL_IDS.row2,
    ...CELL_IDS.bottom
  ];

  allCells.forEach((cellId) => {
    board[cellId] = pickSymbol();
  });

  return board;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function showBalance() {
  setText("saldo", saldoActual);
  setText("freeLine", freeSpinsRestantes);
  setText("bankLine", freeSpinBank);
  setText("jackpotLine", jackpotAcumulado);
}

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

  document.getElementById("playerLine").innerText = `Usuario: ${user}`;
  showBalance();
}

  saldoActual = Number(me.balance || 0);
  freeSpinsRestantes = Number(me.free_spins || 0);
  freeSpinBank = Number(me.free_spin_bank || 0);

  setText("playerLine", `Usuario: ${me.username}`);
  showBalance();
}

function clearInfo() {
  setText("resultado", "");
  setText("detallePago", "");
  setText("bonusHint", "");
}

function applyOutcome(res) {
  saldoActual = res.balance;
  freeSpinsRestantes = res.freeSpinsRemaining;
  freeSpinBank = res.freeSpinBank;
  jackpotAcumulado = res.jackpotBank;

  showBalance();

  const summary = [];

  if (res.spinWinRaw > 0) summary.push(`Premio del giro: ${res.spinWinRaw}`);
  if (res.creditedNow > 0) summary.push(`Saldo agregado: ${res.creditedNow}`);
  if (res.freeSpinsAwarded > 0) summary.push(`+${res.freeSpinsAwarded} free spins`);
  if (res.freeSpinBankPaid > 0) summary.push(`Pago free spins: ${res.freeSpinBankPaid}`);

  if (summary.length === 0) summary.push("Sin premio");

  setText("resultado", summary.join(" | "));

  if (res.paylines.length) {
    setText(
      "detallePago",
      res.paylines.map((p) => `${p.label} +${p.amount}`).join(" • ")
    );
  } else {
    setText("detallePago", "Sin línea ganadora");
  }

  if (res.scatterCount === 2) {
    setText("bonusHint", "✨ Hay 2 scatters. Falta 1 para activar free spins.");
    highlightCells(res.scatterCells, "scatter-hint");
  }

  if (res.freeSpinsAwarded > 0) {
    setText("bonusHint", "🌀 Free spins activados.");
    highlightCells(res.scatterCells, "free-hint");
  }

  res.paylines.forEach((line) => {
    highlightCells(line.ids, line.tier);
  });
}

async function jugar() {
  if (playing) return;
  playing = true;

  try {
    const apuesta = parseInt(document.getElementById("apuesta").value, 10);
    if (!Number.isInteger(apuesta) || apuesta <= 0) {
      setText("resultado", "Poné una apuesta válida.");
      return;
    }

    apuestaActual = apuesta;

    if (!enFreeSpin && apuestaActual > saldoActual) {
      setText("resultado", "No tenés saldo suficiente.");
      return;
    }

    const spinBtn = document.getElementById("spinBtn");
    spinBtn.disabled = true;

    resetHighlights();
    clearInfo();

    if (freeSpinsRestantes > 0) {
      enFreeSpin = true;
      freeSpinsRestantes--;
    } else {
      enFreeSpin = false;
      const betRes = await api("/update-balance", {
        method: "POST",
        body: JSON.stringify({ username: session.username, amount: -apuestaActual })
      });
      saldoActual = Number(betRes.balance || saldoActual - apuestaActual);
      showBalance();
    }

    const board = generateBoard();
    renderBoard(board);

    const animTop = spinGroup(CELL_IDS.top, board, 650, 60);
    const animRow1 = spinGroup(CELL_IDS.row1, board, 850, 60);
    const animRow2 = spinGroup(CELL_IDS.row2, board, 980, 60);
    const animBottom = spinGroup(CELL_IDS.bottom, board, 760, 60);

    await Promise.all([animTop, animRow1, animRow2, animBottom]);

    const topVals = lineValues(board, CELL_IDS.top);
    const row1Vals = lineValues(board, CELL_IDS.row1);
    const row2Vals = lineValues(board, CELL_IDS.row2);
    const bottomVals = lineValues(board, CELL_IDS.bottom);

    const paylines = [];
    const payoutScale = 96 / 96;

    const topMatch = sameLineMatch(topVals);
    if (topMatch) {
      const win = Math.round(apuestaActual * 10 * payoutScale);
      paylines.push({
        label: "Fila superior",
        ids: CELL_IDS.top,
        amount: win,
        tier: payoutTier(win, apuestaActual)
      });
    }

    const row1Match = sameLineMatch(row1Vals);
    if (row1Match) {
      const win = Math.round(apuestaActual * 6 * payoutScale);
      paylines.push({
        label: "Fila central A",
        ids: CELL_IDS.row1,
        amount: win,
        tier: payoutTier(win, apuestaActual)
      });
    }

    const row2Match = sameLineMatch(row2Vals);
    if (row2Match) {
      const win = Math.round(apuestaActual * 6 * payoutScale);
      paylines.push({
        label: "Fila central B",
        ids: CELL_IDS.row2,
        amount: win,
        tier: payoutTier(win, apuestaActual)
      });
    }

    for (let i = 0; i < 5; i++) {
      if (pairMatch(row1Vals[i], row2Vals[i])) {
        const win = Math.round(apuestaActual * 2 * payoutScale);
        paylines.push({
          label: `Par ${i + 1}`,
          ids: [`c1_${i}`, `c2_${i}`],
          amount: win,
          tier: payoutTier(win, apuestaActual)
        });
      }
    }

    let jackpotHit = false;
    if (bottomVals.every((s) => s === "dragon")) {
      jackpotHit = true;
      const win = jackpotAcumulado + Math.round(apuestaActual * 40);
      paylines.push({
        label: "JACKPOT",
        ids: CELL_IDS.bottom,
        amount: win,
        tier: "win-jackpot"
      });
      jackpotAcumulado = 1000;
    } else {
      jackpotAcumulado += Math.max(1, Math.round(apuestaActual * 0.1));
    }

    const allSymbols = [...topVals, ...row1Vals, ...row2Vals, ...bottomVals];
    const scatterCells = [];
    allSymbols.forEach((sym, index) => {
      if (SYMBOL_KIND[sym] === "scatter") {
        const cellId = [
          ...CELL_IDS.top,
          ...CELL_IDS.row1,
          ...CELL_IDS.row2,
          ...CELL_IDS.bottom
        ][index];
        scatterCells.push(cellId);
      }
    });

    const scatterCount = scatterCells.length;
    let freeSpinsAwarded = 0;

    if (scatterCount >= 3) {
      freeSpinsRestantes += 5;
      freeSpinsAwarded = 5;
    }

    const spinWinRaw = paylines.reduce((sum, line) => sum + line.amount, 0);

    let creditedNow = 0;
    if (spinWinRaw > 0) {
      if (enFreeSpin) {
        freeSpinBank += spinWinRaw;
      } else {
        const winRes = await api("/update-balance", {
          method: "POST",
          body: JSON.stringify({ username: session.username, amount: spinWinRaw })
        });
        saldoActual = Number(winRes.balance || saldoActual + spinWinRaw);
        creditedNow = spinWinRaw;
      }
    }

    let freeSpinBankPaid = 0;
    if (enFreeSpin && freeSpinsRestantes === 0 && freeSpinBank > 0) {
      const bankRes = await api("/update-balance", {
        method: "POST",
        body: JSON.stringify({ username: session.username, amount: freeSpinBank })
      });

      saldoActual = Number(bankRes.balance || saldoActual + freeSpinBank);
      freeSpinBankPaid = freeSpinBank;
      creditedNow += freeSpinBank;
      freeSpinBank = 0;
      enFreeSpin = false;
    }

    showBalance();

    applyOutcome({
      balance: saldoActual,
      paylines,
      spinWinRaw,
      creditedNow,
      freeSpinsRemaining: freeSpinsRestantes,
      freeSpinsAwarded,
      freeSpinBank,
      freeSpinBankPaid,
      scatterCount,
      scatterCells,
      jackpotBank: jackpotAcumulado
    });
  } catch (err) {
    setText("resultado", "❌ " + err.message);
  } finally {
    document.getElementById("spinBtn").disabled = false;
    playing = false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadSession();

    // Board inicial para que no se vea vacío
    const initial = generateBoard();
    renderBoard(initial);
    showBalance();
  } catch {
    window.location.href = "/";
  }
});