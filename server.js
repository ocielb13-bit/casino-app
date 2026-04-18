import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "SUPER_SECRET_KEY";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

/* ================= SETTINGS ================= */

const DEFAULT_SETTINGS = {
  win_rate: 30,
  rtp: 90,
  slot_pay_3: 2,
  slot_pay_4: 5,
  slot_pay_5: 10,
  roulette_winrate: 48,
  roulette_payout: 35,
  free_spin_award: 5,
  default_balance: 1000,
  volatility: "medium"
};

async function getSettings() {
  const { data } = await supabase.from("game_settings").select("*");
  const s = { ...DEFAULT_SETTINGS };

  (data || []).forEach((row) => {
    if (row.key === "volatility") {
      s[row.key] = String(row.value || "medium");
    } else {
      const n = Number(row.value);
      s[row.key] = Number.isFinite(n) ? n : s[row.key];
    }
  });

  return s;
}

async function saveSettings(values) {
  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value: String(value)
  }));

  if (rows.length > 0) {
    await supabase.from("game_settings").upsert(rows, { onConflict: "key" });
  }
}

/* ================= USERS ================= */

async function getUserById(id) {
  const { data } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return data || null;
}

async function getUserByUsername(username) {
  const { data } = await supabase
    .from("app_users")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  return data || null;
}

async function saveUser(id, data) {
  await supabase.from("app_users").update(data).eq("id", id);
}

/* ================= AUTH ================= */

function issueToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function authRequired(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(payload.id);

    if (!user) return res.status(401).json({ error: "Sesión inválida" });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Solo admin" });
  }
  next();
}

async function passwordMatches(plain, stored) {
  if (!stored) return false;

  if (String(stored).startsWith("$2")) {
    return bcrypt.compare(plain, stored);
  }

  return plain === stored;
}

/* ================= LOGIN ================= */

app.post("/api/login", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "").trim();

  if (!username || !password) {
    return res.status(400).json({ error: "Poné usuario y contraseña" });
  }

  const user = await getUserByUsername(username);
  if (!user) return res.status(400).json({ error: "Usuario no existe" });

  const ok = await passwordMatches(password, user.password);
  if (!ok) return res.status(400).json({ error: "Contraseña incorrecta" });

  res.json({
    success: true,
    token: issueToken(user),
    username: user.username,
    role: user.role,
    balance: Number(user.balance || 0)
  });
});

app.post("/api/logout", (req, res) => {
  res.json({ success: true });
});

app.get("/api/me", authRequired, (req, res) => {
  const bonusState = getSlotBonusState(req.user.id);

  res.json({
    success: true,
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
    balance: Number(req.user.balance || 0),
    freeSpins: Number(req.user.freeSpins || 0),
    bonusMeter: Number(bonusState.meter || 0),
    bonusChain: Number(bonusState.chain || 0)
  });
});

/* ================= ADMIN ================= */

app.get("/api/game-info", authRequired, async (req, res) => {
  const settings = await getSettings();
  res.json({
    success: true,
    ...settings,
    bank: casinoBank,
    jackpot_bank: casinoBank
  });
});

app.get("/api/admin/settings", authRequired, adminOnly, async (req, res) => {
  res.json(await getSettings());
});

