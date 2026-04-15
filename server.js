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
    return await bcrypt.compare(plain, stored);
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
    role: user.role,
    balance: user.balance
  });
});

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

/* ================= SLOTS ================= */

app.post("/api/slots/spin", authRequired, async (req, res) => {
  const bet = toInt(req.body.amount);
  const user = await getUserById(req.user.id);

  let freeSpins = user.freeSpins || 0;
  const isFreeSpin = freeSpins > 0;

  if (!isFreeSpin && user.balance < bet) {
    return res.status(400).json({ error: "Saldo insuficiente" });
  }

  const symbols = [
    "coin.png",
    "dragon.png",
    "goldpot.png",
    "jade.png",
    "lantern.png",
    "scatter.png",
    "wild.png"
  ];

  const board = [];

  for (let col = 0; col < 5; col++) {
    const column = [];
    for (let row = 0; row < 3; row++) {
      column.push(symbols[Math.floor(Math.random() * symbols.length)]);
    }
    board.push(column);
  }

  let win = 0;

  for (let row = 0; row < 3; row++) {
    let first = board[0][row];
    let count = 1;

    for (let col = 1; col < 5; col++) {
      if (board[col][row] === first || board[col][row] === "wild.png") {
        count++;
      } else break;
    }

    if (count >= 3) {
      win += bet * count;
    }
  }

  const scatterCount = board.flat().filter(s => s === "scatter.png").length;

  if (scatterCount >= 3) {
    freeSpins += 5;
  }

  if (isFreeSpin) freeSpins--;

  const newBalance = isFreeSpin
    ? user.balance + win
    : user.balance - bet + win;

  await saveUser(user.id, {
    balance: newBalance,
    freeSpins
  });

  res.json({
    success: true,
    board,
    win,
    freeSpins,
    balance: newBalance,
    isFreeSpin
  });
});

/* ================= START ================= */

async function start() {
  await ensureBootstrapAdmin();

  app.listen(PORT, () => {
    console.log("🎰 Casino PRO corriendo en puerto " + PORT);
  });
}

start();