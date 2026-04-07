// slots.js - imágenes, luces de pago, scatters, wild, free spins y RTP

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

// Tema guardado para no perder estilo
const savedTheme = localStorage.getItem("slotTheme") || "asian";

// Estado local
let session = null;
let playing = false;

// Reels por línea
const CELL_IDS = {
  top: ["tr1", "tr2", "tr3"],
  row1: ["c1_0", "c1_1", "c1_2", "c1_3", "c1_4"],
  row2: ["c2_0", "c2_1", "c2_2", "c2_3", "c2_4"],
  bottom: ["br1", "br2", "br3"]
};

// Imágenes tipo tarjeta/SVG para cada tema
const THEME_ART = {
  asian: {
    dragon: { label: "龍", a: "#ffbe2e", b: "#7d2a00", c: "#fff2b5" },
    coin: { label: "金", a: "#ffd85b", b: "#5a3a00", c: "#fff7cf" },
    jade: { label: "玉", a: "#32d6a2", b: "#0a4934", c: "#d8fff2" },
    scroll: { label: "卷", a: "#ffca7b", b: "#7f4219", c: "#fff0d8" },
    monk: { label: "僧", a: "#9b6cff", b: "#241046", c: "#f0e6ff" },
    wild: { label: "WILD", a: "#ff57aa", b: "#3a0a28", c: "#ffe0ef" },
    scatter: { label: "BONUS", a: "#55e4ff", b: "#0a2640", c: "#e8fbff" },
    seven: { label: "7", a: "#ff4040", b: "#3b0909", c: "#ffd6d6" }
  },
  classic: {
    cherry: { label: "🍒", a: "#ff5e7a", b: "#4e0a12", c: "#ffd9df" },
    lemon: { label: "🍋", a: "#ffe16a", b: "#6e5300", c: "#fff7ce" },
    plum: { label: "🍇", a: "#9d62ff", b: "#351060", c: "#efe2ff" },
    bell: { label: "🔔", a: "#ffcf56", b: "#694000", c: "#fff1c0" },
    bar: { label: "BAR", a: "#d9d9d9", b: "#2b2b2b", c: "#ffffff" },
    wild: { label: "WILD", a: "#48d6ff", b: "#08314a", c: "#e5fbff" },
    scatter: { label: "BONUS", a: "#55e4ff", b: "#0a2640", c: "#e8fbff" },
    seven: { label: "7", a: "#ff4040", b: "#3b0909", c: "#ffd6d6" }
  },
  fruits: {
    cherry: { label: "🍒", a: "#ff5e7a", b: "#4e0a12", c: "#ffd9df" },
    lemon: { label: "🍋", a: "#ffe16a", b: "#6e5300", c: "#fff7ce" },
    melon: { label: "🍉", a: "#5cff9a", b: "#0a4b2c", c: "#e2fff0" },
    grape: { label: "🍇", a: "#9d62ff", b: "#351060", c: "#efe2ff" },
    orange: { label: "🍊", a: "#ff9f45", b: "#6f3400", c: "#fff0d6" },
    wild: { label: "WILD", a: "#48d6ff", b: "#08314a", c: "#e5fbff" },
    scatter: { label: "BONUS", a: "#55e4ff", b: "#0a2640", c: "#e8fbff" },
    seven: { label: "7", a: "#ff4040", b: "#3b0909", c: "#ffd6d6" }
  }
};

function makeSvgCard(label, a, b, c) {
  const fontSize = label.length > 4 ? 22 : label.length > 2 ? 28 : 44;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${a}" />
          <stop offset="100%" stop-color="${b}" />
        </linearGradient>
        <radialGradient id="shine" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.42" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect x="10" y="10" width="160" height="160" rx="28" fill="url(#bg)" stroke="${c}" stroke-width="5"/>
      <rect x="24" y="24" width="132" height="132" rx="20" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
      <ellipse cx="90" cy="66" rx="50" ry="28" fill="url(#shine)" />
      <text x="90" y="${label.length > 4 ? 97 : 103}" text-anchor="middle" font-size="${fontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="900" fill="#ffffff" stroke="rgba(0,0,0,0.20)" stroke-width="2">${label}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildCatalog(theme) {
  const defs = THEME_ART[theme] || THEME_ART.asian;
  const cache = {};

  for (const [id, meta] of Object.entries(defs)) {
    cache[id] = {
      id,
      label: meta.label,
      src: makeSvgCard(meta.label, meta.a, meta.b, meta.c)
    };
  }

  return cache;
}

function randomSymbolId(theme) {
  const catalog = buildCatalog(theme);
  const ids = Object.keys(catalog);
  return ids[Math.floor(Math.random() * ids.length)];
}

function cellImgId(cellId) {
  return `img-${cellId}`;
}

function setCellImage(cellId, theme, symbolId) {
  const catalog = buildCatalog(theme);
  const img = document.getElementById(cellImgId(cellId));
  if (!img || !catalog[symbolId]) return;
  img.src = catalog[symbolId].src;
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

function spinGroup(cellIds, finalIds, theme, duration = 800, tick = 70) {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      cellIds.forEach((cellId) => {
        setCellImage(cellId, theme, randomSymbolId(theme));
      });
    }, tick);

    setTimeout(() => {
      clearInterval(interval);
      cellIds.forEach((cellId, index) => {
        setCellImage(cellId, theme, finalIds[index]);
      });
      resolve(finalIds);
    }, duration);
  });
}

