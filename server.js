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

// 👑 ADMIN AUTO
const BOOTSTRAP_ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const BOOTSTRAP_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1234";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

/* ================= SETTINGS (SUPABASE) ================= */

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

async function getSetting(key, fallback) {
  const { data } = await supabase
    .from("game_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (!data) return fallback;

  const n = Number(data.value);
  return Number.isFinite(n) ? n : fallback;
}

async function getAllSettings() {
  const { data } = await supabase
    .from("game_settings")
    .select("*");

  const settings = { ...DEFAULT_SETTINGS };

  for (const row of data || []) {
    const n = Number(row.value);
    settings[row.key] = Number.isFinite(n) ? n : row.value;
  }

  return settings;
}

async function saveSettings(values) {
  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value: String(value)
  }));

  if (rows.length > 0) {
    await supabase
      .from("game_settings")
      .upsert(rows, { onConflict: "key" });
  }
}

/* ================= HELPERS ================= */

function toInt(v) {
  return Math.floor(Number(v) || 0);
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

async function passwordMatches(plain, stored) {
  if (!stored) return false;

  if (stored.startsWith("$2")) {
    try {
      return await bcrypt.compare(plain, stored);
    } catch {
      return false;
    }
  }

  return plain === stored;
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

/* ================= ADMIN AUTO ================= */

async function ensureBootstrapAdmin() {
  const admin = await getUserByUsername(BOOTSTRAP_ADMIN_USERNAME);

  const hashed = await bcrypt.hash(BOOTSTRAP_ADMIN_PASSWORD, 10);

  if (!admin) {
    await supabase.from("app_users").insert({
      username: BOOTSTRAP_ADMIN_USERNAME,
      password: hashed,
      role: "admin",
      balance: 100000
    });
    console.log("👑 Admin creado");
    return;
  }

  const ok = await passwordMatches(BOOTSTRAP_ADMIN_PASSWORD, admin.password);

  if (!ok || admin.role !== "admin") {
    await saveUser(admin.id, {
      password: hashed,
      role: "admin"
    });
    console.log("🔧 Admin reparado");
  }
}

/* ================= LOGIN ================= */

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await getUserByUsername(username);

  if (!user) {
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
    balance: user.balance,
    role: user.role
  });
});

app.get("/api/me", authRequired, (req, res) => {
  res.json(req.user);
});

/* ================= ADMIN SETTINGS ================= */

app.get("/api/admin/settings", authRequired, adminOnly, async (req, res) => {
  res.json(await getAllSettings());
});

app.put("/api/admin/settings", authRequired, adminOnly, async (req, res) => {
  await saveSettings(req.body);
  res.json(await getAllSettings());
});

/* ================= SLOTS ================= */

app.post("/api/slots/spin", authRequired, async (req, res) => {
  const bet = toInt(req.body.amount);
  const user = await getUserById(req.user.id);
  const settings = await getAllSettings();

  if (user.balance < bet) {
    return res.status(400).json({ error: "Saldo insuficiente" });
  }

  const winChance = Math.random() * 100 < settings.win_rate;
  let win = 0;

  if (winChance) {
    win = bet * settings.multiplier;
  }

  const newBalance = user.balance - bet + win;

  await saveUser(user.id, { balance: newBalance });

  res.json({
    success: true,
    board: [["coin"]],
    win,
    balance: newBalance
  });
});

/* ================= START ================= */

async function start() {
  await ensureBootstrapAdmin();

  app.listen(PORT, () => {
    console.log("🎰 Casino PRO corriendo en puerto " + PORT);
    console.log("👑 Admin:", BOOTSTRAP_ADMIN_USERNAME);
  });
}

start();