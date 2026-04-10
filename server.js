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

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
  console.error("❌ Faltan variables de entorno de Supabase");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const DEFAULT_SETTINGS = {
  win_rate: 30,
  multiplier: 2,
  jackpot_bank: 1000,
  default_balance: 1000,
  slot_pay_3: 2,
  slot_pay_4: 5,
  slot_pay_5: 10,
  roulette_payout: 35,
  free_spin_award: 5
};

const SYMBOLS = ["dragon", "goldpot", "coin", "jade", "lantern", "wild", "scatter"];

const SYMBOL_WEIGHTS = [
  { symbol: "dragon", weight: 2 },
  { symbol: "goldpot", weight: 5 },
  { symbol: "coin", weight: 18 },
  { symbol: "jade", weight: 16 },
  { symbol: "lantern", weight: 14 },
  { symbol: "wild", weight: 7 },
  { symbol: "scatter", weight: 2 }
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toInt(value, fallback = 0) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

async function getSetting(key, fallback) {
  const { data, error } = await supabase
    .from("game_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return fallback;
  const n = Number(data.value);
  return Number.isFinite(n) ? n : fallback;
}

async function getAllSettings() {
  const entries = await Promise.all(
    Object.entries(DEFAULT_SETTINGS).map(async ([key, fallback]) => [
      key,
      await getSetting(key, fallback)
    ])
  );
  return Object.fromEntries(entries);
}

async function saveSettings(values) {
  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value: String(value)
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("game_settings")
      .upsert(rows, { onConflict: "key" });

    if (error) throw error;
  }
}

async function getUserById(id) {
  const { data, error } = await supabase
    .from("app_users")
    .select("id, username, role, balance, free_spins, free_spin_bank")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    ...data,
    balance: Number(data.balance || 0),
    free_spins: Number(data.free_spins || 0),
    free_spin_bank: Number(data.free_spin_bank || 0)
  };
}

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

    if (!user) {
      return res.status(401).json({ error: "Sesión inválida" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Solo admin" });
  }
  next();
}

async function passwordMatches(plain, stored) {
  if (typeof stored === "string" && stored.startsWith("$2")) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored;
}

async function insertUser({ username, password, role = "player", balance }) {
  const hashed = await bcrypt.hash(password, 10);
  const defaultBalance = await getSetting("default_balance", DEFAULT_SETTINGS.default_balance);
  const finalBalance = Number.isFinite(Number(balance))
    ? Math.max(0, Math.floor(Number(balance)))
    : defaultBalance;

  const { error } = await supabase.from("app_users").insert({
    username,
    password: hashed,
    role,
    balance: finalBalance,
    free_spins: 0,
    free_spin_bank: 0
  });

  if (error) throw error;
}

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;

  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.symbol;
  }

  return items[items.length - 1].symbol;
}

function pickSymbol({ allowScatter = true, exclude = [] } = {}) {
  const pool = SYMBOL_WEIGHTS.filter((item) => {
    if (!allowScatter && item.symbol === "scatter") return false;
    if (exclude.includes(item.symbol)) return false;
    return true;
  });

  return weightedPick(pool.length ? pool : SYMBOL_WEIGHTS.filter((item) => !exclude.includes(item.symbol)));
}

function buildRandomBoard() {
  return Array.from({ length: 3 }, () =>
    Array.from({ length: 5 }, () => pickSymbol({ allowScatter: true }))
  );
}

function buildNearMissBoard() {
  const board = buildRandomBoard();
  const rowIndex = Math.floor(Math.random() * 3);
  const symbol = pickSymbol({ allowScatter: false });

  board[rowIndex][0] = symbol;
  board[rowIndex][1] = symbol;
  board[rowIndex][2] = pickSymbol({ allowScatter: false, exclude: [symbol] });

  return board;
}