app.put("/api/admin/settings", authRequired, adminOnly, async (req, res) => {
  try {
    const next = {};

    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (req.body[key] !== undefined) {
        if (key === "volatility") {
          const v = String(req.body[key]).toLowerCase();
          next[key] = ["low", "medium", "high"].includes(v) ? v : "medium";
        } else {
          const raw = Number(req.body[key]);
          if (Number.isFinite(raw)) next[key] = raw;
        }
      }
    }

    if (next.win_rate !== undefined) next.win_rate = Math.max(1, Math.min(99.9, next.win_rate));
    if (next.rtp !== undefined) next.rtp = Math.max(1, Math.min(99.9, next.rtp));
    if (next.default_balance !== undefined) next.default_balance = Math.max(0, Math.floor(next.default_balance));
    if (next.slot_pay_3 !== undefined) next.slot_pay_3 = Math.max(0, Math.floor(next.slot_pay_3));
    if (next.slot_pay_4 !== undefined) next.slot_pay_4 = Math.max(0, Math.floor(next.slot_pay_4));
    if (next.slot_pay_5 !== undefined) next.slot_pay_5 = Math.max(0, Math.floor(next.slot_pay_5));
    if (next.roulette_winrate !== undefined) next.roulette_winrate = Math.max(1, Math.min(99.9, next.roulette_winrate));
    if (next.roulette_payout !== undefined) next.roulette_payout = Math.max(1, Math.floor(next.roulette_payout));
    if (next.free_spin_award !== undefined) next.free_spin_award = Math.max(0, Math.floor(next.free_spin_award));

    await saveSettings(next);
    res.json({ success: true, ...(await getSettings()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/users", authRequired, adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from("app_users")
    .select("id, username, role, balance, freeSpins")
    .order("id", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    success: true,
    users: (data || []).map((u) => ({
      ...u,
      balance: Number(u.balance || 0),
      freeSpins: Number(u.freeSpins || 0)
    }))
  });
});

app.post("/api/admin/users", authRequired, adminOnly, async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "").trim();
    const role = req.body.role === "admin" ? "admin" : "player";
    const balance = Number(req.body.balance || 0);

    if (!username || !password) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    const existing = await getUserByUsername(username);
    if (existing) {
      return res.status(400).json({ error: "Usuario ya existe" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const { error } = await supabase.from("app_users").insert({
      username,
      password: hashed,
      role,
      balance: Math.max(0, Math.floor(balance)),
      freeSpins: 0
    });

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/user/:id/balance", authRequired, adminOnly, async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const newBalance = Number(req.body.amount);
  if (!Number.isFinite(newBalance)) {
    return res.status(400).json({ error: "Monto inválido" });
  }

  await saveUser(user.id, { balance: Math.max(0, Math.floor(newBalance)) });
  res.json({ success: true });
});

/* ================= SLOTS ================= */

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;

  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.symbol;
  }

  return items[items.length - 1].symbol;
}

const PAYLINES = [
  [0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2],
  [0, 0, 1, 0, 0],
  [2, 2, 1, 2, 2],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [1, 0, 1, 2, 1],
  [1, 2, 1, 0, 1],
  [0, 0, 0, 1, 2],
  [2, 2, 2, 1, 0],
  [0, 1, 2, 2, 2],
  [2, 1, 0, 0, 0],
  [1, 1, 0, 1, 1],
  [1, 1, 2, 1, 1],
  [0, 2, 0, 2, 0],
  [2, 0, 2, 0, 2],
  [0, 2, 1, 0, 2],
  [2, 0, 1, 2, 0]
];

const SYMBOL_WEIGHTS = {
  low: [
    { symbol: "coin.png", weight: 30 },
    { symbol: "jade.png", weight: 24 },
    { symbol: "lantern.png", weight: 20 },
    { symbol: "goldpot.png", weight: 12 },
    { symbol: "dragon.png", weight: 5 },
    { symbol: "wild.png", weight: 6 },
    { symbol: "scatter.png", weight: 3 }
  ],
  medium: [
    { symbol: "coin.png", weight: 24 },
    { symbol: "jade.png", weight: 20 },
    { symbol: "lantern.png", weight: 18 },
    { symbol: "goldpot.png", weight: 12 },
    { symbol: "dragon.png", weight: 8 },
    { symbol: "wild.png", weight: 5 },
    { symbol: "scatter.png", weight: 3 }
  ],
  high: [
    { symbol: "coin.png", weight: 18 },
    { symbol: "jade.png", weight: 18 },
    { symbol: "lantern.png", weight: 16 },
    { symbol: "goldpot.png", weight: 12 },
    { symbol: "dragon.png", weight: 12 },
    { symbol: "wild.png", weight: 6 },
    { symbol: "scatter.png", weight: 4 }
  ]
};

const SYMBOL_MULTIPLIERS = {
  "coin.png": 1,
  "jade.png": 1.1,
  "lantern.png": 1.25,
  "goldpot.png": 1.5,
  "dragon.png": 2.5,
  "wild.png": 3
};

let casinoBank = 100000;
const slotBonusState = new Map();

function getSlotBonusState(userId) {
  const key = Number(userId);
  if (!slotBonusState.has(key)) {
    slotBonusState.set(key, { meter: 0, chain: 0 });
  }

  const state = slotBonusState.get(key);
  return {
    meter: Number(state.meter || 0),
    chain: Number(state.chain || 0)
  };
}

function setSlotBonusState(userId, state) {
  const key = Number(userId);
  slotBonusState.set(key, {
    meter: Math.max(0, Math.min(99, Math.floor(Number(state.meter || 0)))),
    chain: Math.max(0, Math.floor(Number(state.chain || 0)))
  });
}

function bonusMultiplierFromChain(chain) {
  if (chain <= 0) return 1;
  return Number((1 + Math.min(2, chain * 0.25)).toFixed(2));
}

function buildBoard(settings) {
  const weights = SYMBOL_WEIGHTS[String(settings.volatility || "medium")] || SYMBOL_WEIGHTS.medium;

  return Array.from({ length: 5 }, () =>
    Array.from({ length: 3 }, () => weightedPick(weights))
  );
}

function resolvePaylineTarget(board, line) {
  for (let col = 0; col < line.length; col++) {
    const symbol = board[col][line[col]];
    if (symbol !== "wild.png" && symbol !== "scatter.png") {
      return symbol;
    }
  }

  return "wild.png";
}

function evaluatePayline(board, line, betPerLine, settings, lineNumber) {
  const target = resolvePaylineTarget(board, line);
  const cells = [];
  let count = 0;

  for (let col = 0; col < line.length; col++) {
    const row = line[col];
    const symbol = board[col][row];

    if (symbol === target || symbol === "wild.png") {
      count += 1;
      cells.push(`r${col}c${row}`);
    } else {
      break;
    }
  }

  if (count < 3) return null;

  let payout = 0;
  if (count === 3) payout = betPerLine * settings.slot_pay_3;
  else if (count === 4) payout = betPerLine * settings.slot_pay_4;
  else payout = betPerLine * settings.slot_pay_5;

  payout *= SYMBOL_MULTIPLIERS[target] || 1;
  payout = Math.floor(payout);

  return {
    lineNumber,
    symbol: target,
    count,
    payout,
    cells,
    line
  };
}

function calcSlotWin(board, bet, settings) {
  const paylines = [];
  let win = 0;

  const betPerLine = bet / PAYLINES.length;

  PAYLINES.forEach((line, index) => {
    const hit = evaluatePayline(board, line, betPerLine, settings, index + 1);
    if (hit) {
      paylines.push(hit);
      win += hit.payout;
    }
  });

  const scatterCells = [];
  board.forEach((column, col) => {
    column.forEach((symbol, row) => {
      if (symbol === "scatter.png") {
        scatterCells.push(`r${col}c${row}`);
      }
    });
  });

  const scatterCount = scatterCells.length;
  const freeSpinsAwarded = scatterCount >= 3 ? Number(settings.free_spin_award || 5) : 0;

  const winSummary = paylines.length
    ? paylines.map((p) => `Línea ${p.lineNumber} paga ${p.payout}`).join(" ⇒ ")
    : "";

  return {
    win: Math.floor(win),
    paylines,
    scatterCount,
    scatterCells,
    freeSpinsAwarded,
    winSummary,
    betPerLine
  };
}

app.post("/api/slots/spin", async (req, res) => {
  try {
    const userId = req.user.id;
    const { bet, lines } = req.body;

    // 🔹 traer usuario
    const user = await db.getUser(userId);

    const totalBet = bet * lines;

    if (user.balance < totalBet) {
      return res.status(400).json({ error: "Sin saldo" });
    }

    // 🔹 descontar apuesta
    await db.updateBalance(userId, user.balance - totalBet);

    // 🔹 traer settings del admin
    const settings = await db.getSettings();

    // 🎰 SPIN PRO
    const result = spinSlot({
      bet,
      lines,
      settings
    });

    // 🔹 sumar premio
    const newBalance = user.balance - totalBet + result.win;
    await db.updateBalance(userId, newBalance);

    res.json({
      board: result.board,
      win: result.win,
      balance: newBalance
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en spin" });
  }
});

    if (!Number.isFinite(bet) || bet <= 0) {
      return res.status(400).json({ error: "Apuesta inválida" });
    }

    let freeSpins = Number(user.freeSpins || 0);
    const isFreeSpin = freeSpins > 0;
    const bonusState = getSlotBonusState(user.id);

    if (!isFreeSpin && user.balance < bet) {
      return res.status(400).json({ error: "Saldo insuficiente" });
    }

    const board = buildBoard(settings);
    const outcome = calcSlotWin(board, bet, settings);

    let meterAward = 0;
    if (!isFreeSpin) {
      const meterGain = Math.min(60, (outcome.scatterCount * 18) + (outcome.win > 0 ? 5 : 0));
      if (meterGain > 0) {
        bonusState.meter = Math.min(100, bonusState.meter + meterGain);

        if (bonusState.meter >= 100) {
          meterAward = Number(settings.free_spin_award || 5);
          bonusState.meter -= 100;
          if (bonusState.meter < 0) bonusState.meter = 0;
        }
      }
      bonusState.chain = 0;
    } else {
      bonusState.chain = Math.max(1, bonusState.chain + 1);
    }

    const bonusMultiplier = isFreeSpin ? bonusMultiplierFromChain(bonusState.chain) : 1;

    if (outcome.freeSpinsAwarded > 0) {
      freeSpins += outcome.freeSpinsAwarded;
    }

    if (meterAward > 0) {
      freeSpins += meterAward;
    }

    if (isFreeSpin) {
      freeSpins = Math.max(0, freeSpins - 1);
    }

    const adjustedWin = Math.floor(outcome.win * bonusMultiplier);

    const newBalance = isFreeSpin
      ? Number(user.balance || 0) + adjustedWin
      : Number(user.balance || 0) - bet + adjustedWin;

    casinoBank = Math.max(0, casinoBank + (isFreeSpin ? 0 : bet) - adjustedWin);

    await saveUser(user.id, {
      balance: Math.max(0, Math.floor(newBalance)),
      freeSpins
    });

    setSlotBonusState(user.id, bonusState);

    res.json({
      success: true,
      board,
      win: adjustedWin,
      balance: Math.max(0, Math.floor(newBalance)),
      freeSpins,
      isFreeSpin,
      bonusMode: isFreeSpin,
      bonusMultiplier,
      bonusChain: bonusState.chain,
      bonusMeter: bonusState.meter,
      bonusTriggered: meterAward > 0,
      paylines: outcome.paylines,
      scatterCount: outcome.scatterCount,
      scatterCells: outcome.scatterCells,
      freeSpinsAwarded: outcome.freeSpinsAwarded + meterAward,
      winSummary: outcome.winSummary,
      bank: casinoBank,
      jackpot_bank: casinoBank,
      bet,
      betPerLine: Number(outcome.betPerLine.toFixed(2))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= RULETTE ================= */

app.post("/api/roulette/spin", authRequired, async (req, res) => {
  try {
    const number = Math.floor(Number(req.body.number));
    const amount = Math.floor(Number(req.body.amount));
    const settings = await getSettings();
    const user = await getUserById(req.user.id);

    if (!Number.isFinite(number) || number < 0 || number > 36) {
      return res.status(400).json({ error: "Número inválido" });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Apuesta inválida" });
    }

    if (user.balance < amount) {
      return res.status(400).json({ error: "Saldo insuficiente" });
    }

    const result = Math.floor(Math.random() * 37);
    const win = result === number ? amount * Number(settings.roulette_payout || 35) : 0;
    const balance = Math.max(0, Number(user.balance || 0) - amount + win);

    await saveUser(user.id, { balance });

    res.json({
      success: true,
      result,
      win,
      balance
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= CRASH ================= */

const crashRounds = new Map();
const CRASH_GROWTH_PER_SECOND = 0.45;

function getCrashRound(userId) {
  return crashRounds.get(userId) || null;
}

function crashMultiplierAt(startedAt) {
  const elapsed = Date.now() - startedAt;
  return Number((1 + (elapsed / 1000) * CRASH_GROWTH_PER_SECOND).toFixed(2));
}

function pickCrashPoint(settings) {
  const volatility = String(settings.volatility || "medium");
  const floor = volatility === "low" ? 1.18 : volatility === "high" ? 1.08 : 1.12;
  const ceiling = volatility === "low" ? 6 : volatility === "high" ? 20 : 12;
  const exponent = volatility === "low" ? 1.4 : volatility === "high" ? 2.8 : 1.9;

  return Number((floor + Math.pow(Math.random(), exponent) * (ceiling - floor)).toFixed(2));
}

function clearCrashRound(userId) {
  crashRounds.delete(userId);
}

app.get("/api/crash/state", authRequired, async (req, res) => {
  const round = getCrashRound(req.user.id);

  if (!round) {
    return res.json({
      success: true,
      active: false
    });
  }

  const currentMultiplier = crashMultiplierAt(round.startedAt);

  res.json({
    success: true,
    active: true,
    bet: round.bet,
    startedAt: round.startedAt,
    crashPoint: round.crashPoint,
    currentMultiplier,
    canCashout: currentMultiplier < round.crashPoint
  });
});

app.post("/api/crash/start", authRequired, async (req, res) => {
  try {
    const bet = Math.floor(Number(req.body.amount));
    const user = await getUserById(req.user.id);
    const settings = await getSettings();

    if (!Number.isFinite(bet) || bet <= 0) {
      return res.status(400).json({ error: "Apuesta inválida" });
    }

    if (getCrashRound(user.id)) {
      return res.status(400).json({ error: "Ya tenés una partida activa" });
    }

    if (user.balance < bet) {
      return res.status(400).json({ error: "Saldo insuficiente" });
    }

    const crashPoint = pickCrashPoint(settings);
    const startedAt = Date.now();
    const newBalance = Math.max(0, Number(user.balance || 0) - bet);

    crashRounds.set(user.id, {
      bet,
      crashPoint,
      startedAt
    });

    await saveUser(user.id, { balance: newBalance });

    res.json({
      success: true,
      active: true,
      bet,
      startedAt,
      crashPoint,
      balance: newBalance,
      currentMultiplier: 1
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/crash/cashout", authRequired, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    const round = getCrashRound(user.id);

    if (!round) {
      return res.status(400).json({ error: "No hay partida activa" });
    }

    const currentMultiplier = crashMultiplierAt(round.startedAt);

    if (currentMultiplier >= round.crashPoint) {
      clearCrashRound(user.id);
      return res.json({
        success: false,
        crashed: true,
        crashPoint: round.crashPoint
      });
    }

    const payout = Math.max(0, Math.floor(round.bet * currentMultiplier));
    const newBalance = Math.max(0, Number(user.balance || 0) + payout);

    clearCrashRound(user.id);
    await saveUser(user.id, { balance: newBalance });

    res.json({
      success: true,
      win: payout,
      balance: newBalance,
      cashoutMultiplier: currentMultiplier,
      crashPoint: round.crashPoint
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/crash/crash", authRequired, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    const round = getCrashRound(user.id);

    if (round) {
      clearCrashRound(user.id);
    }

    res.json({
      success: true,
      crashed: true,
      balance: Number(user.balance || 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= BLACKJACK ================= */

const blackjackGames = new Map();

const BLACKJACK_SUITS = ["♠", "♥", "♦", "♣"];
const BLACKJACK_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createDeck() {
  const deck = [];

  for (const suit of BLACKJACK_SUITS) {
    for (const rank of BLACKJACK_RANKS) {
      deck.push({ rank, suit });
    }
  }

  return shuffle(deck);
}

function drawCard(deck) {
  const card = deck.pop();
  if (!card) throw new Error("Mazo agotado");
  return card;
}

function cardLabel(card) {
  return `${card.rank}${card.suit}`;
}

function serializeCard(card) {
  return {
    rank: card.rank,
    suit: card.suit,
    label: cardLabel(card)
  };
}

function serializeHand(hand) {
  return hand.map(serializeCard);
}

function blackjackHandValue(hand) {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === "A") {
      total += 11;
      aces += 1;
    } else if (["J", "Q", "K"].includes(card.rank)) {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function isBlackjack(hand) {
  return hand.length === 2 && blackjackHandValue(hand) === 21;
}

function getBlackjackGame(userId) {
  return blackjackGames.get(Number(userId)) || null;
}

function buildBlackjackState(user, game, options = {}) {
  const revealDealer = Boolean(options.revealDealer);
  const finished = Boolean(options.finished);
  const playerValue = blackjackHandValue(game.playerHand);
  const dealerValue = blackjackHandValue(game.dealerHand);

  return {
    success: true,
    active: !finished,
    finished,
    bet: game.bet,
    balance: Number(user.balance || 0),
    playerHand: serializeHand(game.playerHand),
    dealerHand: revealDealer ? serializeHand(game.dealerHand) : [serializeCard(game.dealerHand[0])],
    dealerHiddenCount: revealDealer ? 0 : Math.max(0, game.dealerHand.length - 1),
    playerValue,
    dealerValue: revealDealer ? dealerValue : blackjackHandValue([game.dealerHand[0]]),
    canHit: !finished,
    canStand: !finished,
    canDouble: !finished && game.playerHand.length === 2 && Number(user.balance || 0) >= game.bet,
    result: options.result || "",
    message: options.message || ""
  };
}

async function settleBlackjackGame(userId, game, outcome) {
  const user = await getUserById(userId);

  let payout = 0;
  if (outcome === "player_blackjack") {
    payout = Math.floor(game.bet * 2.5);
  } else if (outcome === "player_win") {
    payout = game.bet * 2;
  } else if (outcome === "push") {
    payout = game.bet;
  }

  const newBalance = Math.max(0, Number(user.balance || 0) + payout);

  blackjackGames.delete(Number(userId));
  await saveUser(userId, { balance: newBalance });

  return newBalance;
}

function dealerPlay(game) {
  while (blackjackHandValue(game.dealerHand) < 17) {
    game.dealerHand.push(drawCard(game.deck));
  }
}

function compareBlackjackHands(game) {
  const playerValue = blackjackHandValue(game.playerHand);
  const dealerValue = blackjackHandValue(game.dealerHand);

  if (playerValue > 21) return "lose";
  if (dealerValue > 21) return "player_win";
  if (playerValue > dealerValue) return "player_win";
  if (playerValue < dealerValue) return "lose";
  return "push";
}

app.get("/api/blackjack/state", authRequired, (req, res) => {
  const user = req.user;
  const game = getBlackjackGame(user.id);

  if (!game) {
    return res.json({
      success: true,
      active: false,
      balance: Number(user.balance || 0),
      message: "Listo para repartir"
    });
  }

  res.json(buildBlackjackState(user, game, {
    finished: false,
    revealDealer: false,
    message: "Tu turno"
  }));
});

app.post("/api/blackjack/deal", authRequired, async (req, res) => {
  try {
    const bet = Math.floor(Number(req.body.amount));
    const user = await getUserById(req.user.id);

    if (!Number.isFinite(bet) || bet <= 0) {
      return res.status(400).json({ error: "Apuesta inválida" });
    }

    if (getBlackjackGame(user.id)) {
      return res.status(400).json({ error: "Ya tenés una mano activa" });
    }

    if (user.balance < bet) {
      return res.status(400).json({ error: "Saldo insuficiente" });
    }

    const deck = createDeck();
    const playerHand = [drawCard(deck), drawCard(deck)];
    const dealerHand = [drawCard(deck), drawCard(deck)];

    const newBalance = Math.max(0, Number(user.balance || 0) - bet);

    const game = {
      bet,
      deck,
      playerHand,
      dealerHand
    };

    blackjackGames.set(user.id, game);
    await saveUser(user.id, { balance: newBalance });

    const playerBJ = isBlackjack(playerHand);
    const dealerBJ = isBlackjack(dealerHand);

    if (playerBJ || dealerBJ) {
      let outcome = "lose";
      let message = "Perdiste";
      let result = "lose";

      if (playerBJ && dealerBJ) {
        outcome = "push";
        message = "Push: ambos blackjack";
        result = "push";
      } else if (playerBJ) {
        outcome = "player_blackjack";
        message = "Blackjack!";
        result = "blackjack";
      } else {
        outcome = "lose";
        message = "Dealer blackjack";
        result = "dealer_blackjack";
      }

      const balance = await settleBlackjackGame(user.id, game, outcome);

      return res.json({
        success: true,
        active: false,
        finished: true,
        bet,
        balance,
        playerHand: serializeHand(playerHand),
        dealerHand: serializeHand(dealerHand),
        dealerHiddenCount: 0,
        playerValue: blackjackHandValue(playerHand),
        dealerValue: blackjackHandValue(dealerHand),
        canHit: false,
        canStand: false,
        canDouble: false,
        result,
        message
      });
    }

    return res.json(buildBlackjackState(
      { ...user, balance: newBalance },
      game,
      { finished: false, revealDealer: false, message: "Tu turno" }
    ));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/blackjack/action", authRequired, async (req, res) => {
  try {
    const action = String(req.body.action || "").toLowerCase();
    const user = await getUserById(req.user.id);
    const game = getBlackjackGame(user.id);

    if (!game) {
      return res.status(400).json({ error: "No hay mano activa" });
    }

    if (action === "hit") {
      game.playerHand.push(drawCard(game.deck));

      const playerValue = blackjackHandValue(game.playerHand);

      if (playerValue > 21) {
        blackjackGames.delete(user.id);
        return res.json({
          success: true,
          active: false,
          finished: true,
          result: "lose",
          message: "Te pasaste",
          bet: game.bet,
          balance: Number(user.balance || 0),
          playerHand: serializeHand(game.playerHand),
          dealerHand: serializeHand(game.dealerHand),
          dealerHiddenCount: 0,
          playerValue,
          dealerValue: blackjackHandValue(game.dealerHand),
          canHit: false,
          canStand: false,
          canDouble: false
        });
      }

      await saveUser(user.id, { balance: Number(user.balance || 0) });

      return res.json(buildBlackjackState(user, game, {
        finished: false,
        revealDealer: false,
        message: "Tu turno"
      }));
    }

    if (action === "double") {
      if (game.playerHand.length !== 2) {
        return res.status(400).json({ error: "Solo podés doblar con 2 cartas" });
      }

      if (user.balance < game.bet) {
        return res.status(400).json({ error: "Saldo insuficiente para doblar" });
      }

      const balanceAfterDouble = Math.max(0, Number(user.balance || 0) - game.bet);
      await saveUser(user.id, { balance: balanceAfterDouble });
      game.bet *= 2;

      game.playerHand.push(drawCard(game.deck));
      const playerValue = blackjackHandValue(game.playerHand);

      if (playerValue > 21) {
        blackjackGames.delete(user.id);
        return res.json({
          success: true,
          active: false,
          finished: true,
          result: "lose",
          message: "Te pasaste",
          bet: game.bet,
          balance: balanceAfterDouble,
          playerHand: serializeHand(game.playerHand),
          dealerHand: serializeHand(game.dealerHand),
          dealerHiddenCount: 0,
          playerValue,
          dealerValue: blackjackHandValue(game.dealerHand),
          canHit: false,
          canStand: false,
          canDouble: false
        });
      }

      dealerPlay(game);

      const outcome = compareBlackjackHands(game);
      const balance = await settleBlackjackGame(user.id, game, outcome);

      return res.json({
        success: true,
        active: false,
        finished: true,
        result: outcome,
        message: outcome === "player_win" ? "Ganaste" : outcome === "push" ? "Push" : "Perdiste",
        bet: game.bet,
        balance,
        playerHand: serializeHand(game.playerHand),
        dealerHand: serializeHand(game.dealerHand),
        dealerHiddenCount: 0,
        playerValue: blackjackHandValue(game.playerHand),
        dealerValue: blackjackHandValue(game.dealerHand),
        canHit: false,
        canStand: false,
        canDouble: false
      });
    }

    if (action === "stand") {
      dealerPlay(game);

      const outcome = compareBlackjackHands(game);
      const balance = await settleBlackjackGame(user.id, game, outcome);

      return res.json({
        success: true,
        active: false,
        finished: true,
        result: outcome,
        message: outcome === "player_win" ? "Ganaste" : outcome === "push" ? "Push" : "Perdiste",
        bet: game.bet,
        balance,
        playerHand: serializeHand(game.playerHand),
        dealerHand: serializeHand(game.dealerHand),
        dealerHiddenCount: 0,
        playerValue: blackjackHandValue(game.playerHand),
        dealerValue: blackjackHandValue(game.dealerHand),
        canHit: false,
        canStand: false,
        canDouble: false
      });
    }

    return res.status(400).json({ error: "Acción inválida" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= START ================= */

app.listen(PORT, () => {
  console.log("🔥 Casino PRO corriendo");
});