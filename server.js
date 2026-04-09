²import express from "express";
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
  roulette_payout: 35
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
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
    await supabase.from("casino_settings").upsert(rows, { onConflict: "key" });
  }
}

async function authRequired(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    const { data: user, error } = await supabase
      .from("app_users")
      .select("id, username, role, balance, free_spins, free_spin_bank")
      .eq("id", payload.id)
      .maybeSingle();

    if (error || !user) {
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
  const defaultBalance = await getSetting("default_balance", 1000);
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

app.post("/api/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "").trim();

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

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      username: user.username,
      balance: user.balance,
      role: user.role,
      free_spins: user.free_spins || 0,
      free_spin_bank: user.free_spin_bank || 0
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
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

  await saveSettings(next);
  res.json({ success: true });
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

  const { data: user, error } = await supabase
    .from("app_users")
    .select("id, balance")
    .eq("id", id)
    .maybeSingle();

  if (error || !user) return res.status(404).json({ error: "Usuario no encontrado" });

  const balance = Math.max(0, Math.floor(Number(user.balance) + delta));

  const { error: updateError } = await supabase
    .from("app_users")
    .update({ balance })
    .eq("id", id);

  if (updateError) return res.status(500).json({ error: updateError.message });
  res.json({ success: true, balance });
});

app.put("/api/admin/users/:id/balance", authRequired, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const balanceInput = Number(req.body.balance);

  if (!Number.isFinite(id) || !Number.isFinite(balanceInput)) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  const balance = Math.max(0, Math.floor(balanceInput));

  const { error } = await supabase
    .from("app_users")
    .update({ balance })
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, balance });
});

app.patch("/api/admin/users/:id/role", authRequired, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const role = req.body.role === "admin" ? "admin" : "player";

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Usuario inválido" });
  }

  const { error } = await supabase
    .from("app_users")
    .update({ role })
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, role });
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

// Añadir estos endpoints a tu server.js actual

// --- ENDPOINT RULETA ---
app.post("/api/roulette/spin", authRequired, async (req, res) => {
    const { number, amount } = req.body;
    const userId = req.user.id;
    const betAmount = Math.floor(Number(amount));

    if (isNaN(betAmount) || betAmount <= 0) return res.status(400).json({ error: "Apuesta inválida" });
    if (req.user.balance < betAmount) return res.status(400).json({ error: "Saldo insuficiente" });

    // 1. Calcular Resultado
    const winningNumber = Math.floor(Math.random() * 37);
    const winRate = await getSetting("roulette_payout", 35); // Pago 35 a 1
    const won = winningNumber === parseInt(number);
    const prize = won ? betAmount * winRate : 0;
    
    // 2. Actualizar Balance
    const newBalance = req.user.balance - betAmount + prize;

    const { error } = await supabase
        .from("app_users")
        .update({ balance: newBalance })
        .eq("id", userId);

    if (error) return res.status(500).json({ error: "Error al actualizar saldo" });

    res.json({ 
        success: true, 
        result: winningNumber, 
        win: prize, 
        balance: newBalance 
    });
});

// --- ENDPOINT SLOTS (Motor Pro) ---
app.post("/api/slots/spin", authRequired, async (req, res) => {
    const { amount } = req.body;
    const userId = req.user.id;
    const bet = Math.floor(Number(amount));

    if (bet <= 0 || req.user.balance < bet) return res.status(400).json({ error: "Saldo insuficiente" });

    const settings = await getAllSettings();
    const symbols = ["dragon", "goldpot", "coin", "jade", "lantern", "wild", "scatter"];
    
    // Generar tablero 3x5
    let board = [];
    for(let i=0; i<3; i++) {
        board[i] = Array.from({length: 5}, () => symbols[Math.floor(Math.random() * symbols.length)]);
    }

    // Lógica de premios simple (ejemplo: 3 iguales en fila central)
    let win = 0;
    const middleRow = board[1];
    if (middleRow[0] === middleRow[1] && middleRow[1] === middleRow[2]) {
        win = bet * settings.slot_pay_3;
    }

    const finalBalance = req.user.balance - bet + win;
    await supabase.from("app_users").update({ balance: finalBalance }).eq("id", userId);

    res.json({ success: true, board, win, balance: finalBalance });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log("🎰 Server corriendo en puerto " + PORT);
});