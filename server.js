// =============================
// 🎰 CASINO SERVER COMPLETO
// =============================

import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { createClient } from "@supabase/supabase-js";

// =============================
// ⚙️ CONFIG
// =============================
const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;
const JWT_SECRET = "SUPER_SECRET_KEY"; // 🔒 cambiar en producción

// =============================
// 🟣 SUPABASE
// =============================
const supabase = createClient(
  "https://zggvrzgumtbilqvoggco.supabase.co",
  "sb_publishable_5Juv5ZwoL7tfkGLpOkKGaw_a9jMUDAC"
);

// =============================
// 🧰 UTILS
// =============================
function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

// =============================
// ⚙️ SETTINGS (RTP / JACKPOT)
// =============================
async function readSetting(key, defaultValue) {
  const { data } = await supabase
    .from("app_settings")
    .select("*")
    .eq("key", key)
    .single();

  return data ? Number(data.value) : defaultValue;
}

async function writeSetting(key, value) {
  await supabase.from("app_settings").upsert({
    key,
    value: String(value)
  });
}

// =============================
// 🔐 AUTH MIDDLEWARE
// =============================
function authRequired(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

// =============================
// 👤 REGISTER
// =============================
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  const { error } = await supabase.from("app_users").insert({
    username,
    password: hash,
    balance: 1000,
    free_spins: 0,
    free_spin_bank: 0
  });

  if (error) return res.status(400).json({ error: error.message });

  res.json({ success: true });
});

// =============================
// 🔐 LOGIN
// =============================
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const { data } = await supabase
    .from("app_users")
    .select("*")
    .eq("username", username)
    .single();

  if (!data) return res.status(400).json({ error: "Usuario no existe" });

  const valid = await bcrypt.compare(password, data.password);
  if (!valid) return res.status(400).json({ error: "Contraseña incorrecta" });

  const token = jwt.sign(
    { id: data.id, balance: data.balance },
    JWT_SECRET
  );

  res.json({ token, balance: data.balance });
});

// =============================
// 💰 BALANCE
// =============================
app.get("/api/user", authRequired, async (req, res) => {
  const { data } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", req.user.id)
    .single();

  res.json(data);
});

// =============================
// 🎰 SLOT MACHINE
// =============================
app.post("/api/slots/spin", authRequired, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const theme = req.body.theme || "asian";

    if (amount <= 0)
      return res.status(400).json({ error: "Apuesta inválida" });

    const { data: user } = await supabase
      .from("app_users")
      .select("*")
      .eq("id", req.user.id)
      .single();

    let balance = user.balance;
    let freeSpins = user.free_spins || 0;
    let freeSpinBank = user.free_spin_bank || 0;

    const inFree = freeSpins > 0;

    if (!inFree) {
      if (balance < amount)
        return res.status(400).json({ error: "Saldo insuficiente" });

      balance -= amount;
    } else {
      freeSpins--;
    }

    const symbols = [
      "dragon",
      "goldpot",
      "coin",
      "jade",
      "lantern",
      "wild",
      "scatter"
    ];

    function rand() {
      return symbols[Math.floor(Math.random() * symbols.length)];
    }

    const board = Array.from({ length: 3 }, () =>
      Array.from({ length: 5 }, rand)
    );

    let win = 0;

    function checkLine(row) {
      let first = row[0];
      let count = 1;

      for (let i = 1; i < row.length; i++) {
        if (row[i] === first || row[i] === "wild") count++;
        else break;
      }

      if (count >= 3) {
        if (count === 3) return amount * 3;
        if (count === 4) return amount * 8;
        if (count === 5) return amount * 18;
      }

      return 0;
    }

    board.forEach((row) => {
      win += checkLine(row);
    });

    // SCATTER
    let scatters = board.flat().filter((s) => s === "scatter").length;
    let freeSpinsAwarded = 0;

    if (scatters >= 3) {
      freeSpins += 5;
      freeSpinsAwarded = 5;
    }

    if (win > 0) {
      if (inFree) {
        freeSpinBank += win;
      } else {
        balance += win;
      }
    }

    if (freeSpins === 0 && freeSpinBank > 0) {
      balance += freeSpinBank;
      freeSpinBank = 0;
    }

    await supabase
      .from("app_users")
      .update({
        balance,
        free_spins: freeSpins,
        free_spin_bank: freeSpinBank
      })
      .eq("id", user.id);

    res.json({
      success: true,
      board,
      win,
      balance,
      freeSpins,
      freeSpinsAwarded
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 🛠 ADMIN
// =============================

// cambiar saldo
app.post("/api/admin/balance", async (req, res) => {
  const { userId, balance } = req.body;

  await supabase
    .from("app_users")
    .update({ balance })
    .eq("id", userId);

  res.json({ success: true });
});

// borrar usuario
app.post("/api/admin/delete", async (req, res) => {
  const { userId } = req.body;

  await supabase.from("app_users").delete().eq("id", userId);

  res.json({ success: true });
});

// =============================
// 🚀 START
// =============================
app.listen(PORT, () => {
  console.log("🎰 Casino corriendo en puerto " + PORT);
});