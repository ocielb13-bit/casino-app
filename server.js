import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { createClient } from "@supabase/supabase-js";
import path from "path";

// ================= CONFIG =================
const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;
const JWT_SECRET = "SUPER_SECRET_KEY";

// ================= SUPABASE =================
const supabase = createClient(
  "https://zggvrzgumtbilqvoggco.supabase.co",
  "sb_publishable_5Juv5ZwoL7tfkGLpOkKGaw_a9jMUDAC"
);

// ================= SERVIR FRONTEND =================
// Esto permite que tu casino cargue desde Render
app.use(express.static("public"));

// Ruta base (evita "Cannot GET /")
app.get("/", (req, res) => {
  res.send("🎰 Casino online funcionando");
});

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

    // ================= DESCUENTO APUESTA =================
    if (!inFree) {
      if (balance < amount)
        return res.status(400).json({ error: "Sin saldo" });

      balance -= amount;
    } else {
      freeSpins--;
    }

    // ================= SÍMBOLOS =================
    const symbols = ["dragon","coin","jade","lantern","wild","scatter"];

    const rand = () => symbols[Math.floor(Math.random() * symbols.length)];

    // TABLERO 3x5 (3 filas, 5 columnas)
    const board = Array.from({ length: 3 }, () =>
      Array.from({ length: 5 }, rand)
    );

    let win = 0;

    // ================= LÓGICA CORREGIDA =================
    function checkRow(row) {
      let base = row[0];
      let count = 1;

      // Si el primero es wild, buscar símbolo base real
      if (base === "wild") {
        base = row.find(s => s !== "wild") || "wild";
      }

      for (let i = 1; i < row.length; i++) {
        if (row[i] === base || row[i] === "wild") count++;
        else break;
      }

      if (count < 3) return 0;

      if (count === 3) return amount * 2;
      if (count === 4) return amount * 5;
      if (count === 5) return amount * 10;

      return 0;
    }

    board.forEach(row => {
      win += checkRow(row);
    });

    // ================= SCATTER =================
    const scatters = board.flat().filter(s => s === "scatter").length;

    let freeWon = 0;
    if (scatters >= 3) {
      freeSpins += 5;
      freeWon = 5;
    }

    // ================= GANANCIA =================
    if (win > 0) {
      if (inFree) {
        bank += win;
      } else {
        balance += win;
      }
    }

    // ================= FINAL FREE SPINS =================
    if (freeSpins === 0 && bank > 0) {
      balance += bank;
      bank = 0;
    }

    // ================= GUARDAR =================
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