function buildWinningBoard(count = 3) {
  const board = buildRandomBoard();
  const rowIndex = Math.floor(Math.random() * 3);
  const symbol = pickSymbol({ allowScatter: false });

  for (let i = 0; i < count; i++) {
    board[rowIndex][i] = symbol;
  }

  return board;
}

function buildBoard(settings) {
  const winRate = clamp(Number(settings.win_rate ?? DEFAULT_SETTINGS.win_rate), 1, 99.9);
  const roll = Math.random() * 100;

  if (roll < winRate * 0.60) return buildWinningBoard(3);
  if (roll < winRate * 0.88) return buildWinningBoard(4);
  if (roll < winRate) return buildWinningBoard(5);

  if (roll < winRate + 12) return buildNearMissBoard();

  return buildRandomBoard();
}

function idsForRow(rowIndex, count) {
  return Array.from({ length: count }, (_, i) => `c${rowIndex + 1}_${i}`);
}

function evaluateRow(row, rowIndex, bet, settings, jackpotBank) {
  const first = row[0];
  if (first === "scatter") return null;

  let count = 1;
  for (let i = 1; i < row.length; i++) {
    if (row[i] !== first) break;
    count += 1;
  }

  if (count < 3) return null;

  const multiplierFactor = clamp(Number(settings.multiplier ?? DEFAULT_SETTINGS.multiplier), 1, 100) / 2;

  let amount = 0;
  let tier = "win-mid";
  let jackpotHit = false;

  if (count >= 5) {
    amount = bet * settings.slot_pay_5 * multiplierFactor;
    tier = "win-jackpot";
  } else if (count === 4) {
    amount = bet * settings.slot_pay_4 * multiplierFactor;
    tier = "win-high";
  } else {
    amount = bet * settings.slot_pay_3 * multiplierFactor;
    tier = "win-mid";
  }

  if (first === "dragon" && count >= 5) {
    jackpotHit = true;
    amount = Math.max(amount, Number(jackpotBank || 0));
    tier = "win-jackpot";
  }

  return {
    label: `Fila ${rowIndex + 1}`,
    symbol: first,
    count,
    amount: Math.floor(amount),
    tier,
    jackpotHit,
    ids: idsForRow(rowIndex, count)
  };
}

function collectScatterCells(board) {
  const cells = [];
  board.forEach((row, r) => {
    row.forEach((symbol, c) => {
      if (symbol === "scatter") cells.push(`c${r + 1}_${c}`);
    });
  });
  return cells;
}

function calculateSlotOutcome(board, bet, settings, jackpotBank) {
  const paylines = [];
  let win = 0;
  let jackpotHit = false;

  board.forEach((row, rowIndex) => {
    const result = evaluateRow(row, rowIndex, bet, settings, jackpotBank);
    if (result) {
      paylines.push(result);
      win += result.amount;
      if (result.jackpotHit) jackpotHit = true;
    }
  });

  const scatterCells = collectScatterCells(board);
  const scatterCount = scatterCells.length;
  const freeSpinsAwarded = scatterCount >= 3 ? Number(settings.free_spin_award || DEFAULT_SETTINGS.free_spin_award) : 0;

  return {
    win: Math.floor(win),
    paylines,
    scatterCount,
    scatterCells,
    freeSpinsAwarded,
    jackpotHit
  };
}

async function saveUserState(id, next) {
  const { error } = await supabase
    .from("app_users")
    .update(next)
    .eq("id", id);

  if (error) throw error;
}

