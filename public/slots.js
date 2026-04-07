// slots.js - Asian Dragon con saldo real, free spins y jackpot

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

let playing = false;
let apuestaActual = 0;

let jackpotAcumulado = 1000;
let freeSpinsRestantes = 0;
let freeSpinBank = 0;
let saldoActual = 0;
let username = "";

function symbolSrc(symbolId) {
  return `/assets/symbols/asian/${symbolId}.png`;
}

function pickSymbol() {
  return WEIGHTED_POOL[Math.floor(Math.random() * WEIGHTED_POOL.length)];
}

function setCell(id, symbolId) {
  const img = document.getElementById(`img-${id}`);
  if (!img) return;
  img.src = symbolSrc(symbolId);
  img.alt = symbolId;
}

function renderBoard(board) {
  Object.keys(board).forEach((id) => setCell(id, board[id]));
}

function generateBoard() {
  const board = {};
  [...CELL_IDS.top, ...CELL_IDS.row1, ...CELL_IDS.row2, ...CELL_IDS.bottom].forEach((id) => {
    board[id] = pickSymbol();
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

async function loadSession() {
  const me = await api("/api/me");

  if (me.role === "admin") {
    window.location.href = "/admin.html";
    return;
  }

  username = me.username;
  saldoActual = Number(me.balance || 0);
  freeSpinsRestantes = Number(me.free_spins || 0);
  freeSpinBank = Number(me.free_spin_bank || 0);

  setText("playerLine", `Usuario: ${username}`);
  showBalance();
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

function clearInfo() {
  setText("resultado", "");
  setText("detallePago", "");
  setText("bonusHint", "");
}

async function jugar() {
  if (playing) return;
  playing = true;

  try {
    const apuesta = parseInt(document.getElementById("apuesta").value, 10);
    if (!Number.isInteger(apuesta) || apuesta <= 0) {
      setText("resultado", "Apuesta inválida");
      return;
    }

    apuestaActual = apuesta;

    if (freeSpinsRestantes === 0 && apuestaActual > saldoActual) {
      setText("resultado", "No tenés saldo suficiente");
      return;
    }

    document.getElementById("spinBtn").disabled = true;
    resetHighlights();
    clearInfo();

    // resta apuesta si no está en free spin
    if (freeSpinsRestantes > 0) {
      freeSpinsRestantes--;
    } else {
      await api("/api/slots/spin", {
        method: "POST",
        body: JSON.stringify({
          amount: 0,
          theme: "asian"
        })
      }).catch(() => {});
    }

    // generamos board visual local
    const board = generateBoard();
    renderBoard(board);

    await Promise.all([
      spinGroup(CELL_IDS.top, board, 650, 60),
      spinGroup(CELL_IDS.row1, board, 850, 60),
      spinGroup(CELL_IDS.row2, board, 980, 60),
      spinGroup(CELL_IDS.bottom, board, 760, 60)
    ]);

    const topVals = lineValues(board, CELL_IDS.top);
    const row1Vals = lineValues(board, CELL_IDS.row1);
    const row2Vals = lineValues(board, CELL_IDS.row2);
    const bottomVals = lineValues(board, CELL_IDS.bottom);

    const paylines = [];
    let spinWinRaw = 0;
    let freeSpinsAwarded = 0;
    let freeSpinBankPaid = 0;
    let scatterCount = 0;
    let jackpotHit = false;

    const topMatch = sameLineMatch(topVals);
    if (topMatch) {
      const win = Math.round(apuestaActual * 10);
      spinWinRaw += win;
      paylines.push({
        label: "Fila superior",
        ids: CELL_IDS.top,
        amount: win,
        tier: payoutTier(win, apuestaActual)
      });
    }

    const row1Match = sameLineMatch(row1Vals);
    if (row1Match) {
      const win = Math.round(apuestaActual * 6);
      spinWinRaw += win;
      paylines.push({
        label: "Fila central A",
        ids: CELL_IDS.row1,
        amount: win,
        tier: payoutTier(win, apuestaActual)
      });
    }

    const row2Match = sameLineMatch(row2Vals);
    if (row2Match) {
      const win = Math.round(apuestaActual * 6);
      spinWinRaw += win;
      paylines.push({
        label: "Fila central B",
        ids: CELL_IDS.row2,
        amount: win,
        tier: payoutTier(win, apuestaActual)
      });
    }

    for (let i = 0; i < 5; i++) {
      if (pairMatch(row1Vals[i], row2Vals[i])) {
        const win = Math.round(apuestaActual * 2);
        spinWinRaw += win;
        paylines.push({
          label: `Par ${i + 1}`,
          ids: [`c1_${i}`, `c2_${i}`],
          amount: win,
          tier: payoutTier(win, apuestaActual)
        });
      }
    }

    if (bottomVals.every((s) => s === "dragon")) {
      jackpotHit = true;
      const win = jackpotAcumulado + Math.round(apuestaActual * 40);
      spinWinRaw += win;
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
    const allIds = [...CELL_IDS.top, ...CELL_IDS.row1, ...CELL_IDS.row2, ...CELL_IDS.bottom];

    allSymbols.forEach((sym, index) => {
      if (SYMBOL_KIND[sym] === "scatter") {
        scatterCells.push(allIds[index]);
      }
    });

    scatterCount = scatterCells.length;

    if (scatterCount >= 3) {
      freeSpinsRestantes += 5;
      freeSpinsAwarded = 5;
    }

    let creditedNow = 0;

    if (spinWinRaw > 0) {
      if (freeSpinsRestantes > 0) {
        freeSpinBank += spinWinRaw;
      } else {
        await api("/update-balance", {
          method: "POST",
          body: JSON.stringify({
            username,
            amount: spinWinRaw
          })
        });

        saldoActual += spinWinRaw;
        creditedNow = spinWinRaw;
      }
    }

    if (freeSpinsRestantes === 0 && freeSpinBank > 0) {
      await api("/update-balance", {
        method: "POST",
        body: JSON.stringify({
          username,
          amount: freeSpinBank
        })
      });

      saldoActual += freeSpinBank;
      freeSpinBankPaid = freeSpinBank;
      creditedNow += freeSpinBank;
      freeSpinBank = 0;
    }

    showBalance();

    if (spinWinRaw > 0) {
      setText("resultado", `🎉 Ganaste ${spinWinRaw}`);
    } else {
      setText("resultado", "😢 Sin premio");
    }

    if (creditedNow > 0) {
      setText("detallePago", `Saldo agregado: ${creditedNow}`);
    } else {
      setText("detallePago", "Sin pago");
    }

    if (scatterCount === 2) {
      setText("bonusHint", "✨ Hay 2 scatters. Falta 1 para free spins.");
      highlightCells(scatterCells, "scatter-hint");
    }

    if (freeSpinsAwarded > 0) {
      setText("bonusHint", "🌀 Free spins activados.");
      highlightCells(scatterCells, "free-hint");
    }

    paylines.forEach((line) => {
      highlightCells(line.ids, line.tier);
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
    renderBoard(generateBoard());
  } catch {
    window.location.href = "/";
  }
});