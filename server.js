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

  (data || []).forEach(row => {
    s[row.key] = Number(row.value);
  });

  return s;
}

async function saveSettings(values) {
  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value: String(value)
  }));

  await supabase.from("game_settings").upsert(rows, { onConflict: "key" });
}

/* ================= USERS ================= */

async function getUserById(id) {
  const { data } = await supabase.from("app_users").select("*").eq("id", id).maybeSingle();
  return data;
}

async function getUserByUsername(username) {
  const { data } = await supabase.from("app_users").select("*").eq("username", username).maybeSingle();
  return data;
}

async function saveUser(id, data) {
  await supabase.from("app_users").update(data).eq("id", id);
}

/* ================= AUTH ================= */

function issueToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

async function authRequired(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(payload.id);
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Solo admin" });
  next();
}

/* ================= LOGIN ================= */

app.post("/api/login", async (req, res) => {
  const user = await getUserByUsername(req.body.username);
  if (!user) return res.status(400).json({ error: "No existe" });

  const ok = await bcrypt.compare(req.body.password, user.password);
  if (!ok) return res.status(400).json({ error: "Wrong pass" });

  res.json({
    token: issueToken(user),
    username: user.username,
    role: user.role,
    balance: user.balance
  });
});

app.get("/api/me", authRequired, (req, res) => {
  res.json(req.user);
});

/* ================= ADMIN ================= */

app.get("/api/admin/settings", authRequired, adminOnly, async (req, res) => {
  res.json(await getSettings());
});

app.put("/api/admin/settings", authRequired, adminOnly, async (req, res) => {
  await saveSettings(req.body);
  res.json(await getSettings());
});

app.get("/api/admin/users", authRequired, adminOnly, async (req, res) => {
  const { data } = await supabase.from("app_users").select("id,username,role,balance");
  res.json({ users: data });
});

app.put("/api/admin/user/:id/balance", authRequired, adminOnly, async (req, res) => {
  const user = await getUserById(req.params.id);
  let newBalance = Number(req.body.amount);
  await saveUser(user.id, { balance: newBalance });
  res.json({ success: true });
});

/* ================= SLOTS PRO REAL ================= */

let casinoBank = 100000; // banco del casino (se puede persistir luego)

function getVolatilityMultiplier(volatility) {
  if (volatility === "high") return 3;
  if (volatility === "medium") return 2;
  return 1;
}

app.post("/api/slots/spin", authRequired, async (req, res) => {
  const bet = Number(req.body.amount);
  const user = await getUserById(req.user.id);
  const settings = await getSettings();

  if (user.balance < bet) {
    return res.status(400).json({ error: "Saldo insuficiente" });
  }

  const volatility = settings.volatility || "medium";
  const rtp = settings.rtp || 90;

  const volMulti = getVolatilityMultiplier(volatility);

  // 🎯 control RTP real
  const shouldPay = Math.random() * 100 < rtp;

  let win = 0;

  if (shouldPay && casinoBank > bet) {
    const rand = Math.random();

    if (rand < 0.6) win = bet * settings.slot_pay_3;
    else if (rand < 0.9) win = bet * settings.slot_pay_4;
    else win = bet * settings.slot_pay_5 * volMulti;

    // evitar quiebra del casino
    if (win > casinoBank) win = 0;
  }

  // actualizar banco
  casinoBank += bet - win;

  const newBalance = user.balance - bet + win;

  await saveUser(user.id, { balance: newBalance });

  res.json({
    win,
    balance: newBalance,
    bank: casinoBank,
    volatility
  });
});

/* ================= START ================= */

app.listen(PORT, () => {
  console.log("🔥 Casino PRO corriendo");
});