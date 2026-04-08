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

// 🔥 Validación importante
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

// ================= CONFIG =================

const DEFAULT_SETTINGS = {
  slot_rtp: 96,
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
    .from("casino_settings")
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

// ================= AUTH =================

async function authRequired(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    const { data: user, error } = await supabase
      .from("app_users")
      .select("*")
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

function adminRequired(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Solo admin" });
  }
  next();
}

// ================= AUTH ROUTES =================

app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);
    const defaultBalance = await getSetting("default_balance", 1000);

    const { error } = await supabase.from("app_users").insert({
      username,
      password: hashed,
      role: "player",
      balance: defaultBalance
    });

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { data: user } = await supabase
      .from("app_users")
      .select("*")
      .eq("username", req.body.username)
      .maybeSingle();

    if (!user) {
      return res.status(400).json({ error: "Usuario no existe" });
    }

    const valid = await bcrypt.compare(req.body.password, user.password);
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
      balance: user.balance
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ================= TEST =================

app.get("/api/test", async (req, res) => {
  const { data, error } = await supabase.from("app_users").select("*");

  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true, users: data });
});

// ================= START =================

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log("🎰 Server corriendo en puerto " + PORT);
});