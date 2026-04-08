import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { createClient } from "@supabase/supabase-js";

// ================= CONFIG =================
const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;
const JWT_SECRET = "SUPER_SECRET_KEY";

// 🔴 PONÉ TUS DATOS ACA
const supabase = createClient(
  "https://TU_URL.supabase.co",
  "TU_ANON_KEY"
);

// ================= UTILS =================
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// ================= AUTH =================
function authRequired(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// ================= REGISTER =================
app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    const hash = await bcrypt.hash(password, 10);

    const { error } = await supabase.from("app_users").insert({
      username,
      password: hash,
      balance: 1000,
      free_spins: 0,
      free_spin_bank: 0
    });

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ================= LOGIN =================
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const { data } = await supabase
      .from("app_users")
      .select("*")
      .eq("username", username)
      .single();

    if (!data) throw new Error("Usuario no existe");

    const valid = await bcrypt.compare(password, data.password);
    if (!valid) throw new Error("Contraseña incorrecta");

    const token = jwt.sign({ id: data.id }, JWT_SECRET);

    res.json({ token, balance: data.balance });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ================= USER =================
app.get("/api/user", authRequired, async (req, res) => {
  const { data } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", req.user.id)
    .single();

  res.json(data);
});

// ================= SLOT =================
app.post("/api/slots/spin", authRequired, async (req, res) => {
  try {
    const amount = Number(req.body.amount);

    const { data: user } = await supabase
      .from("app_users")
      .select("*")
      .eq("id", req.user.id)
      .single();

    let balance = user.balance;
    let freeSpins = user.free_spins || 0;
    let bank = user.free_spin_bank || 0;

    const inFree = freeSpins > 0;

    if (!inFree) {
      if (balance < amount)
        return res.status(400).json({ error: "Sin saldo" });

      balance -= amount;
    } else {
      freeSpins--;
    }

    const symbols = ["dragon","coin","jade","lantern","wild","scatter"];

    const rand = () => symbols[Math.floor(Math.random() * symbols.length)];

    const board = Array.from({ length: 3 }, () =>
      Array.from({ length: 5 }, rand)
    );

    let win = 0;

    function checkRow(row) {
      let first = row[0];
      let count = 1;

      for (let i = 1; i < row.length; i++) {
        if (row[i] === first || row[i] === "wild") count++;
        else break;
      }

      if (count >= 3) {
        if (count === 3) return amount * 3;
        if (count === 4) return amount * 8;
        if (count === 5) return amount * 15;
      }
      return 0;
    }

    board.forEach(r => win += checkRow(r));

    // scatter
    const scatters = board.flat().filter(s => s === "scatter").length;

    let freeWon = 0;
    if (scatters >= 3) {
      freeSpins += 5;
      freeWon = 5;
    }

    if (win > 0) {
      if (inFree) bank += win;
      else balance += win;
    }

    if (freeSpins === 0 && bank > 0) {
      balance += bank;
      bank = 0;
    }

    await supabase.from("app_users").update({
      balance,
      free_spins: freeSpins,
      free_spin_bank: bank
    }).eq("id", user.id);

    res.json({
      board,
      win,
      balance,
      freeSpins,
      freeWon
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= START =================
app.listen(PORT, () => {
  console.log("🎰 Server corriendo en puerto " + PORT);
});