app.post("/api/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "").trim();

    if (!username || !password) {
      return res.status(400).json({ error: "Poné usuario y contraseña" });
    }

    const { data: user, error } = await supabase
      .from("app_users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (error || !user) {
      return res.status(400).json({ error: "Usuario no existe" });
    }

    const valid = await passwordMatches(password, user.password);
    if (!valid) {
      return res.status(400).json({ error: "Contraseña incorrecta" });
    }

    const token = issueToken(user);

    res.json({
      success: true,
      token,
      username: user.username,
      balance: Number(user.balance || 0),
      role: user.role,
      free_spins: Number(user.free_spins || 0),
      free_spin_bank: Number(user.free_spin_bank || 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/logout", (req, res) => {
  res.json({ success: true });
});

app.get("/api/me", authRequired, (req, res) => {
  res.json({
    success: true,
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
    balance: req.user.balance,
    free_spins: req.user.free_spins || 0,
    free_spin_bank: req.user.free_spin_bank || 0
  });
});

app.get("/api/game-info", authRequired, async (req, res) => {
  const settings = await getAllSettings();
  res.json({ success: true, ...settings });
});

app.get("/api/admin/settings", authRequired, adminOnly, async (req, res) => {
  const settings = await getAllSettings();
  res.json({ success: true, ...settings });
});

app.put("/api/admin/settings", authRequired, adminOnly, async (req, res) => {
  try {
    const next = {};

    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (req.body[key] !== undefined) {
        const raw = Number(req.body[key]);
        if (Number.isFinite(raw)) next[key] = raw;
      }
    }

    if (next.win_rate !== undefined) next.win_rate = clamp(next.win_rate, 1, 99.9);
    if (next.multiplier !== undefined) next.multiplier = clamp(next.multiplier, 1, 100);
    if (next.default_balance !== undefined) next.default_balance = Math.max(0, Math.floor(next.default_balance));
    if (next.jackpot_bank !== undefined) next.jackpot_bank = Math.max(1000, Math.floor(next.jackpot_bank));
    if (next.slot_pay_3 !== undefined) next.slot_pay_3 = Math.max(0, Math.floor(next.slot_pay_3));
    if (next.slot_pay_4 !== undefined) next.slot_pay_4 = Math.max(0, Math.floor(next.slot_pay_4));
    if (next.slot_pay_5 !== undefined) next.slot_pay_5 = Math.max(0, Math.floor(next.slot_pay_5));
    if (next.roulette_payout !== undefined) next.roulette_payout = Math.max(1, Math.floor(next.roulette_payout));
    if (next.free_spin_award !== undefined) next.free_spin_award = Math.max(0, Math.floor(next.free_spin_award));

    await saveSettings(next);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/users", authRequired, adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from("app_users")
    .select("id, username, role, balance, free_spins, free_spin_bank, created_at")
    .order("id", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, users: data || [] });
});

app.post("/api/admin/users", authRequired, adminOnly, async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "").trim();
    const role = req.body.role === "admin" ? "admin" : "player";
    const balance = req.body.balance;

    if (!username || !password) {
      return res.status(400).json({ error: "Poné usuario y contraseña" });
    }

    await insertUser({ username, password, role, balance });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch("/api/admin/users/:id/balance", authRequired, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const delta = Number(req.body.delta);

  if (!Number.isFinite(id) || !Number.isFinite(delta)) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  const user = await getUserById(id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const balance = Math.max(0, Math.floor(Number(user.balance) + delta));

  try {
    await saveUserState(id, { balance });
    res.json({ success: true, balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/users/:id/balance", authRequired, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const balanceInput = Number(req.body.balance);

  if (!Number.isFinite(id) || !Number.isFinite(balanceInput)) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  const balance = Math.max(0, Math.floor(balanceInput));

  try {
    await saveUserState(id, { balance });
    res.json({ success: true, balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/admin/users/:id/role", authRequired, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const role = req.body.role === "admin" ? "admin" : "player";

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Usuario inválido" });
  }

  try {
    await saveUserState(id, { role });
    res.json({ success: true, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/users/:id", authRequired, adminOnly, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Usuario inválido" });
  }

  if (id === req.user.id) {
    return res.status(400).json({ error: "No podés borrarte a vos mismo" });
  }

  const { error } = await supabase.from("app_users").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ success: true });
});

app.post("/api/register", authRequired, adminOnly, async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "").trim();
    const role = req.body.role === "admin" ? "admin" : "player";
    const balance = req.body.balance;

    if (!username || !password) {
      return res.status(400).json({ error: "Poné usuario y contraseña" });
    }

    await insertUser({ username, password, role, balance });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/test", async (req, res) => {
  const { data, error } = await supabase.from("app_users").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, users: data });
});