function renderBoard(board, theme) {
  CELL_IDS.top.forEach((id, i) => setCellImage(id, theme, board.top[i]));
  CELL_IDS.row1.forEach((id, i) => setCellImage(id, theme, board.row1[i]));
  CELL_IDS.row2.forEach((id, i) => setCellImage(id, theme, board.row2[i]));
  CELL_IDS.bottom.forEach((id, i) => setCellImage(id, theme, board.bottom[i]));
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

async function loadSession() {
  const me = await api("/api/me");
  session = me;

  if (me.role === "admin") {
    window.location.href = "/admin.html";
    return;
  }

  setText("playerLine", `Usuario: ${me.username}`);
  setText("saldo", me.balance);
  setText("freeLine", me.free_spins || 0);
  setText("bankLine", me.free_spin_bank || 0);

  const themeSelect = document.getElementById("theme");
  themeSelect.value = localStorage.getItem("slotTheme") || "asian";
}

function clearInfo() {
  setText("resultado", "");
  setText("detallePago", "");
  setText("bonusHint", "");
}

function applyOutcome(res) {
  setText("saldo", res.balance);
  setText("freeLine", res.freeSpinsRemaining);
  setText("bankLine", res.freeSpinBank);
  setText("jackpotLine", res.jackpotBank);

  const main = [];

  if (res.spinWinRaw > 0) {
    main.push(`Ganancia de giro: ${res.spinWinRaw}`);
  } else {
    main.push("Sin premio");
  }

  if (res.creditedNow > 0) {
    main.push(`Saldo sumado: ${res.creditedNow}`);
  }

  if (res.freeSpinsAwarded > 0) {
    main.push(`+${res.freeSpinsAwarded} free spins`);
  }

  if (res.freeSpinBankPaid > 0) {
    main.push(`Cobro free: ${res.freeSpinBankPaid}`);
  }

  if (res.scatterCount === 2) {
    main.push("Faltó 1 scatter para free spins");
  }

  setText("resultado", main.join(" | "));

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
    const amount = parseInt(document.getElementById("apuesta").value, 10);
    const theme = document.getElementById("theme").value;

    localStorage.setItem("slotTheme", theme);

    if (!Number.isInteger(amount) || amount <= 0) {
      setText("resultado", "Poné una apuesta válida.");
      return;
    }

    const spinBtn = document.getElementById("spinBtn");
    spinBtn.disabled = true;

    resetHighlights();
    clearInfo();

    const res = await api("/api/slots/spin", {
      method: "POST",
      body: JSON.stringify({ amount, theme })
    });

    await Promise.all([
      spinGroup(CELL_IDS.top, res.board.top, theme, 680, 60),
      spinGroup(CELL_IDS.row1, res.board.row1, theme, 860, 60),
      spinGroup(CELL_IDS.row2, res.board.row2, theme, 980, 60),
      spinGroup(CELL_IDS.bottom, res.board.bottom, theme, 760, 60)
    ]);

    renderBoard(res.board, theme);
    applyOutcome(res);
    setText("saldo", res.balance);
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
    const theme = document.getElementById("theme").value || "asian";
    renderBoard(
      {
        top: ["dragon", "coin", "jade"],
        row1: ["scroll", "monk", "wild", "scatter", "seven"],
        row2: ["coin", "jade", "scroll", "monk", "wild"],
        bottom: ["dragon", "coin", "seven"]
      },
      theme
    );
    setText("jackpotLine", "1000");
  } catch {
    window.location.href = "/";
  }
});