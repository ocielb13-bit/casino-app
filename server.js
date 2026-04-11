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

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toInt(value, fallback = 0) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

// ✅ ARREGLADO
async function getSetting(key, fallback) {
  const { data, error } = await supabase
    .from("game_settings")
    .select("value")
    .eq("setting_key", key)
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

// ✅ ARREGLADO
async function saveSettings(values) {
  const rows = Object.entries(values).map(([key, value]) => ({
    setting_key: key,
    value: String(value)
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("game_settings")
      .upsert(rows, { onConflict: "setting_key" });

    if (error) throw error;
  }
}

async function getUserById(id) {
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data;
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

    if (!user) return res.status(401).json({ error: "Sesión inválida" });

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

async function saveUserState(id, next) {
  const { error } = await supabase
    .from("app_users")
    .update(next)
    .eq("id", id);

  if (error) throw error;
}

/* ================= LOGIN ================= */

app.post("/api/login", async (req, res) => {
  const { data: user } = await supabase
    .from("app_users")
    .select("*")
    .eq("username", req.body.username)
    .maybeSingle();

  if (!user) return res.status(400).json({ error: "Usuario no existe" });

  const valid = await bcrypt.compare(req.body.password, user.password);
  if (!valid) return res.status(400).json({ error: "Contraseña incorrecta" });

  const token = issueToken(user);

  res.json({
    token,
    username: user.username,
    balance: user.balance,
    role: user.role
  });
});

/* ================= GAME INFO ================= */

app.get("/api/game-info", authRequired, async (req, res) => {
  const settings = await getAllSettings();
  res.json(settings);
});

/* ================= SLOTS ================= */

app.post("/api/slots/spin", authRequired, async (req, res) => {
  try {
    const bet = toInt(req.body.amount, 0);
    if (bet <= 0) return res.status(400).json({ error: "Apuesta inválida" });

    const settings = await getAllSettings();
    const user = await getUserById(req.user.id);

    if (!user) return res.status(401).json({ error: "Sesión inválida" });
    if (user.balance < bet) return res.status(400).json({ error: "Sin saldo" });

    const symbols = ["dragon", "goldpot", "coin", "jade", "lantern"];

    const board = Array.from({ length: 3 }, () =>
      Array.from({ length: 5 }, () => symbols[Math.floor(Math.random() * symbols.length)])
    );

    let win = Math.random() < settings.win_rate / 100 ? bet * settings.multiplier : 0;

    const balance = user.balance - bet + win;

    await saveUserState(user.id, { balance });

    res.json({
      success: true,
      board,
      win,
      balance
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= STATIC ================= */

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log("🎰 Server corriendo en puerto " + PORT);
});