app.post("/api/roulette/spin", authRequired, async (req, res) => {
  try {
    const number = toInt(req.body.number, -1);
    const amount = toInt(req.body.amount, 0);
    const settings = await getAllSettings();

    if (number < 0 || number > 36) {
      return res.status(400).json({ error: "Número inválido" });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: "Apuesta inválida" });
    }

    const user = await getUserById(req.user.id);
    if (!user) return res.status(401).json({ error: "Sesión inválida" });

    if (user.balance < amount) {
      return res.status(400).json({ error: "Saldo insuficiente" });
    }

    const result = Math.floor(Math.random() * 37);
    const win = result === number ? amount * Number(settings.roulette_payout || DEFAULT_SETTINGS.roulette_payout) : 0;
    const balance = Math.max(0, user.balance - amount + win);

    await saveUserState(user.id, { balance });

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

app.post("/api/slots/spin", authRequired, async (req, res) => {
  try {
    const bet = toInt(req.body.amount, 0);
    if (bet <= 0) {
      return res.status(400).json({ error: "Apuesta inválida" });
    }

    const settings = await getAllSettings();
    const jackpotBank = await getSetting("jackpot_bank", DEFAULT_SETTINGS.jackpot_bank);
    const user = await getUserById(req.user.id);

    if (!user) return res.status(401).json({ error: "Sesión inválida" });

    const hasFreeSpins = user.free_spins > 0 || user.free_spin_bank > 0;
    if (!hasFreeSpins && user.balance < bet) {
      return res.status(400).json({ error: "Saldo insuficiente" });
    }

    const board = buildBoard(settings);
    const outcome = calculateSlotOutcome(board, bet, settings, jackpotBank);

    const spend = hasFreeSpins ? 0 : bet;
    const nextBalance = Math.max(0, user.balance - spend + outcome.win);

    let nextFreeSpins = Math.max(0, user.free_spins);
    let nextFreeBank = Math.max(0, user.free_spin_bank);

    if (hasFreeSpins) {
      nextFreeSpins = Math.max(0, nextFreeSpins - 1);
      nextFreeBank = Math.max(0, nextFreeBank - 1);
    }

    const freeLeftAfterConsume = nextFreeSpins > 0 || nextFreeBank > 0;

    let freeSpinsAwarded = 0;
    let nextJackpotBank = jackpotBank + Math.max(1, Math.floor(bet * 0.02));

    if (outcome.jackpotHit) {
      nextJackpotBank = DEFAULT_SETTINGS.jackpot_bank;
    }

    if (outcome.scatterCount >= 3 && !freeLeftAfterConsume) {
      const chance = Math.random();
      if (chance < 0.20) {
        freeSpinsAwarded = Math.min(Number(settings.free_spin_award || DEFAULT_SETTINGS.free_spin_award), 20);
        nextFreeSpins = freeSpinsAwarded;
        nextFreeBank = freeSpinsAwarded;
      }
    }

    await saveUserState(user.id, {
      balance: nextBalance,
      free_spins: nextFreeSpins,
      free_spin_bank: nextFreeBank
    });

    await saveSettings({
      jackpot_bank: nextJackpotBank
    });

    res.json({
      success: true,
      board,
      win: outcome.win,
      balance: nextBalance,
      freeSpins: nextFreeSpins,
      freeSpinBank: nextFreeBank,
      freeSpinsAwarded,
      scatterCount: outcome.scatterCount,
      scatterCells: outcome.scatterCells,
      paylines: outcome.paylines,
      jackpotBank: nextJackpotBank
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log("🎰 Server corriendo en puerto " + PORT);
});